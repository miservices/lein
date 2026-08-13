// Filler data so the dashboard never looks empty in a fresh Firestore project.
// Every real record from Firestore is sorted ABOVE this data — see data-service.js.
// All entries are tagged isMock: true so the UI can style/label them differently.

export const DEPARTMENTS = [
  "Flint PD",
  "Genesee Co. SO",
  "MSP - Flint Post",
  "Flint Fire Dept",
  "Flint EMS",
  "Dispatch"
];

export const DEPT_CLASS = {
  "Flint PD": "dept-police",
  "Genesee Co. SO": "dept-sheriff",
  "MSP - Flint Post": "dept-msp",
  "Flint Fire Dept": "dept-fire",
  "Flint EMS": "dept-ems",
  "Dispatch": "dept-dispatch"
};

export const mockUnits = [
  { unitNumber: "A-10", name: "B. Sosnowski", department: "Flint PD", rank: "Captain", status: "offduty", isMock: true },
  { unitNumber: "2-L-21", name: "J. Carter", department: "Flint PD", rank: "Corporal", status: "active", isMock: true },
  { unitNumber: "D-1", name: "A. Brooks", department: "Dispatch", rank: "Lead Dispatcher", status: "active", isMock: true },
  { unitNumber: "3-L-34", name: "T. Nguyen", department: "Genesee Co. SO", rank: "Deputy", status: "pending", isMock: true },
  { unitNumber: "E-12", name: "K. Thompson", department: "Flint Fire Dept", rank: "Engineer", status: "active", isMock: true },
  { unitNumber: "M-4", name: "L. Hernandez", department: "Flint EMS", rank: "Paramedic", status: "info", isMock: true },
  { unitNumber: "1-L-12", name: "M. Evans", department: "MSP - Flint Post", rank: "Trooper", status: "active", isMock: true }
];

export const mockCalls = [
  { code: "10-56", callTitle: "Suspicious person", address: "Saginaw St / Court St", postal: "724", units: "", status: "pending", isMock: true },
  { code: "10-38", callTitle: "Traffic stop - wanted", address: "Corunna Rd / Ballenger Hwy", postal: "509", units: "3-L-34", status: "active", isMock: true },
  { code: "10-90", callTitle: "Silent alarm - fleeing", address: "Miller Rd / Linden Rd", postal: "370", units: "2-L-21", status: "active", isMock: true },
  { code: "10-50", callTitle: "Traffic collision w/ injury", address: "Dort Hwy / Averill Ave", postal: "713", units: "E-12", status: "active", isMock: true },
  { code: "10-50", callTitle: "Traffic stop", address: "Fenton Rd", postal: "205", units: "", status: "active", isMock: true }
];

export const mockEmergencyCalls = [
  { type: "EMERGENCY", caller: "Security desk", location: "Hurley Medical Center", description: "Hospital security requesting officers for a combative patient.", isMock: true },
  { type: "EMERGENCY", caller: "Erin Foster", location: "Robert T. Longway Blvd", description: "Pedestrian struck by a dark sedan that left the scene.", isMock: true },
  { type: "EMERGENCY", caller: "Unknown caller", location: "Genesee County Savings, Chum...", description: "Open line with muffled voices, then disconnected.", isMock: true },
  { type: "CIVIL", caller: "Victor Rowe", location: "Court St Apartments, Building B", description: "Civil complaint about an ongoing noise issue.", isMock: true },
  { type: "EMERGENCY", caller: "Maya Campbell", location: "I-475 near Robert T. Longway", description: "Two vehicles collided in the northbound lane.", isMock: true }
];

export const mockRecordFlags = [
  { flagType: "Warrant hit", subject: "Castillo, M.", location: "Hurley Medical Center", description: "Outstanding felony warrant, county of issue confirmed.", status: "alert", isMock: true },
  { flagType: "Stolen vehicle", subject: "7YRK209", location: "Saginaw St / Court St", description: "Reported stolen 08/11, entered into statewide index.", status: "pending", isMock: true },
  { flagType: "Protection order", subject: "Rowe, V.", location: "Court St Apartments, Bldg B", description: "Active order on file, served 06/22.", status: "info", isMock: true }
];

export const mockGroups = [
  { name: "Engine 5", location: "", department: "Flint Fire Dept", status: "offduty", isMock: true },
  { name: "Ladder 3", location: "", department: "Flint Fire Dept", status: "offduty", isMock: true },
  { name: "Medic 12", location: "", department: "Flint EMS", status: "offduty", isMock: true }
];