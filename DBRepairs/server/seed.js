/**
 * Idempotent seed script — inserts demo data only if tables are empty.
 * Run: npm run seed  (from repo root)
 */
import Database from "better-sqlite3";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dbPath = join(dirname(fileURLToPath(import.meta.url)), "dbrepairs.sqlite");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

// --- Guard: only seed if tables empty ---
const existingCustomers = db.prepare("SELECT COUNT(*) AS n FROM customers").get().n;
if (existingCustomers > 0) {
  console.log("Database already has data — skipping seed.");
  process.exit(0);
}

const customers = [
  { name: "Rajesh Kumar", company: "Bharat Auto Parts Pvt. Ltd.", tax_number: "27AABCB1234F1ZP", phone: "9822011234", email: "rajesh@bharatauto.in", address: "Plot 14, MIDC Bhosari, Pune - 411026", notes: "Preferred contact: WhatsApp" },
  { name: "Priya Sharma", company: "Zenith Engineering College", tax_number: "33AACCZ4567G1ZQ", phone: "9445067890", email: "priya.sharma@zenithec.edu.in", address: "NH-48, Tambaram, Chennai - 600045", notes: "IT dept contact. Raise PO before service." },
  { name: "Anil Mehta", company: "Sunrise Pharma Ltd.", tax_number: "24AADCS8901H1ZR", phone: "9726034512", email: "anil.mehta@sunrisepharma.com", address: "15 GIDC Estate, Ankleshwar, Gujarat - 393002", notes: "GMP-certified facility. On-site work needs visitor badge." },
  { name: "Fatima Shaikh", company: "Al-Noor Textile Mills", tax_number: "27AAECF2345J1ZS", phone: "9867045678", email: "fatima@alnoor-textiles.com", address: "Shed 7, Bhiwandi Industrial Area, Mumbai - 421302", notes: "24×7 factory. Call before visiting." },
  { name: "Dr. Suresh Nair", company: "Lakshmi Multi-Specialty Hospital", tax_number: "32AAFCL6789K1ZT", phone: "9447089012", email: "ict@lakshmihosp.org", address: "Medical College Road, Thrissur, Kerala - 680001", notes: "Biomedical dept handles approvals. SLA: 4-hour response." },
  { name: "Vikram Singh", company: "SwiftMove Logistics", tax_number: "07AAGCS3456L1ZU", phone: "9810012345", email: "it@swiftmove.co.in", address: "Sector 68, Gurugram, Haryana - 122101", notes: "Fleet management systems. Contact ops manager Deepak." },
  { name: "Meena Iyer", company: "Coromandel Agro Industries", tax_number: "33AAHCI7890M1ZV", phone: "9444023456", email: "meena.iyer@coromandel.in", address: "Industrial Estate, Cuddalore, Tamil Nadu - 607001", notes: "Seasonal downtime Dec-Jan. Prefer remote support." },
  { name: "Arjun Patel", company: "IndoFab Steel Works", tax_number: "24AAICF1234N1ZW", phone: "9824056789", email: "arjun.patel@indofab.co.in", address: "Phase II GIDC, Vatva, Ahmedabad - 382445", notes: "ERP system: SAP B1. All devices on domain INDOFAB." },
];

const insertCustomer = db.prepare(`
  INSERT INTO customers (name, company, tax_number, phone, email, address, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const customerIds = [];
for (const c of customers) {
  const r = insertCustomer.run(c.name, c.company, c.tax_number, c.phone, c.email, c.address, c.notes);
  customerIds.push(Number(r.lastInsertRowid));
}
console.log(`Inserted ${customerIds.length} customers.`);

// Get status IDs
const statuses = db.prepare("SELECT id, code FROM repair_statuses ORDER BY sort_order").all();
const statusByCode = Object.fromEntries(statuses.map(s => [s.code, s.id]));

// today and date helpers
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
const today = new Date().toISOString();

const repairs = [
  // --- Closed today (delivered) ---
  {
    customer_idx: 0, status: "DELIVERED", device_type: "Switch", brand: "Cisco", model: "Catalyst 2960-X",
    serial_number: "FCW2345A01B", reported_fault: "Port 12-24 showing link failures after power surge. VLAN config may be corrupted.",
    accessories: "Power cable, SFP module (2x)", general_condition: "Moderate wear, chassis dented on right side",
    diagnosis: "Burnt power regulator on port block 12-24. Firmware rollback required.",
    work_performed: "Replaced power regulator IC, re-flashed firmware v15.2.7, re-applied VLAN config from backup.",
    estimated_value: 8500, final_value: 7200, opened_at: daysAgo(14), closed_at: today,
    internal_notes: "Used spare Cisco board from stock. Customer approved before work began.",
  },
  {
    customer_idx: 3, status: "DELIVERED", device_type: "UPS", brand: "APC", model: "Smart-UPS 1500VA",
    serial_number: "AS1901045678", reported_fault: "Battery not charging. Runtime dropped to under 2 minutes.",
    accessories: "IEC power cable", general_condition: "Good cosmetically, LCD dim",
    diagnosis: "Battery pack dead. Charging circuit also had a failed capacitor.",
    work_performed: "Replaced RBC55 battery cartridge and capacitor C14. Tested runtime: 18 min at 50% load.",
    estimated_value: 4200, final_value: 3800, opened_at: daysAgo(10), closed_at: today,
    internal_notes: "Customer requested express turnaround. Done in 24h.",
  },
  {
    customer_idx: 5, status: "DELIVERED", device_type: "Laptop", brand: "Dell", model: "Latitude 5540",
    serial_number: "DL54XYZ9012", reported_fault: "Screen flickering at random intervals. Gets worse on battery.",
    accessories: "Charger, carry bag", general_condition: "Like new, minor scuff on lid",
    diagnosis: "Loose eDP connector on display panel. Driver conflict with recent Windows update.",
    work_performed: "Re-seated eDP cable, applied thermal paste, rolled back display driver to 31.0.101.4576.",
    estimated_value: 2500, final_value: 2200, opened_at: daysAgo(7), closed_at: today,
    internal_notes: "Covered under SwiftMove's annual AMC. No charge to customer.",
  },

  // --- Ready for pickup ---
  {
    customer_idx: 1, status: "READY", device_type: "Router", brand: "Cisco", model: "ISR 4321",
    serial_number: "FGL2234H07K", reported_fault: "WAN interface intermittently dropping. Console shows input errors on Gi0/0/0.",
    accessories: "Console cable, rack ears", general_condition: "Good, rack-mounted",
    diagnosis: "Corrupted IOS-XE image causing interface instability. NIM card partially unseated.",
    work_performed: "Re-seated NIM-2T card, upgraded IOS-XE to 17.9.4a, cleared interface counters.",
    estimated_value: 6500, final_value: 5900, opened_at: daysAgo(9),
    internal_notes: "Campus-wide outage reported. Treated as priority.",
  },
  {
    customer_idx: 4, status: "READY", device_type: "Server", brand: "HPE", model: "ProLiant DL360 Gen10",
    serial_number: "MXQ9340012B", reported_fault: "iLO reports DIMM slot B1 error. Server running in degraded memory mode.",
    accessories: "Rails, 2x power cables", general_condition: "Excellent, data-centre grade",
    diagnosis: "Faulty 16GB DDR4 DIMM in slot B1. BIOS event log showed uncorrectable ECC errors.",
    work_performed: "Replaced DDR4 16GB RDIMM (HPE P00922-B21). Ran memtest86 for 6 hours — 0 errors.",
    estimated_value: 12000, final_value: 11500, opened_at: daysAgo(6),
    internal_notes: "Hospital critical infra. On-site pickup arranged.",
  },

  // --- In repair ---
  {
    customer_idx: 2, status: "IN_REPAIR", device_type: "Firewall", brand: "Fortinet", model: "FortiGate 60F",
    serial_number: "FGT60F2209ABC", reported_fault: "SSL VPN portal not accessible after firmware upgrade to 7.4.3. Users cannot connect remotely.",
    accessories: "Power adapter", general_condition: "Good",
    diagnosis: "7.4.3 SSL-VPN config schema changed. Certificates need re-import.",
    work_performed: "Partially complete: reverted to 7.2.8, re-imported SSL certs. Policy re-check in progress.",
    estimated_value: 5500, opened_at: daysAgo(4),
    internal_notes: "Pharma production depends on VPN for remote QA. Escalated.",
  },
  {
    customer_idx: 6, status: "IN_REPAIR", device_type: "Desktop", brand: "HP", model: "EliteDesk 800 G6",
    serial_number: "HED8006G1234", reported_fault: "POST failure — 3 beeps, no video output. Happened after a lightning event.",
    accessories: "Keyboard, mouse, power cable", general_condition: "Minor casing damage near rear I/O",
    diagnosis: "GPU failed, CMOS battery dead, one USB controller fried.",
    work_performed: "Replaced CMOS battery. New GPU ordered (Quadro P400). USB controller diagnostics ongoing.",
    estimated_value: 7800, opened_at: daysAgo(5),
    internal_notes: "Insurance claim in process — document all replaced parts with photos.",
  },
  {
    customer_idx: 7, status: "IN_REPAIR", device_type: "Switch", brand: "Ubiquiti", model: "UniFi USW-48-Pro",
    serial_number: "UBQ482310XYZ", reported_fault: "Half the PoE ports not supplying power. Affects IP cameras on plant floor.",
    accessories: "Rack ears", general_condition: "Good, minor rust on chassis",
    diagnosis: "PoE controller IC failed on port block 25-48. Firmware showed PoE budget exceeded before failure.",
    work_performed: "Ordered PoE controller replacement chip. Temporary patch: load-balanced cameras across working ports.",
    estimated_value: 9200, opened_at: daysAgo(3),
    internal_notes: "Factory camera coverage at 50%. Customer pressing for daily updates.",
  },

  // --- Waiting for parts ---
  {
    customer_idx: 0, status: "WAITING_PARTS", device_type: "Router", brand: "Ubiquiti", model: "EdgeRouter Pro",
    serial_number: "ERP20222345", reported_fault: "SFP+ cage on port 1 damaged — fibre uplink to ISP broken.",
    accessories: "Fibre patch cable", general_condition: "Good",
    diagnosis: "SFP+ port 1 transceiver dead and cage bent. Need cage replacement.",
    work_performed: "Ordered SFP+ cage from supplier. ETA 5 working days.",
    estimated_value: 3200, opened_at: daysAgo(8),
    internal_notes: "Temporary workaround: ISP shifted to port 2 SFP.",
  },
  {
    customer_idx: 4, status: "WAITING_PARTS", device_type: "Server", brand: "Dell", model: "PowerEdge R740",
    serial_number: "DPR740X9012", reported_fault: "RAID controller failure. iDRAC shows PERC H730P offline. RAID5 degraded.",
    accessories: "2x power cables, iDRAC cable", general_condition: "Excellent",
    diagnosis: "PERC H730P Mini card failed. Array still recoverable from 3 of 4 drives.",
    work_performed: "Awaiting replacement PERC card. Drives are safe — no data loss.",
    estimated_value: 18500, opened_at: daysAgo(11),
    internal_notes: "Hospital PACS server. Critical. Dell warranty claim in progress.",
  },

  // --- Waiting for customer ---
  {
    customer_idx: 1, status: "WAITING_CUSTOMER", device_type: "Printer", brand: "HP", model: "LaserJet Pro M404dn",
    serial_number: "HPLJ4042345", reported_fault: "Paper jam on every print job. Fuser error 50.4 displayed.",
    accessories: "Power cable, USB cable", general_condition: "Moderate wear, paper tray cracked",
    diagnosis: "Fuser assembly worn out. Paper pickup roller also degraded.",
    work_performed: "Replaced fuser assembly and pickup roller kit. Tested 200 pages — no jam.",
    estimated_value: 3800, final_value: 3400, opened_at: daysAgo(12),
    internal_notes: "Repair complete. Waiting for college admin to approve pickup and close PO.",
  },
  {
    customer_idx: 2, status: "WAITING_CUSTOMER", device_type: "Laptop", brand: "Dell", model: "Vostro 3520",
    serial_number: "DVS352X5678", reported_fault: "Keyboard keys stuck. Liquid damage suspected. Few keys not responding.",
    accessories: "Charger", general_condition: "Heavy use, sticker residue on lid",
    diagnosis: "Keyboard membrane damaged by liquid. Some traces on motherboard cleaned.",
    work_performed: "Replaced keyboard assembly. PCB cleaned with IPA. Unit functional.",
    estimated_value: 2800, final_value: 2500, opened_at: daysAgo(15),
    internal_notes: "Awaiting approval from Sunrise Pharma procurement. Sent email 3 days ago.",
  },

  // --- Received (new) ---
  {
    customer_idx: 3, status: "RECEIVED", device_type: "Switch", brand: "Cisco", model: "SG350-28P",
    serial_number: "SCG35028P1234", reported_fault: "Web UI not loading. Management VLAN accessible via CLI only.",
    accessories: "Power cable", general_condition: "Good, 2 years old",
    estimated_value: 4500, opened_at: daysAgo(1),
    internal_notes: "Received and logged. Diagnostic to start tomorrow.",
  },
  {
    customer_idx: 5, status: "RECEIVED", device_type: "UPS", brand: "APC", model: "Back-UPS 600VA",
    serial_number: "AB60098765", reported_fault: "Beeping continuously even on mains power. Overload LED on.",
    accessories: "IEC cable x2", general_condition: "Good",
    estimated_value: 1800, opened_at: daysAgo(0),
    internal_notes: "Brought in by driver. Office manager contact: Ritu +91 98110 54321.",
  },
  {
    customer_idx: 6, status: "RECEIVED", device_type: "Desktop", brand: "Dell", model: "OptiPlex 7090",
    serial_number: "DO709X0023", reported_fault: "System powers on but hangs at Dell logo. F2/F12 not responding.",
    accessories: "Power cable", general_condition: "Good",
    estimated_value: 3500, opened_at: daysAgo(0),
    internal_notes: "Production PC. Marked urgent by customer.",
  },

  // --- Diagnosis ---
  {
    customer_idx: 7, status: "DIAGNOSIS", device_type: "Firewall", brand: "Fortinet", model: "FortiGate 100F",
    serial_number: "FGT100F2308DEF", reported_fault: "High CPU utilisation (~98%) causing all policies to slow. Packet loss on WAN.",
    accessories: "Power cable, console cable", general_condition: "Good, 3 years old",
    diagnosis: "Initial check: IPS engine running full scan on all traffic. Likely signature DB corruption.",
    estimated_value: 9500, opened_at: daysAgo(2),
    internal_notes: "Steel plant WAN traffic analysis in progress.",
  },
  {
    customer_idx: 0, status: "DIAGNOSIS", device_type: "Server", brand: "HPE", model: "ProLiant ML350 Gen9",
    serial_number: "MXQ805XYZ99", reported_fault: "Server crashes overnight with BSOD 0x0000007E. Only during batch jobs.",
    accessories: "Power cables (2x)", general_condition: "Good, dusty inside",
    diagnosis: "Thermal issue suspected — dust accumulation on heatsinks causing thermal throttling.",
    estimated_value: 14000, opened_at: daysAgo(3),
    internal_notes: "Runs overnight inventory batch. ERP vendor Tata Consultancy involved.",
  },

  // --- Repaired ---
  {
    customer_idx: 5, status: "REPAIRED", device_type: "Printer", brand: "HP", model: "OfficeJet Pro 9015e",
    serial_number: "HPOJ9015X456", reported_fault: "Scanner flatbed not initialised. Scan jobs fail with error 5011.",
    accessories: "USB cable, power adapter", general_condition: "Good",
    diagnosis: "Scanner motor controller failure. Firmware bug in v001.1942A causing initialisation loop.",
    work_performed: "Replaced scanner motor assembly. Flashed firmware v001.2318A. Scan test passed.",
    estimated_value: 4200, final_value: 3900, opened_at: daysAgo(6),
    internal_notes: "Repaired. Awaiting QA sign-off before delivery.",
  },
  {
    customer_idx: 2, status: "REPAIRED", device_type: "Switch", brand: "HPE", model: "Aruba 2530-48G",
    serial_number: "SG531XYZ2022", reported_fault: "3 ports stuck in error-disabled state. Spanning tree topology unstable.",
    accessories: "Power cable, rack ears", general_condition: "Good, minor rack rash",
    diagnosis: "Spanning tree loop caused by unmanaged switch added by user. Ports error-disabled by BPDU guard.",
    work_performed: "Removed rogue switch. Re-enabled ports, configured RSTP, added portfast on edge ports.",
    estimated_value: 5000, final_value: 4500, opened_at: daysAgo(9),
    internal_notes: "Config saved. Delivery to Ankleshwar scheduled for Monday.",
  },

  // --- Cancelled ---
  {
    customer_idx: 1, status: "CANCELLED", device_type: "Desktop", brand: "HP", model: "ProDesk 400 G7",
    serial_number: "HPD400G78901", reported_fault: "No display, fan spinning at full speed.",
    accessories: "Power cable", general_condition: "Poor — coffee spill damage visible",
    diagnosis: "Severe motherboard corrosion from liquid damage. Repair not economically viable.",
    work_performed: "Diagnostic only. Advised write-off.",
    estimated_value: 6000, opened_at: daysAgo(18), closed_at: daysAgo(16),
    internal_notes: "Customer approved cancellation. Will procure new unit.",
  },
];

const insertRepair = db.prepare(`
  INSERT INTO repairs
    (repair_number, customer_id, status_id, device_type, brand, model, serial_number,
     reported_fault, accessories, general_condition, diagnosis, work_performed,
     estimated_value, final_value, internal_notes, opened_at, closed_at)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertHistory = db.prepare(`
  INSERT INTO repair_status_history (repair_id, status_id, changed_at)
  VALUES (?, ?, ?)
`);

const updateNumber = db.prepare("UPDATE repairs SET repair_number=? WHERE id=?");

const year = new Date().getFullYear();
let repairCount = 0;

const seedAll = db.transaction(() => {
  for (const r of repairs) {
    const statusId = statusByCode[r.status];
    const customerId = customerIds[r.customer_idx];
    const tmp = `TMP-${Math.random()}`;
    const result = insertRepair.run(
      tmp, customerId, statusId,
      r.device_type ?? null, r.brand ?? null, r.model ?? null, r.serial_number ?? null,
      r.reported_fault ?? null, r.accessories ?? null, r.general_condition ?? null,
      r.diagnosis ?? null, r.work_performed ?? null,
      r.estimated_value ?? null, r.final_value ?? null, r.internal_notes ?? null,
      r.opened_at ?? new Date().toISOString(), r.closed_at ?? null,
    );
    const id = Number(result.lastInsertRowid);
    updateNumber.run(`${year}-${String(id).padStart(6, "0")}`, id);
    // Insert initial status history
    insertHistory.run(id, statusByCode["RECEIVED"], r.opened_at ?? new Date().toISOString());
    // If not received, add current status change
    if (r.status !== "RECEIVED") {
      insertHistory.run(id, statusId, r.closed_at ?? r.opened_at ?? new Date().toISOString());
    }
    repairCount++;
  }
});

seedAll();
console.log(`Inserted ${repairCount} repairs.`);
console.log("Seed complete ✓");
db.close();
