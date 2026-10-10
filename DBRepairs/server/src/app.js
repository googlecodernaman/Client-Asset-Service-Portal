import Fastify from "fastify";
import { customerInput, officeSettingsInput, pathId, repairInput, ValidationError } from "./validation.js";

const repairSelect = `SELECT r.*, c.name customer_name, s.code status_code, s.label_key status_label_key
  FROM repairs r
  JOIN customers c ON c.id = r.customer_id
  JOIN repair_statuses s ON s.id = r.status_id`;

function replyNotFound(reply) {
  return reply.code(404).send({ error: "Not found" });
}

export function buildApp({ db, config, logger = true, migrateDatabase }) {
  const app = Fastify({ logger, trustProxy: config.trustProxy, bodyLimit: 3_200_000 });
  let restoring = false;

  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer", bodyLimit: 256 * 1024 * 1024 }, (_request, body, done) => {
    done(null, body);
  });

  app.addHook("onRequest", async (request, reply) => {
    if (restoring && request.url !== "/api/health") {
      return reply.code(503).send({ error: "Database restore in progress" });
    }
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "SAMEORIGIN");
    reply.header("Referrer-Policy", "same-origin");
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ValidationError) return reply.code(400).send({ error: error.message });
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  });

  app.get("/api/health", async () => {
    if (restoring) return { status: "restoring" };
    db.prepare("SELECT 1").get();
    return { status: "ok" };
  });

  app.get("/api/customers", async (request) => {
    const search = typeof request.query?.search === "string" ? request.query.search.trim() : "";
    if (!search) {
      return db.prepare(`SELECT id, name, company, tax_number, phone, email, address, notes, created_at, updated_at
        FROM customers ORDER BY lower(name), id`).all();
    }
    const term = `%${search}%`;
    return db.prepare(`SELECT id, name, company, tax_number, phone, email, address, notes, created_at, updated_at
      FROM customers
      WHERE name LIKE ?1
         OR COALESCE(company, '') LIKE ?1
         OR COALESCE(tax_number, '') LIKE ?1
         OR COALESCE(phone, '') LIKE ?1
         OR COALESCE(email, '') LIKE ?1
      ORDER BY lower(name), id`).all(term);
  });

  app.post("/api/customers", async (request, reply) => {
    const input = customerInput(request.body);
    const result = db.prepare(`INSERT INTO customers (name, company, tax_number, phone, email, address, notes)
      VALUES (?,?,?,?,?,?,?)`).run(input.name, input.company, input.taxNumber, input.phone, input.email, input.address, input.notes);
    return reply.code(201).send({ id: Number(result.lastInsertRowid) });
  });

  app.put("/api/customers/:id", async (request, reply) => {
    const id = pathId(request.params.id);
    const input = customerInput(request.body);
    const result = db.prepare(`UPDATE customers SET name=?, company=?, tax_number=?, phone=?, email=?,
      address=?, notes=?, updated_at=datetime('now') WHERE id=?`).run(
      input.name, input.company, input.taxNumber, input.phone, input.email, input.address, input.notes, id);
    if (!result.changes) return replyNotFound(reply);
    return reply.code(204).send();
  });

  app.delete("/api/customers/:id", async (request, reply) => {
    const result = db.prepare("DELETE FROM customers WHERE id=?").run(pathId(request.params.id));
    if (!result.changes) return replyNotFound(reply);
    return reply.code(204).send();
  });

  app.get("/api/statuses", async () =>
    db.prepare("SELECT id, code, label_key, sort_order FROM repair_statuses WHERE active=1 ORDER BY sort_order").all());

  app.get("/api/repairs", async (request) => {
    const customerId = request.query?.customerId;
    if (customerId != null && customerId !== "") {
      return db.prepare(`${repairSelect} WHERE r.customer_id=? ORDER BY r.id DESC`).all(pathId(customerId, "customerId"));
    }
    return db.prepare(`${repairSelect} ORDER BY r.id DESC`).all();
  });

  app.get("/api/repairs/:id", async (request, reply) => {
    const row = db.prepare(`${repairSelect} WHERE r.id=? LIMIT 1`).get(pathId(request.params.id));
    if (!row) return replyNotFound(reply);
    return row;
  });

  app.get("/api/repairs/:id/history", async (request) =>
    db.prepare(`SELECT h.id, h.status_id, s.code status_code, s.label_key status_label_key, h.changed_at, h.note
      FROM repair_status_history h JOIN repair_statuses s ON s.id=h.status_id
      WHERE h.repair_id=? ORDER BY h.id DESC`).all(pathId(request.params.id)));

  app.post("/api/repairs", async (request, reply) => {
    const input = repairInput(request.body);
    const insertRepair = db.transaction(() => {
      const temporary = `TMP-${crypto.randomUUID()}`;
      const result = db.prepare(`INSERT INTO repairs
        (repair_number,customer_id,status_id,device_type,brand,model,serial_number,imei,reported_fault,accessories,general_condition,estimated_value,internal_notes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        temporary, input.customer_id, input.status_id, input.device_type, input.brand, input.model,
        input.serial_number, input.imei, input.reported_fault, input.accessories, input.general_condition,
        input.estimated_value, input.internal_notes);
      const id = Number(result.lastInsertRowid);
      const openedYear = new Date().getFullYear();
      const repairNumber = `${openedYear}-${String(id).padStart(6, "0")}`;
      db.prepare("UPDATE repairs SET repair_number=? WHERE id=?").run(repairNumber, id);
      db.prepare("INSERT INTO repair_status_history (repair_id,status_id) VALUES (?,?)").run(id, input.status_id);
      return id;
    });
    const id = insertRepair();
    return reply.code(201).send({ id });
  });

  app.put("/api/repairs/:id", async (request, reply) => {
    const id = pathId(request.params.id);
    const input = repairInput(request.body, true);
    const updateRepair = db.transaction(() => {
      const current = db.prepare("SELECT status_id FROM repairs WHERE id=?").get(id);
      if (!current) return null;
      const statusCode = db.prepare("SELECT code FROM repair_statuses WHERE id=?").get(input.status_id)?.code;
      const closedExpr = (statusCode === "DELIVERED" || statusCode === "CANCELLED")
        ? "COALESCE(closed_at, datetime('now'))" : "NULL";
      db.prepare(`UPDATE repairs SET customer_id=?, status_id=?, device_type=?, brand=?, model=?, serial_number=?,
        imei=?, reported_fault=?, accessories=?, general_condition=?, diagnosis=?, work_performed=?, estimated_value=?,
        final_value=?, internal_notes=?, updated_at=datetime('now'), closed_at=${closedExpr}
        WHERE id=?`).run(
        input.customer_id, input.status_id, input.device_type, input.brand, input.model, input.serial_number,
        input.imei, input.reported_fault, input.accessories, input.general_condition, input.diagnosis,
        input.work_performed, input.estimated_value, input.final_value, input.internal_notes, id);
      if (current.status_id !== input.status_id) {
        db.prepare("INSERT INTO repair_status_history (repair_id,status_id,note) VALUES (?,?,?)").run(id, input.status_id, input.statusNote || null);
      }
      return true;
    });
    const result = updateRepair();
    if (!result) return replyNotFound(reply);
    return reply.code(204).send();
  });

  app.get("/api/dashboard", async () => {
    const counts = db.prepare(`SELECT
      COUNT(CASE WHEN s.code NOT IN ('DELIVERED','CANCELLED') THEN 1 END) open_repairs,
      COUNT(CASE WHEN s.code='WAITING_CUSTOMER' THEN 1 END) waiting_customer,
      COUNT(CASE WHEN s.code='READY' THEN 1 END) ready,
      COUNT(CASE WHEN r.closed_at IS NOT NULL AND date(r.closed_at)=date('now') THEN 1 END) closed_today
      FROM repairs r JOIN repair_statuses s ON s.id=r.status_id`).get();
    const recent = db.prepare(`SELECT r.id,r.repair_number,c.name customer_name,s.code status_code,s.label_key status_label_key,
      r.device_type,r.brand,r.model,r.opened_at FROM repairs r JOIN customers c ON c.id=r.customer_id
      JOIN repair_statuses s ON s.id=r.status_id ORDER BY r.id DESC LIMIT 5`).all();
    return {
      stats: { openRepairs: counts.open_repairs, waitingCustomer: counts.waiting_customer, ready: counts.ready, closedToday: counts.closed_today },
      recent
    };
  });

  const settingKeys = {
    companyName: "office.companyName", taxNumber: "office.taxNumber", address: "office.address",
    phone: "office.phone", email: "office.email", logoDataUrl: "office.logoDataUrl",
  };

  app.get("/api/settings/office", async () => {
    const keys = Object.values(settingKeys);
    const placeholders = keys.map(() => "?").join(",");
    const rows = db.prepare(`SELECT key,value FROM app_settings WHERE key IN (${placeholders})`).all(...keys);
    const values = new Map(rows.map((row) => [row.key, row.value]));
    return Object.fromEntries(Object.entries(settingKeys).map(([field, key]) => [field, values.get(key) || ""]));
  });

  app.put("/api/settings/office", async (request, reply) => {
    const settings = officeSettingsInput(request.body);
    const upsert = db.prepare(`INSERT INTO app_settings (key,value) VALUES (?,?)
      ON CONFLICT (key) DO UPDATE SET value=excluded.value`);
    const saveAll = db.transaction(() => {
      for (const [field, key] of Object.entries(settingKeys)) {
        upsert.run(key, settings[field]);
      }
    });
    saveAll();
    return reply.code(204).send();
  });

  app.get("/api/backups/portable", async (_request, reply) => {
    const customers = db.prepare("SELECT * FROM customers ORDER BY id").all();
    const repairs = db.prepare("SELECT * FROM repairs ORDER BY id").all();
    const history = db.prepare("SELECT * FROM repair_status_history ORDER BY id").all();
    const settings = db.prepare("SELECT * FROM app_settings").all();
    const statuses = db.prepare("SELECT * FROM repair_statuses ORDER BY sort_order").all();
    const archive = { version: 1, exported_at: new Date().toISOString(), customers, repairs, history, settings, statuses };
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return reply
      .header("Content-Type", "application/vnd.dbrepairs.backup+json")
      .header("Content-Disposition", `attachment; filename=DBRepairs-portable-${stamp}.dbrepairs`)
      .send(JSON.stringify(archive));
  });

  return app;
}
