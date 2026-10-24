const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const outputDir = path.resolve(__dirname, '../../sample_imports');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function saveSheetAndCsv(filenameBase, rows) {
  // 1. Create workbook & sheet
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  // Save .xlsx
  const xlsxPath = path.join(outputDir, `${filenameBase}.xlsx`);
  XLSX.writeFile(wb, xlsxPath);

  // Save .csv
  const csvContent = XLSX.utils.sheet_to_csv(ws);
  const csvPath = path.join(outputDir, `${filenameBase}.csv`);
  fs.writeFileSync(csvPath, csvContent, 'utf8');

  console.log(`Generated: ${filenameBase}.xlsx and ${filenameBase}.csv (${rows.length} rows)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CLASSES
// ─────────────────────────────────────────────────────────────────────────────
const classesData = [
  { name: 'Grade 1 Blue', level: 'Primary', grade_level: 'Grade 1', stream: 'Blue', capacity: 35 },
  { name: 'Grade 2 Gold', level: 'Primary', grade_level: 'Grade 2', stream: 'Gold', capacity: 35 },
  { name: 'Grade 5 Red', level: 'Primary', grade_level: 'Grade 5', stream: 'Red', capacity: 40 },
  { name: 'Grade 6 Green', level: 'Primary', grade_level: 'Grade 6', stream: 'Green', capacity: 40 },
  { name: 'Grade 7 East', level: 'Primary', grade_level: 'Grade 7', stream: 'East', capacity: 42 },
  { name: 'Grade 7 West', level: 'Primary', grade_level: 'Grade 7', stream: 'West', capacity: 42 },
  { name: 'Form 1A', level: 'Secondary', grade_level: 'Form 1', stream: 'A', capacity: 45 },
  { name: 'Form 1B', level: 'Secondary', grade_level: 'Form 1', stream: 'B', capacity: 45 },
  { name: 'Form 2 East', level: 'Secondary', grade_level: 'Form 2', stream: 'East', capacity: 45 },
  { name: 'Form 2 West', level: 'Secondary', grade_level: 'Form 2', stream: 'West', capacity: 45 },
  { name: 'Form 3 Sciences', level: 'Secondary', grade_level: 'Form 3', stream: 'Sciences', capacity: 40 },
  { name: 'Form 3 Commercials', level: 'Secondary', grade_level: 'Form 3', stream: 'Commercials', capacity: 40 },
  { name: 'Form 4 Arts', level: 'Secondary', grade_level: 'Form 4', stream: 'Arts', capacity: 40 },
  { name: 'Form 4 Sciences', level: 'Secondary', grade_level: 'Form 4', stream: 'Sciences', capacity: 40 },
  { name: 'Lower 6 Sciences', level: 'Secondary', grade_level: 'Lower 6', stream: 'Sciences', capacity: 30 },
  { name: 'Upper 6 Arts', level: 'Secondary', grade_level: 'Upper 6', stream: 'Arts', capacity: 30 }
];
saveSheetAndCsv('classes', classesData);

// ─────────────────────────────────────────────────────────────────────────────
// 2. SUBJECTS
// ─────────────────────────────────────────────────────────────────────────────
const subjectsData = [
  { code: 'MATH', name: 'Mathematics', category: 'Sciences', level: 'Primary & Secondary' },
  { code: 'ENG', name: 'English Language', category: 'Languages', level: 'All Levels' },
  { code: 'LIT', name: 'Literature in English', category: 'Languages', level: 'Secondary' },
  { code: 'SHON', name: 'Indigenous Language (Shona)', category: 'Languages', level: 'All Levels' },
  { code: 'SCIE', name: 'General Science', category: 'Sciences', level: 'Primary' },
  { code: 'PHYS', name: 'Physics', category: 'Pure Sciences', level: 'Form 3-6' },
  { code: 'CHEM', name: 'Chemistry', category: 'Pure Sciences', level: 'Form 3-6' },
  { code: 'BIOL', name: 'Biology', category: 'Pure Sciences', level: 'Form 3-6' },
  { code: 'GEOG', name: 'Geography', category: 'Humanities', level: 'Secondary' },
  { code: 'HIST', name: 'History & Heritage Studies', category: 'Humanities', level: 'All Levels' },
  { code: 'COMM', name: 'Commerce & Business Enterprise', category: 'Commercials', level: 'Secondary' },
  { code: 'ACCT', name: 'Principles of Accounting', category: 'Commercials', level: 'Form 3-6' },
  { code: 'COMP', name: 'Computer Science & ICT', category: 'Technology', level: 'All Levels' },
  { code: 'AGRI', name: 'Agriculture', category: 'Vocational', level: 'All Levels' }
];
saveSheetAndCsv('subjects', subjectsData);

// ─────────────────────────────────────────────────────────────────────────────
// 3. STAFF / TEACHERS
// ─────────────────────────────────────────────────────────────────────────────
const staffData = [
  {
    name: 'Mr. Tawanda Dube',
    email: 'tdube@harareacademy.ac.zw',
    phone: '+263771122334',
    role_title: 'HOD Sciences & Senior Master',
    qualification: 'M.Sc Science Education (NUST)',
    experience_years: 14,
    ec_number: 'EC-718290',
    employment_type: 'permanent',
    class_name: 'Form 3 Sciences',
    subjects: 'Physics; Chemistry'
  },
  {
    name: 'Mrs. Grace Sithole',
    email: 'gsithole@harareacademy.ac.zw',
    phone: '+263772233445',
    role_title: 'Senior English Mistress',
    qualification: 'B.A. English & Linguistics (UZ)',
    experience_years: 11,
    ec_number: 'EC-829104',
    employment_type: 'permanent',
    class_name: 'Form 1A',
    subjects: 'English Language; Literature in English'
  },
  {
    name: 'Mr. Blessmore Sibanda',
    email: 'bsibanda@harareacademy.ac.zw',
    phone: '+263773344556',
    role_title: 'Senior Primary Class Teacher',
    qualification: 'Dip.Ed Primary (Hillside)',
    experience_years: 16,
    ec_number: 'EC-649201',
    employment_type: 'permanent',
    class_name: 'Grade 7 East',
    subjects: 'Mathematics; General Science'
  },
  {
    name: 'Ms. Tariro Moyo',
    email: 'tmoyo@harareacademy.ac.zw',
    phone: '+263774455667',
    role_title: 'HOD Humanities',
    qualification: 'B.Ed Geography & History (MSU)',
    experience_years: 8,
    ec_number: 'EC-934812',
    employment_type: 'permanent',
    class_name: 'Form 2 East',
    subjects: 'Geography; History & Heritage Studies'
  },
  {
    name: 'Mr. Farai Chikwanha',
    email: 'fchikwanha@harareacademy.ac.zw',
    phone: '+263775566778',
    role_title: 'Commercial Studies Teacher',
    qualification: 'B.Com Accounting (GZU)',
    experience_years: 6,
    ec_number: 'EC-948102',
    employment_type: 'permanent',
    class_name: 'Form 3 Commercials',
    subjects: 'Commerce & Business Enterprise; Principles of Accounting'
  },
  {
    name: 'Mrs. Ruvimbo Chidzero',
    email: 'rchidzero@harareacademy.ac.zw',
    phone: '+263776677889',
    role_title: 'ICT Coordinator & CS Teacher',
    qualification: 'B.Sc Computer Science (CUT)',
    experience_years: 5,
    ec_number: 'EC-958203',
    employment_type: 'permanent',
    class_name: 'Lower 6 Sciences',
    subjects: 'Computer Science & ICT'
  },
  {
    name: 'Mr. Kudakwashe Mupari',
    email: 'kmupari@harareacademy.ac.zw',
    phone: '+263777788990',
    role_title: 'Agriculture Specialist',
    qualification: 'Dip. Agriculture (Chibero)',
    experience_years: 9,
    ec_number: 'EC-839103',
    employment_type: 'permanent',
    class_name: 'Form 1B',
    subjects: 'Agriculture; General Science'
  },
  {
    name: 'Sister Chipo Makoni',
    email: 'cmakoni@harareacademy.ac.zw',
    phone: '+263778899001',
    role_title: 'School Sister / Senior Nurse',
    qualification: 'SRN / Diploma General Nursing (Parirenyatwa)',
    experience_years: 12,
    ec_number: 'EC-729104',
    employment_type: 'permanent',
    class_name: 'None',
    subjects: 'Health Education'
  }
];
saveSheetAndCsv('staff', staffData);

// ─────────────────────────────────────────────────────────────────────────────
// 4. STUDENTS & GUARDIANS
// ─────────────────────────────────────────────────────────────────────────────
const studentsData = [
  {
    admission_number: 'HAR-2026-0101',
    first_name: 'Tadiwanashe',
    last_name: 'Moyo',
    gender: 'male',
    date_of_birth: '2012-05-18',
    class_name: 'Form 1A',
    guardian_name: 'Dr. Peter Moyo',
    guardian_phone: '+263772111222',
    guardian_email: 'pmoyo@health.gov.zw'
  },
  {
    admission_number: 'HAR-2026-0102',
    first_name: 'Ruvimbo',
    last_name: 'Chirandu',
    gender: 'female',
    date_of_birth: '2012-08-24',
    class_name: 'Form 1A',
    guardian_name: 'Mrs. Stella Chirandu',
    guardian_phone: '+263772222333',
    guardian_email: 'schirandu@gmail.com'
  },
  {
    admission_number: 'HAR-2026-0103',
    first_name: 'Tendai',
    last_name: 'Mutasa',
    gender: 'male',
    date_of_birth: '2011-11-04',
    class_name: 'Form 2 East',
    guardian_name: 'Mr. Christopher Mutasa',
    guardian_phone: '+263772333444',
    guardian_email: 'cmutasa@zimplats.co.zw'
  },
  {
    admission_number: 'HAR-2026-0104',
    first_name: 'Chiedza',
    last_name: 'Musarurwa',
    gender: 'female',
    date_of_birth: '2011-03-19',
    class_name: 'Form 2 East',
    guardian_name: 'Eng. Douglas Musarurwa',
    guardian_phone: '+263772444555',
    guardian_email: 'dmusarurwa@power.co.zw'
  },
  {
    admission_number: 'HAR-2026-0105',
    first_name: 'Kudakwashe',
    last_name: 'Gumbo',
    gender: 'male',
    date_of_birth: '2010-09-12',
    class_name: 'Form 3 Sciences',
    guardian_name: 'Mrs. Abigail Gumbo',
    guardian_phone: '+263772555666',
    guardian_email: 'agumbo@cbz.co.zw'
  },
  {
    admission_number: 'HAR-2026-0106',
    first_name: 'Tanatswa',
    last_name: 'Zhou',
    gender: 'female',
    date_of_birth: '2010-01-25',
    class_name: 'Form 3 Sciences',
    guardian_name: 'Mr. Enock Zhou',
    guardian_phone: '+263772666777',
    guardian_email: 'ezhou@minerals.gov.zw'
  },
  {
    admission_number: 'HAR-2026-0107',
    first_name: 'Tinashe',
    last_name: 'Mhlanga',
    gender: 'male',
    date_of_birth: '2010-07-08',
    class_name: 'Form 3 Commercials',
    guardian_name: 'Mr. George Mhlanga',
    guardian_phone: '+263772777888',
    guardian_email: 'gmhlanga@econet.co.zw'
  },
  {
    admission_number: 'HAR-2026-0108',
    first_name: 'Nyasha',
    last_name: 'Sibanda',
    gender: 'female',
    date_of_birth: '2014-04-14',
    class_name: 'Grade 6 Green',
    guardian_name: 'Mrs. Patience Sibanda',
    guardian_phone: '+263772888999',
    guardian_email: 'psibanda@telecel.co.zw'
  },
  {
    admission_number: 'HAR-2026-0109',
    first_name: 'Anesu',
    last_name: 'Makore',
    gender: 'male',
    date_of_birth: '2013-10-30',
    class_name: 'Grade 7 East',
    guardian_name: 'Mr. Tapiwa Makore',
    guardian_phone: '+263772999000',
    guardian_email: 'tmakore@agriculture.gov.zw'
  },
  {
    admission_number: 'HAR-2026-0110',
    first_name: 'Tafadzwa',
    last_name: 'Nyathi',
    gender: 'female',
    date_of_birth: '2013-06-22',
    class_name: 'Grade 7 East',
    guardian_name: 'Mrs. Brenda Nyathi',
    guardian_phone: '+263773111222',
    guardian_email: 'bnyathi@delta.co.zw'
  },
  {
    admission_number: 'HAR-2026-0111',
    first_name: 'Munyaradzi',
    last_name: 'Shumba',
    gender: 'male',
    date_of_birth: '2012-02-17',
    class_name: 'Form 1B',
    guardian_name: 'Mr. David Shumba',
    guardian_phone: '+263773222333',
    guardian_email: 'dshumba@finance.gov.zw'
  },
  {
    admission_number: 'HAR-2026-0112',
    first_name: 'Vimbai',
    last_name: 'Chigumba',
    gender: 'female',
    date_of_birth: '2012-12-05',
    class_name: 'Form 1B',
    guardian_name: 'Dr. Sarah Chigumba',
    guardian_phone: '+263773333444',
    guardian_email: 'schigumba@medcenter.co.zw'
  }
];
saveSheetAndCsv('students', studentsData);

// ─────────────────────────────────────────────────────────────────────────────
// 5. FEES BILLINGS
// ─────────────────────────────────────────────────────────────────────────────
const feesData = [
  {
    admission_number: 'HAR-2026-0101',
    term: 'Term 1 2026',
    title: 'Term 1 Tuition & General Purpose Levy',
    amount_due: 450.00,
    amount_paid: 450.00,
    due_date: '2026-01-31'
  },
  {
    admission_number: 'HAR-2026-0102',
    term: 'Term 1 2026',
    title: 'Term 1 Tuition & General Purpose Levy',
    amount_due: 450.00,
    amount_paid: 250.00,
    due_date: '2026-01-31'
  },
  {
    admission_number: 'HAR-2026-0103',
    term: 'Term 1 2026',
    title: 'Term 1 Tuition & Boarding Levy',
    amount_due: 780.00,
    amount_paid: 780.00,
    due_date: '2026-01-31'
  },
  {
    admission_number: 'HAR-2026-0104',
    term: 'Term 1 2026',
    title: 'Term 1 Tuition & Science Levy',
    amount_due: 480.00,
    amount_paid: 200.00,
    due_date: '2026-01-31'
  },
  {
    admission_number: 'HAR-2026-0105',
    term: 'Term 1 2026',
    title: 'Term 1 Senior Science & Lab Practical Levy',
    amount_due: 520.00,
    amount_paid: 520.00,
    due_date: '2026-01-31'
  },
  {
    admission_number: 'HAR-2026-0106',
    term: 'Term 1 2026',
    title: 'Term 1 Senior Science & Boarding Levy',
    amount_due: 850.00,
    amount_paid: 400.00,
    due_date: '2026-01-31'
  },
  {
    admission_number: 'HAR-2026-0107',
    term: 'Term 1 2026',
    title: 'Term 1 Commercials & Computer Levy',
    amount_due: 490.00,
    amount_paid: 0.00,
    due_date: '2026-01-31'
  },
  {
    admission_number: 'HAR-2026-0108',
    term: 'Term 1 2026',
    title: 'Primary Tuition & Stationery Levy',
    amount_due: 320.00,
    amount_paid: 320.00,
    due_date: '2026-01-31'
  },
  {
    admission_number: 'HAR-2026-0109',
    term: 'Term 1 2026',
    title: 'Grade 7 ZIMSEC Prep & Tuition Levy',
    amount_due: 380.00,
    amount_paid: 380.00,
    due_date: '2026-01-31'
  },
  {
    admission_number: 'HAR-2026-0110',
    term: 'Term 1 2026',
    title: 'Grade 7 ZIMSEC Prep & Tuition Levy',
    amount_due: 380.00,
    amount_paid: 150.00,
    due_date: '2026-01-31'
  },
  {
    admission_number: 'HAR-2026-0111',
    term: 'Term 1 2026',
    title: 'Term 1 Tuition & General Purpose Levy',
    amount_due: 450.00,
    amount_paid: 450.00,
    due_date: '2026-01-31'
  },
  {
    admission_number: 'HAR-2026-0112',
    term: 'Term 1 2026',
    title: 'Term 1 Tuition & General Purpose Levy',
    amount_due: 450.00,
    amount_paid: 0.00,
    due_date: '2026-01-31'
  }
];
saveSheetAndCsv('fees', feesData);

// ─────────────────────────────────────────────────────────────────────────────
// 6. ASSETS & INVENTORY
// ─────────────────────────────────────────────────────────────────────────────
const assetsData = [
  {
    name: 'Dell OptiPlex 7090 Desktop Computer',
    category: 'it_hardware',
    code: 'AST-IT-101',
    serial_number: 'SN-DELL-9011',
    value: 650.00,
    location: 'Computer Lab 1'
  },
  {
    name: 'HP LaserJet Enterprise M507 Printer',
    category: 'it_hardware',
    code: 'AST-IT-102',
    serial_number: 'SN-HP-8412',
    value: 480.00,
    location: 'Bursar & Administration Office'
  },
  {
    name: 'Compound Monocular Microscope Olympus CX23',
    category: 'science_lab',
    code: 'AST-LAB-101',
    serial_number: 'SN-OLY-4410',
    value: 390.00,
    location: 'Biology Lab'
  },
  {
    name: 'Digital Analytical Laboratory Balance Mettler',
    category: 'science_lab',
    code: 'AST-LAB-102',
    serial_number: 'SN-MET-7712',
    value: 520.00,
    location: 'Chemistry Lab'
  },
  {
    name: 'Student Double Desks & Chairs (Hardwood)',
    category: 'furniture',
    code: 'AST-FUR-101',
    serial_number: 'TAG-DSK-01',
    value: 65.00,
    location: 'Block B Room 1'
  },
  {
    name: 'Toyota Coaster School Bus 32 Seater',
    category: 'plant_vehicle',
    code: 'AST-VEH-101',
    serial_number: 'VIN-AEH-4491',
    value: 42000.00,
    location: 'Main Parking Garage'
  }
];
saveSheetAndCsv('assets', assetsData);

// ─────────────────────────────────────────────────────────────────────────────
// 7. LIBRARY CATALOGUE
// ─────────────────────────────────────────────────────────────────────────────
const libraryData = [
  {
    name: 'Step Ahead: O-Level Mathematics Student Book 3 & 4',
    author: 'M. Chitsike & P. Moyo',
    isbn: '978-0-7974-1234-5',
    shelf_location: 'Bay 1 Shelf A',
    resource_type: 'textbook'
  },
  {
    name: 'Focus on Shona: New Curriculum Secondary O-Level',
    author: 'D. Mutasa',
    isbn: '978-0-7974-5678-9',
    shelf_location: 'Bay 2 Shelf B',
    resource_type: 'textbook'
  },
  {
    name: 'Things Fall Apart (Heinemann African Writers Series)',
    author: 'Chinua Achebe',
    isbn: '978-0-3854-7454-2',
    shelf_location: 'Bay 4 Shelf C',
    resource_type: 'fiction'
  },
  {
    name: 'ZIMSEC Physical Science Past Examinations with Marking Schemes',
    author: 'ZIMSEC Editorial Board',
    isbn: '978-1-9982-1111-0',
    shelf_location: 'Reference Bay Stack 1',
    resource_type: 'past_paper'
  },
  {
    name: 'Cambridge International AS and A Level Biology Coursebook',
    author: 'Mary Jones & Richard Fosbery',
    isbn: '978-1-1076-3682-8',
    shelf_location: 'Bay 3 Shelf A',
    resource_type: 'textbook'
  }
];
saveSheetAndCsv('library', libraryData);

console.log('\nAll sample spreadsheets successfully created in: ' + outputDir);
