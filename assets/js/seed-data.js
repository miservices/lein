// =========================================================
// LEIN — mock dataset templates.
// This file is ONLY read by seeder.js, once, to populate Firestore
// the first time the app runs against an empty project. After that,
// every page reads real Firestore documents (tagged isMock:true) —
// nothing here is imported by the dashboard or any page directly.
// Add as many entries as you want here, or just add more straight
// into Firestore later; either way the app treats them identically.
// `_id` fields are local-only keys used to wire up links (person <->
// vehicle, citation -> person, etc.) before the real Firestore ids exist.
// =========================================================

export const seedUnits = [
  { unitNumber: "A-10",  name: "B. Sosnowski",  department: "fpd",  rank: "Captain",        status: "offduty" },
  { unitNumber: "2-L-21", name: "J. Carter",     department: "fpd",  rank: "Corporal",       status: "active" },
  { unitNumber: "1-L-08", name: "R. Delgado",    department: "fpd",  rank: "Officer",        status: "active" },
  { unitNumber: "D-1",   name: "A. Brooks",      department: "dispatch", rank: "Lead Dispatcher", status: "active" },
  { unitNumber: "3-L-34", name: "T. Nguyen",     department: "gcso", rank: "Deputy",         status: "pending" },
  { unitNumber: "3-L-19", name: "K. Wallace",    department: "gcso", rank: "Sergeant Deputy",status: "active" },
  { unitNumber: "E-12",  name: "K. Thompson",    department: "ffd",  rank: "Engineer",       status: "active" },
  { unitNumber: "L-3",   name: "D. Farrow",      department: "ffd",  rank: "Fire Lieutenant",status: "offduty" },
  { unitNumber: "M-4",   name: "L. Hernandez",   department: "fems", rank: "Paramedic",      status: "info" },
  { unitNumber: "M-7",   name: "S. Patel",       department: "fems", rank: "EMT",            status: "offduty" },
  { unitNumber: "1-L-12", name: "M. Evans",      department: "msp",  rank: "Trooper",        status: "active" },
  { unitNumber: "1-L-05", name: "C. Boyle",      department: "msp",  rank: "Trooper Sergeant", status: "offduty" }
];

export const seedGroups = [
  { name: "Engine 5",  department: "ffd",  status: "offduty" },
  { name: "Ladder 3",  department: "ffd",  status: "offduty" },
  { name: "Medic 12",  department: "fems", status: "offduty" }
];

// ---- People -------------------------------------------------
export const seedPeople = [
  { _id: "p1", first: "Marcus", middle: "D", last: "Castillo", akaNames: ["Marco"], dob: "1991-04-12",
    height: "5'11\"", weight: "185", eyeColor: "Brown", hairColor: "Black", sex: "M", race: "Hispanic",
    address: "1420 Saginaw St, Flint, MI", driverLicenseNumber: "C520-841-772-119", driverLicenseStatus: "suspended",
    probation: false, parole: true, gunPermitStatus: "denied", gunLicenseStatus: "none", timesStopped: 4,
    notes: "Known to frequent the Court St corridor. Prior fleeing charge 2023." },
  { _id: "p2", first: "Victor", middle: "", last: "Rowe", akaNames: [], dob: "1978-09-02",
    height: "5'9\"", weight: "210", eyeColor: "Hazel", hairColor: "Brown/Gray", sex: "M", race: "White",
    address: "Court St Apartments, Bldg B, Flint, MI", driverLicenseNumber: "R441-902-556-278", driverLicenseStatus: "valid",
    probation: false, parole: false, gunPermitStatus: "none", gunLicenseStatus: "none", timesStopped: 1,
    notes: "Subject of an active personal protection order — see Records." },
  { _id: "p3", first: "Erin", middle: "K", last: "Foster", akaNames: [], dob: "1996-01-27",
    height: "5'5\"", weight: "140", eyeColor: "Blue", hairColor: "Blonde", sex: "F", race: "White",
    address: "918 Robert T Longway Blvd, Flint, MI", driverLicenseNumber: "F229-317-004-451", driverLicenseStatus: "valid",
    probation: false, parole: false, gunPermitStatus: "issued", gunLicenseStatus: "CPL - active", timesStopped: 0, notes: "" },
  { _id: "p4", first: "Devon", middle: "A", last: "Whitmore", akaNames: ["Dee"], dob: "1988-11-30",
    height: "6'1\"", weight: "230", eyeColor: "Brown", hairColor: "Black", sex: "M", race: "Black",
    address: "2210 Fenton Rd, Flint, MI", driverLicenseNumber: "W442-118-903-604", driverLicenseStatus: "revoked",
    probation: true, parole: false, gunPermitStatus: "denied", gunLicenseStatus: "none", timesStopped: 6,
    notes: "Active felony warrant — narcotics. Considered a flight risk on foot." },
  { _id: "p5", first: "Maya", middle: "", last: "Campbell", akaNames: [], dob: "2001-06-14",
    height: "5'6\"", weight: "150", eyeColor: "Brown", hairColor: "Brown", sex: "F", race: "Black",
    address: "550 Miller Rd, Flint, MI", driverLicenseNumber: "C118-772-441-903", driverLicenseStatus: "valid",
    probation: false, parole: false, gunPermitStatus: "none", gunLicenseStatus: "none", timesStopped: 0, notes: "" },
  { _id: "p6", first: "Harold", middle: "J", last: "Bennett", akaNames: [], dob: "1965-03-19",
    height: "5'10\"", weight: "195", eyeColor: "Green", hairColor: "Gray", sex: "M", race: "White",
    address: "77 Court St, Flint, MI", driverLicenseNumber: "B009-556-772-118", driverLicenseStatus: "valid",
    probation: false, parole: false, gunPermitStatus: "issued", gunLicenseStatus: "LTP - active", timesStopped: 2,
    notes: "Local business owner, generally cooperative on stops." },
  { _id: "p7", first: "Alicia", middle: "R", last: "Nunez", akaNames: ["Ali"], dob: "1993-08-08",
    height: "5'4\"", weight: "130", eyeColor: "Brown", hairColor: "Black", sex: "F", race: "Hispanic",
    address: "3300 Corunna Rd, Flint, MI", driverLicenseNumber: "N772-441-118-556", driverLicenseStatus: "suspended",
    probation: true, parole: false, gunPermitStatus: "none", gunLicenseStatus: "none", timesStopped: 3, notes: "" },
  { _id: "p8", first: "Trevor", middle: "", last: "Lang", akaNames: [], dob: "1999-12-01",
    height: "5'8\"", weight: "160", eyeColor: "Blue", hairColor: "Brown", sex: "M", race: "White",
    address: "610 Dort Hwy, Flint, MI", driverLicenseNumber: "L556-118-772-441", driverLicenseStatus: "valid",
    probation: false, parole: false, gunPermitStatus: "none", gunLicenseStatus: "none", timesStopped: 1, notes: "" }
];

// ---- Vehicles -------------------------------------------------
export const seedVehicles = [
  { _id: "v1", plate: "7YRK209", state: "MI", make: "Dodge", model: "Charger", year: "2016", color: "Black",
    registeredOwnerPersonId: "p4", registrationStatus: "expired", insuranceStatus: "invalid", stolen: false },
  { _id: "v2", plate: "EFR-4471", state: "MI", make: "Toyota", model: "Camry", year: "2019", color: "Silver",
    registeredOwnerPersonId: "p3", registrationStatus: "valid", insuranceStatus: "valid", stolen: false },
  { _id: "v3", plate: "GNC-9081", state: "MI", make: "Ford", model: "F-150", year: "2014", color: "Red",
    registeredOwnerPersonId: "p6", registrationStatus: "valid", insuranceStatus: "valid", stolen: false },
  { _id: "v4", plate: "8KTL552", state: "MI", make: "Chevrolet", model: "Malibu", year: "2011", color: "White",
    registeredOwnerPersonId: "p1", registrationStatus: "suspended", insuranceStatus: "invalid", stolen: false },
  { _id: "v5", plate: "DVX-1123", state: "MI", make: "Honda", model: "Civic", year: "2020", color: "Blue",
    registeredOwnerPersonId: "p5", registrationStatus: "valid", insuranceStatus: "valid", stolen: false },
  { _id: "v6", plate: "9PLM044", state: "MI", make: "Jeep", model: "Grand Cherokee", year: "2017", color: "Gray",
    registeredOwnerPersonId: "p7", registrationStatus: "valid", insuranceStatus: "valid", stolen: true },
  { _id: "v7", plate: "FTB-2290", state: "OH", make: "Nissan", model: "Altima", year: "2015", color: "Black",
    registeredOwnerPersonId: "p8", registrationStatus: "valid", insuranceStatus: "expired", stolen: false }
];

// ---- Calls (kind: "cfs" = call for service, "field" = self-initiated activity) --
export const seedCalls = [
  { _id: "c1", kind: "cfs", code: "10-90", type: "EMERGENCY", title: "Silent alarm - fleeing",
    caller: "Alarm monitoring co.", address: "Miller Rd / Linden Rd", postal: "370",
    description: "Commercial silent alarm, suspects reportedly fleeing on foot northbound.",
    units: ["2-L-21"], status: "active", priority: "high" },
  { _id: "c2", kind: "cfs", code: "10-56", type: "CIVIL", title: "Suspicious person",
    caller: "Security desk", address: "Hurley Medical Center", postal: "112",
    description: "Hospital security requesting officers for a combative visitor in the ER lobby.",
    units: [], status: "pending", priority: "medium" },
  { _id: "c3", kind: "cfs", code: "10-50", type: "EMERGENCY", title: "Traffic collision w/ injury",
    caller: "Erin Foster", address: "Robert T. Longway Blvd", postal: "713",
    description: "Pedestrian struck by a dark sedan that left the scene.", units: ["E-12"], status: "active", priority: "high" },
  { _id: "c4", kind: "cfs", code: "10-91", type: "EMERGENCY", title: "Open line, disconnected",
    caller: "Unknown caller", address: "Genesee County Savings, Chummey Ave", postal: "204",
    description: "Open 911 line with muffled voices, then disconnected. Callback unsuccessful.",
    units: [], status: "pending", priority: "medium" },
  { _id: "c5", kind: "cfs", code: "10-16", type: "CIVIL", title: "Domestic disturbance",
    caller: "Victor Rowe", address: "Court St Apartments, Building B", postal: "412",
    description: "Ongoing dispute, reporting party requests officer presence only.", units: ["3-L-34"], status: "active", priority: "medium" },
  { _id: "c6", kind: "field", code: "10-38", title: "Traffic stop - wanted",
    address: "Corunna Rd / Ballenger Hwy", postal: "509", description: "Plate return shows registered owner has an active warrant.",
    units: ["3-L-34"], status: "active", priority: "medium" },
  { _id: "c7", kind: "field", code: "10-50", title: "Traffic stop",
    address: "Fenton Rd", postal: "205", description: "Speed enforcement stop.", units: ["1-L-08"], status: "active", priority: "low" },
  { _id: "c8", kind: "field", code: "10-90b", title: "Foot patrol",
    address: "Saginaw St / Court St", postal: "101", description: "Directed foot patrol, downtown corridor.", units: ["1-L-12"], status: "active", priority: "low" }
];

// ---- Reports ----------------------------------------------------
export const seedReports = [
  { _id: "r1", type: "arrest", caseNumber: null, title: "Arrest - outstanding felony warrant",
    linkedPersonIds: ["p4"], linkedVehicleIds: [], linkedReportIds: [], linkedCitationIds: [],
    linkedPersonNames: ["Whitmore, Devon A"], linkedVehicleLabels: [],
    narrative: "Subject Whitmore was located during a field contact on Fenton Rd and taken into custody on an outstanding felony narcotics warrant confirmed through CompuLite.",
    authorUnit: "1-L-08", status: "closed" },
  { _id: "r2", type: "accident", title: "Accident report - RTLB & Court",
    linkedPersonIds: ["p3"], linkedVehicleIds: ["v2"], linkedReportIds: [], linkedCitationIds: [],
    linkedPersonNames: ["Foster, Erin K"], linkedVehicleLabels: ["EFR-4471 - Silver Toyota Camry"],
    narrative: "Two-vehicle collision, minor injuries reported. Foster was the driver of unit 1, at-fault vehicle fled prior to arrival.",
    authorUnit: "E-12", status: "open" },
  { _id: "r3", type: "incident", title: "Incident report - hospital disturbance",
    linkedPersonIds: [], linkedVehicleIds: [], linkedReportIds: [], linkedCitationIds: [],
    linkedPersonNames: [], linkedVehicleLabels: [],
    narrative: "Responded to Hurley Medical Center for a combative visitor. Subject was calmed and released to family without further incident.",
    authorUnit: "2-L-21", status: "open" },
  { _id: "r4", type: "writtenWarning", title: "Written warning - equipment violation",
    linkedPersonIds: ["p8"], linkedVehicleIds: ["v7"], linkedReportIds: [], linkedCitationIds: [],
    linkedPersonNames: ["Lang, Trevor"], linkedVehicleLabels: ["FTB-2290 - Black Nissan Altima"],
    narrative: "Stopped for a non-functioning tail lamp. Verbal + written warning issued in lieu of citation, owner advised to repair within 7 days.",
    authorUnit: "1-L-08", status: "closed" }
];

// ---- Citations ----------------------------------------------------
export const seedCitations = [
  { _id: "ct1", personId: "p1", vehicleId: "v4", personName: "Castillo, Marcus D", vehicleLabel: "8KTL552 - White Chevrolet Malibu",
    violation: "Driving while license suspended", code: "MCL 257.904",
    fine: "$250", disposition: "pending", court: "Genesee County 67th District Court", presidingJudge: null, hearingDate: null },
  { _id: "ct2", personId: "p7", vehicleId: null, personName: "Nunez, Alicia R", vehicleLabel: null,
    violation: "Speeding 15 over posted limit", code: "MCL 257.627",
    fine: "$165", disposition: "guilty", court: "Genesee County 67th District Court", presidingJudge: "Hon. P. Whitfield", hearingDate: "2026-07-14" },
  { _id: "ct3", personId: "p6", vehicleId: "v3", personName: "Bennett, Harold J", vehicleLabel: "GNC-9081 - Red Ford F-150",
    violation: "Expired registration", code: "MCL 257.255",
    fine: "$110", disposition: "dismissed", court: "Genesee County 67th District Court", presidingJudge: "Hon. M. Osei", hearingDate: "2026-06-02" }
];

// ---- BOLOs ----------------------------------------------------
export const seedBolos = [
  { _id: "b1", type: "person", personId: "p4", personName: "Whitmore, Devon A", reason: "Outstanding felony warrant, considered a flight risk on foot.", status: "active" },
  { _id: "b2", type: "vehicle", vehicleId: "v6", vehicleLabel: "9PLM044 - Gray Jeep Grand Cherokee", reason: "Reported stolen 08/11, last seen near Corunna Rd.", status: "active" },
  { _id: "b3", type: "person", personId: null, freeText: "Subject fled traffic collision on RTLB in a dark sedan, partial plate 4-something-4-7.", reason: "Hit and run suspect", status: "active" }
];

// ---- Records: warrants, court orders, probation, parole, licenses,
// suspensions/revocations, stolen vehicles. One collection, `recordType`
// tells the UI (and the dashboard flag panel) what it's looking at.
export const seedRecords = [
  { _id: "rec1", recordType: "warrant", personId: "p4", personName: "Whitmore, Devon A", title: "Felony warrant - controlled substance",
    description: "Outstanding felony warrant, Genesee County. Confirmed via statewide index.",
    issuingCourt: "Genesee County 7th Circuit Court", status: "active" },
  { _id: "rec2", recordType: "parole", personId: "p1", personName: "Castillo, Marcus D", title: "Active parole",
    description: "Parole through 2027, reporting agent on file with MDOC.", status: "active" },
  { _id: "rec3", recordType: "probation", personId: "p4", personName: "Whitmore, Devon A", title: "Active probation (concurrent)",
    description: "Probation term running concurrent with parole status.", status: "active" },
  { _id: "rec4", recordType: "probation", personId: "p7", personName: "Nunez, Alicia R", title: "Active probation",
    description: "12-month probation, condition: no new traffic violations.", status: "active" },
  { _id: "rec5", recordType: "courtOrder", personId: "p2", personName: "Rowe, Victor", title: "Personal protection order (PPO)",
    description: "Active PPO on file, served 06/22. Respondent barred from Court St Apartments Bldg B.", status: "active" },
  { _id: "rec6", recordType: "license", personId: "p3", personName: "Foster, Erin K", title: "Concealed Pistol License (CPL)",
    description: "CPL active, issued Genesee County Clerk.", status: "active" },
  { _id: "rec7", recordType: "license", personId: "p6", personName: "Bennett, Harold J", title: "License To Purchase (LTP)",
    description: "LTP active, valid for one handgun purchase.", status: "active" },
  { _id: "rec8", recordType: "suspension", personId: "p1", personName: "Castillo, Marcus D", title: "Driver's license suspended",
    description: "Suspended for failure to appear, reinstatement not on file.", status: "active" },
  { _id: "rec9", recordType: "revocation", personId: "p4", personName: "Whitmore, Devon A", title: "Driver's license revoked",
    description: "Revoked following prior OWI conviction.", status: "active" },
  { _id: "rec10", recordType: "suspension", personId: "p7", personName: "Nunez, Alicia R", title: "Driver's license suspended",
    description: "Suspended, unpaid fines on file with 67th District Court.", status: "active" },
  { _id: "rec11", recordType: "stolenVehicle", vehicleId: "v6", vehicleLabel: "9PLM044 - Gray Jeep Grand Cherokee", title: "Stolen vehicle - entered statewide",
    description: "Reported stolen 08/11 from owner's residence on Corunna Rd. Entered into LEIN statewide index.", status: "active" }
];