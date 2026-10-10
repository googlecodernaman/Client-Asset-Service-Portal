CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT,
  tax_number TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS repair_statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS repairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repair_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status_id INTEGER NOT NULL REFERENCES repair_statuses(id),
  device_type TEXT,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  imei TEXT,
  reported_fault TEXT,
  accessories TEXT,
  general_condition TEXT,
  diagnosis TEXT,
  work_performed TEXT,
  estimated_value REAL,
  final_value REAL,
  internal_notes TEXT,
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS repair_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repair_id INTEGER NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  status_id INTEGER NOT NULL REFERENCES repair_statuses(id),
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  note TEXT
);

CREATE INDEX IF NOT EXISTS repairs_customer_id_idx ON repairs(customer_id);
CREATE INDEX IF NOT EXISTS repairs_status_id_idx ON repairs(status_id);
CREATE INDEX IF NOT EXISTS repair_status_history_repair_id_idx ON repair_status_history(repair_id);

INSERT OR IGNORE INTO repair_statuses (code, label_key, sort_order) VALUES
  ('RECEIVED', 'status.received', 10),
  ('DIAGNOSIS', 'status.diagnosis', 20),
  ('WAITING_CUSTOMER', 'status.waitingCustomer', 30),
  ('WAITING_PARTS', 'status.waitingParts', 40),
  ('IN_REPAIR', 'status.inRepair', 50),
  ('REPAIRED', 'status.repaired', 60),
  ('READY', 'status.ready', 70),
  ('DELIVERED', 'status.delivered', 80),
  ('CANCELLED', 'status.cancelled', 90);
