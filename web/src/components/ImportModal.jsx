import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { invalidate } from '../data/apiHooks';
import { Modal } from './ui';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  RefreshCw,
  Table,
  Copy,
  Check,
  Info,
  ShieldAlert,
  ArrowRight,
  BookOpen,
  Sparkles,
  Link as LinkIcon,
  HelpCircle
} from 'lucide-react';

/**
 * Robust pure-client table parser for CSV, TSV, and pasted Excel/PDF text
 */
function parseClientTable(rawText) {
  if (!rawText || !rawText.trim()) return { headers: [], rows: [] };
  const lines = rawText.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };

  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length) delimiter = ';';
  else if (firstLine.includes('|')) delimiter = '|';

  const rows = [];
  for (const line of lines) {
    let cells;
    if (delimiter === '\t' || line.includes('\t')) {
      cells = line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''));
    } else {
      // Basic CSV split respecting quotes
      const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^",]*))/g;
      cells = [];
      let match;
      while ((match = regex.exec(line)) !== null) {
        let cell = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
        if (cell !== undefined) cells.push(cell.trim());
      }
    }
    if (cells.length > 0 && cells.some(c => c.length > 0)) {
      rows.push(cells);
    }
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0];
  const dataRows = rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.toLowerCase().replace(/[^a-z0-9]/g, '_')] = r[i] || '';
    });
    return obj;
  });

  return { headers, rows: dataRows };
}

/**
 * Dynamically generated authoritative institutional format specifications
 * Strictly enforces school type (Primary, Secondary, High School, Combined)
 * and stream policy (single-cohort vs streamed).
 */
export function getDynamicEntitySpec(entity, schoolInfo) {
  const schoolType = (schoolInfo?.school_type || 'secondary').toLowerCase();
  const isPrimary = schoolType === 'primary';
  const isCombined = schoolType === 'combined' || schoolType === 'mixed';
  const hasAlevel = Boolean(schoolInfo?.has_alevel || schoolType === 'high_school' || schoolType === 'a_level');
  const hasStreams = schoolInfo?.has_streams !== 0 && schoolInfo?.has_streams !== false;

  // Cohort class samples tailored strictly to the school
  const primaryClasses = hasStreams ? ['Grade 1 East', 'Grade 3 Blue', 'Grade 7 Gold'] : ['Grade 1', 'Grade 3', 'Grade 7'];
  const secondaryClasses = hasStreams
    ? (hasAlevel ? ['Form 1A', 'Form 2 East', 'Form 3 Commercials', 'Lower 6 Sciences'] : ['Form 1A', 'Form 2 East', 'Form 3 Commercials', 'Form 4 Sciences'])
    : ['Form 1', 'Form 2', 'Form 3', 'Form 4'];

  const activeClassSamples = isPrimary
    ? primaryClasses
    : isCombined
    ? (hasStreams ? ['Grade 3 Blue', 'Grade 7 Gold', 'Form 1A', 'Form 3 Commercials'] : ['Grade 3', 'Grade 7', 'Form 1', 'Form 3'])
    : secondaryClasses;

  const defaultSampleClass = activeClassSamples[0] || (isPrimary ? 'Grade 1' : 'Form 1');

  const specs = {
    students: {
      title: 'Students & Guardian Roster Specification',
      description: `Mandatory Format: Ingests student demographic profiles for ${isPrimary ? 'Primary (ECD/Grade 1-7)' : isCombined ? 'Combined Primary & Secondary' : 'Secondary (Form 1-4/6)'} institutions.${hasStreams ? ' Stream tags are permitted.' : ' This school operates single-cohorts (no streams allowed).' }`,
      mandatory: ['first_name', 'last_name', 'gender', 'class_name'],
      fields: [
        { key: 'first_name', label: 'First Name', required: true, type: 'Text', rule: 'Student legal first name (as on birth certificate)', example: 'Tadiwanashe' },
        { key: 'last_name', label: 'Last Name / Surname', required: true, type: 'Text', rule: 'Student legal surname / family name', example: 'Moyo' },
        { key: 'gender', label: 'Gender', required: true, type: 'Choice', rule: 'Must be "male" or "female" (also accepts "M" or "F")', example: 'female' },
        { key: 'class_name', label: 'Class / Cohort', required: true, type: 'Text', rule: `Exact class name (${isPrimary ? 'e.g. Grade 1' + (hasStreams ? ' East' : '') : 'e.g. Form 1' + (hasStreams ? 'A' : '')}). Level & stream rules strictly verified.`, example: defaultSampleClass },
        { key: 'admission_number', label: 'Admission Number', required: false, type: 'Text', rule: 'Unique student admission ID. If omitted, auto-generated sequentially.', example: 'ADM2026-001' },
        { key: 'date_of_birth', label: 'Date of Birth', required: false, type: 'Date', rule: 'Strict format: YYYY-MM-DD (e.g. 2012-05-18)', example: '2012-05-18' },
        { key: 'guardian_name', label: 'Guardian Full Name', required: false, type: 'Text', rule: 'Primary parent or legal guardian full name', example: 'Dr. Peter Moyo' },
        { key: 'guardian_phone', label: 'Guardian Phone', required: false, type: 'Phone', rule: 'Primary phone with country code for SMS & WhatsApp emergency alerts', example: '+263772345678' },
        { key: 'guardian_email', label: 'Guardian Email', required: false, type: 'Email', rule: 'Email for parent portal login & digital report card delivery', example: 'pmoyo@health.gov.zw' }
      ],
      sampleHeaders: 'admission_number,first_name,last_name,gender,date_of_birth,class_name,guardian_name,guardian_phone,guardian_email',
      sampleRows: isPrimary ? [
        { admission_number: 'ADM2026-001', first_name: 'Tendai', last_name: 'Mutasa', gender: 'male', date_of_birth: '2017-05-12', class_name: primaryClasses[0], guardian_name: 'Mr. C. Mutasa', guardian_phone: '+263771234567', guardian_email: 'cmutasa@gmail.com' },
        { admission_number: 'ADM2026-002', first_name: 'Ruvimbo', last_name: 'Chirandu', gender: 'female', date_of_birth: '2015-08-24', class_name: primaryClasses[1], guardian_name: 'Mrs. S. Chirandu', guardian_phone: '+263772345678', guardian_email: 'chirandu@yahoo.com' },
        { admission_number: 'ADM2026-003', first_name: 'Farai', last_name: 'Moyo', gender: 'male', date_of_birth: '2012-02-15', class_name: primaryClasses[2], guardian_name: 'Dr. P. Moyo', guardian_phone: '+263773456789', guardian_email: 'pmoyo@health.gov.zw' }
      ] : isCombined ? [
        { admission_number: 'ADM2026-001', first_name: 'Tendai', last_name: 'Mutasa', gender: 'male', date_of_birth: '2015-05-12', class_name: hasStreams ? 'Grade 3 Blue' : 'Grade 3', guardian_name: 'Mr. C. Mutasa', guardian_phone: '+263771234567', guardian_email: 'cmutasa@gmail.com' },
        { admission_number: 'ADM2026-002', first_name: 'Kudakwashe', last_name: 'Ncube', gender: 'male', date_of_birth: '2012-03-14', class_name: hasStreams ? 'Form 1A' : 'Form 1', guardian_name: 'Mr. T. Ncube', guardian_phone: '+263772345678', guardian_email: 'kncube@gmail.com' },
        { admission_number: 'ADM2026-003', first_name: 'Tafadzwa', last_name: 'Ndlovu', gender: 'male', date_of_birth: '2010-11-05', class_name: hasStreams ? 'Form 3 Commercials' : 'Form 3', guardian_name: 'Dr. S. Ndlovu', guardian_phone: '+263773456789', guardian_email: 'sndlovu@zim.gov.zw' }
      ] : [
        { admission_number: 'ADM2026-001', first_name: 'Kudakwashe', last_name: 'Ncube', gender: 'male', date_of_birth: '2012-03-14', class_name: secondaryClasses[0], guardian_name: 'Mr. T. Ncube', guardian_phone: '+263771234567', guardian_email: 'kncube@gmail.com' },
        { admission_number: 'ADM2026-002', first_name: 'Chiedza', last_name: 'Musarurwa', gender: 'female', date_of_birth: '2011-07-22', class_name: secondaryClasses[1], guardian_name: 'Mrs. E. Musarurwa', guardian_phone: '+263772345678', guardian_email: 'emusarurwa@yahoo.com' },
        { admission_number: 'ADM2026-003', first_name: 'Tafadzwa', last_name: 'Ndlovu', gender: 'male', date_of_birth: '2010-11-05', class_name: secondaryClasses[2], guardian_name: 'Dr. S. Ndlovu', guardian_phone: '+263773456789', guardian_email: 'sndlovu@zim.gov.zw' },
        ...(hasAlevel ? [{ admission_number: 'ADM2026-004', first_name: 'Nyasha', last_name: 'Moyo', gender: 'female', date_of_birth: '2008-04-18', class_name: secondaryClasses[3] || 'Lower 6 Sciences', guardian_name: 'Mr. P. Moyo', guardian_phone: '+263774567890', guardian_email: 'pmoyo@health.gov.zw' }] : [{ admission_number: 'ADM2026-004', first_name: 'Tatenda', last_name: 'Moyo', gender: 'female', date_of_birth: '2009-09-12', class_name: secondaryClasses[3] || 'Form 4', guardian_name: 'Mr. P. Moyo', guardian_phone: '+263774567890', guardian_email: 'pmoyo@health.gov.zw' }])
      ],
      rules: [
        `Strict School Level: ${isPrimary ? 'Only ECD and Grade 1-7 allowed. Secondary forms will be rejected.' : 'Only Form 1 to Form 4/6 allowed. Primary grades (ECD, Grade 1-7) are strictly blocked.'}`,
        `Stream Rule: ${hasStreams ? 'Streams are permitted (e.g. A, B, East, West).' : 'Single cohort per grade only — stream tags will be rejected.'}`,
        'Data Privacy: Parent accounts are linked exclusively to their own children. Unlinked parents can never view student rosters.',
        'Auto-Enrollment: Students are enrolled directly into their assigned class cohort upon ingestion.'
      ]
    },
    staff: {
      title: 'Staff, Form Master & Subject Allocation Specification',
      description: 'Mandatory Format: Creates teacher user accounts, links Form Master / Class Teacher responsibilities to classes, and assigns teaching allocations.',
      mandatory: ['name', 'email', 'role_title'],
      fields: [
        { key: 'name', label: 'Full Name', required: true, type: 'Text', rule: 'Full name and title of the teacher', example: 'Mr. Tawanda Dube' },
        { key: 'email', label: 'Institutional Email', required: true, type: 'Email', rule: 'Unique email address for portal login. A temporary password will be generated.', example: 'tdube@school.ac.zw' },
        { key: 'role_title', label: 'Designation / Post', required: true, type: 'Text', rule: 'Designation: Senior Teacher, HOD Sciences, Form Master, Class Teacher', example: 'HOD Sciences' },
        { key: 'phone', label: 'Phone Number', required: false, type: 'Phone', rule: 'Teacher mobile contact number for emergency school alerts', example: '+263774567890' },
        { key: 'qualification', label: 'Academic / Professional Qualification', required: false, type: 'Text', rule: 'Highest qualification (e.g. B.Ed, Dip.Ed, M.Sc)', example: isPrimary ? 'Dip.Ed Primary' : 'B.Ed Mathematics' },
        { key: 'experience_years', label: 'Teaching Experience (Years)', required: false, type: 'Number', rule: 'Years of professional experience (e.g. 5, 12).', example: '8' },
        { key: 'ec_number', label: 'EC / Civil Service Number', required: false, type: 'Text', rule: 'Staff employment code or MoPSE EC Number', example: 'EC-993810' },
        { key: 'class_name', label: 'Class Teacher / Form Master', required: false, type: 'Text', rule: 'Crucial: Links this teacher as the official Form Master / Class Teacher.', example: defaultSampleClass },
        { key: 'subjects', label: 'Subjects Taught', required: false, type: 'List', rule: 'Crucial: Semicolon or comma-separated subjects. Automatically maps teaching allocations.', example: isPrimary ? 'All Primary Subjects' : 'Mathematics; Physical Science' }
      ],
      sampleHeaders: 'name,email,phone,role_title,qualification,experience_years,ec_number,class_name,subjects',
      sampleRows: isPrimary ? [
        { name: 'Mr. Blessmore Sibanda', email: 'bsibanda@school.ac.zw', phone: '+263774567890', role_title: 'Senior Teacher', qualification: 'Dip.Ed Primary', experience_years: '12', ec_number: 'EC-842109', class_name: primaryClasses[0], subjects: 'All Primary Subjects' },
        { name: 'Mrs. Susan Ncube', email: 'sncube@school.ac.zw', phone: '+263775678901', role_title: 'Deputy Head', qualification: 'B.Ed Primary', experience_years: '16', ec_number: 'EC-718290', class_name: primaryClasses[1], subjects: 'English; Mathematics' }
      ] : [
        { name: 'Ms. Tariro Moyo', email: 'tmoyo@school.ac.zw', phone: '+263775678901', role_title: 'Subject Teacher', qualification: 'B.A. Shona', experience_years: '4', ec_number: 'EC-934812', class_name: secondaryClasses[0], subjects: 'Shona; Heritage Studies' },
        { name: 'Mr. Tawanda Dube', email: 'tdube@school.ac.zw', phone: '+263776789012', role_title: 'HOD Sciences', qualification: 'M.Sc Education', experience_years: '15', ec_number: 'EC-718290', class_name: secondaryClasses[1], subjects: 'Mathematics; Physical Science' }
      ],
      rules: [
        'Form Master Assignment: Providing class_name immediately designates the teacher as the Form Master / Class Teacher.',
        'Subject Allocation: Subjects listed in the "subjects" column automatically link into teaching_assignments for marks entry.',
        'Auto-Generated Passwords: Secure temporary login credentials (username + password) are displayed upon successful import.'
      ]
    },
    classes: {
      title: 'Classes & Streams Specification',
      description: `Mandatory Format: Ingests school grade cohorts and room enrolment limits for ${schoolType} institution.`,
      mandatory: ['name', 'level'],
      fields: [
        { key: 'name', label: 'Class Name', required: true, type: 'Text', rule: `Unique class name (${isPrimary ? 'e.g. Grade 1' : 'e.g. Form 1'}${hasStreams ? 'A' : ''})`, example: defaultSampleClass },
        { key: 'level', label: 'Phase / Level', required: true, type: 'Text', rule: isPrimary ? 'Primary, Infant, Junior' : 'Secondary, High School', example: isPrimary ? 'Primary' : 'Secondary' },
        { key: 'capacity', label: 'Enrolment Capacity', required: false, type: 'Number', rule: 'Maximum student desks (default 45)', example: '45' },
        ...(hasStreams ? [{ key: 'stream', label: 'Stream Tag', required: false, type: 'Text', rule: 'Stream identifier (e.g. East, West, Gold, A, B)', example: 'A' }] : [])
      ],
      sampleHeaders: hasStreams ? 'name,level,capacity,stream' : 'name,level,capacity',
      sampleRows: isPrimary ? [
        hasStreams ? { name: primaryClasses[0], level: 'Primary', capacity: '40', stream: 'East' } : { name: primaryClasses[0], level: 'Primary', capacity: '40' },
        hasStreams ? { name: primaryClasses[1], level: 'Primary', capacity: '40', stream: 'Blue' } : { name: primaryClasses[1], level: 'Primary', capacity: '40' },
        hasStreams ? { name: primaryClasses[2], level: 'Primary', capacity: '45', stream: 'Gold' } : { name: primaryClasses[2], level: 'Primary', capacity: '45' }
      ] : [
        hasStreams ? { name: secondaryClasses[0], level: 'Secondary', capacity: '45', stream: 'A' } : { name: secondaryClasses[0], level: 'Secondary', capacity: '45' },
        hasStreams ? { name: secondaryClasses[1], level: 'Secondary', capacity: '45', stream: 'East' } : { name: secondaryClasses[1], level: 'Secondary', capacity: '45' },
        hasStreams ? { name: secondaryClasses[2], level: 'Secondary', capacity: '40', stream: 'Commercials' } : { name: secondaryClasses[2], level: 'Secondary', capacity: '40' }
      ],
      rules: [
        `Strict School Level: Only ${isPrimary ? 'Primary grades (ECD, Grade 1-7)' : 'Secondary forms (Form 1-4/6)'} are accepted.`,
        `Stream Rule: ${hasStreams ? 'Streams are enabled for this school.' : 'Streams are disabled (single-cohort only). Streamed names will be rejected.'}`
      ]
    },
    subjects: {
      title: 'Curriculum Subjects Specification',
      description: 'Mandatory Format: Registers academic subjects into the school curriculum syllabus.',
      mandatory: ['name'],
      fields: [
        { key: 'name', label: 'Subject Name', required: true, type: 'Text', rule: 'Full curriculum subject name', example: isPrimary ? 'Science and Technology' : 'Mathematics' },
        { key: 'code', label: 'Subject Code', required: false, type: 'Text', rule: 'Short 3-5 letter subject code (e.g. MATH, PHYS)', example: isPrimary ? 'SCIE' : 'MATH' },
        { key: 'category', label: 'Department / Faculty', required: false, type: 'Text', rule: 'Sciences, Languages, Commercials, Humanities, Arts', example: 'Sciences' },
        { key: 'level', label: 'Applicable Level', required: false, type: 'Text', rule: isPrimary ? 'Primary' : 'Secondary, Form 3-6, All Levels', example: isPrimary ? 'Primary' : 'Secondary' }
      ],
      sampleHeaders: 'code,name,category,level',
      sampleRows: isPrimary ? [
        { code: 'ENG', name: 'English Language', category: 'Languages', level: 'Primary' },
        { code: 'MATH', name: 'Mathematics', category: 'Sciences', level: 'Primary' },
        { code: 'SHON', name: 'Indigenous Language (Shona)', category: 'Languages', level: 'Primary' },
        { code: 'SCIE', name: 'Science and Technology', category: 'Sciences', level: 'Primary' }
      ] : [
        { code: 'MATH', name: 'Mathematics', category: 'Sciences', level: 'Secondary' },
        { code: 'ENG', name: 'English Language', category: 'Languages', level: 'Secondary' },
        { code: 'PHYS', name: 'Physical Science', category: 'Sciences', level: 'Secondary' },
        { code: 'COMM', name: 'Commerce', category: 'Commercials', level: 'Secondary' }
      ],
      rules: [
        'Used for timetable allocations, exam entries, and term report cards.'
      ]
    },
    assets: {
      title: 'School Assets & Inventory Specification',
      description: 'Mandatory Format: Ingests institutional equipment, computer hardware, science lab apparatus, school vehicles, and furniture.',
      mandatory: ['name'],
      fields: [
        { key: 'name', label: 'Asset Name', required: true, type: 'Text', rule: 'Equipment title or model', example: 'Dell OptiPlex 7090 Desktop' },
        { key: 'category', label: 'Category', required: false, type: 'Choice', rule: 'it_hardware, science_lab, furniture, plant_vehicle, general', example: 'it_hardware' },
        { key: 'code', label: 'Asset Tag', required: false, type: 'Text', rule: 'Unique barcode / asset tag ID. Auto-generated if blank.', example: 'AST-IT-001' },
        { key: 'serial_number', label: 'Serial Number', required: false, type: 'Text', rule: 'Hardware serial number', example: 'SN-DELL-9921' },
        { key: 'value', label: 'Purchase Value', required: false, type: 'Number', rule: 'Cost or valuation in USD', example: '650.00' },
        { key: 'location', label: 'Location', required: false, type: 'Text', rule: 'Campus building or lab room', example: 'Computer Lab 1' }
      ],
      sampleHeaders: 'name,category,code,serial_number,value,location',
      sampleRows: [
        { name: 'Dell OptiPlex 7090 Desktop', category: 'it_hardware', code: 'AST-IT-001', serial_number: 'SN-DELL-9921', value: '650.00', location: 'Computer Lab 1' },
        { name: 'Student Double Desks (Wooden)', category: 'furniture', code: 'AST-FUR-012', serial_number: 'TAG-DSK-44', value: '45.00', location: 'Block C Room 4' },
        { name: 'Compound Microscope Olympus', category: 'science_lab', code: 'AST-LAB-005', serial_number: 'SN-OLY-552', value: '380.00', location: 'Chemistry Lab' }
      ],
      rules: [
        'Assets are instantly tracked for maintenance logs, audit counts, and staff custodian checkouts.'
      ]
    },
    library: {
      title: 'Library Books & Media Catalogue Specification',
      description: 'Mandatory Format: Ingests library books, curriculum textbooks, literature sets, and past examination papers.',
      mandatory: ['name'],
      fields: [
        { key: 'name', label: 'Book Title', required: true, type: 'Text', rule: 'Full book or media title', example: 'Step Ahead: O-Level Mathematics' },
        { key: 'author', label: 'Author', required: false, type: 'Text', rule: 'Author or editor name', example: 'M. Chitsike' },
        { key: 'isbn', label: 'ISBN / Accession Barcode', required: false, type: 'Text', rule: 'ISBN or internal barcode', example: '978-0-7974-1234-5' },
        { key: 'shelf_location', label: 'Shelf Location', required: false, type: 'Text', rule: 'Library stack, bay, or shelf', example: 'Bay 1 Shelf A' },
        { key: 'resource_type', label: 'Resource Type', required: false, type: 'Choice', rule: 'textbook, revision_guide, fiction, past_paper', example: 'textbook' }
      ],
      sampleHeaders: 'name,author,isbn,shelf_location,resource_type',
      sampleRows: [
        { name: 'Step Ahead: O-Level Mathematics', author: 'M. Chitsike', isbn: '978-0-7974-1234-5', shelf_location: 'Bay 1 Shelf A', resource_type: 'textbook' },
        { name: 'Focus on Shona: Form 3 & 4', author: 'D. Mutasa', isbn: '978-0-7974-5678-9', shelf_location: 'Bay 2 Shelf C', resource_type: 'textbook' },
        { name: 'Things Fall Apart', author: 'Chinua Achebe', isbn: '978-0-3854-7454-2', shelf_location: 'Bay 4 Shelf B', resource_type: 'fiction' }
      ],
      rules: [
        'Books are categorized as "book" and immediately become available for student loans, barcode returns, and overdue tracking.'
      ]
    },
    fees: {
      title: 'Student Fee Invoices & Billing Specification',
      description: 'Mandatory Format: Ingests termly fee schedules, student invoices, and initial receipt allocations.',
      mandatory: ['admission_number', 'term', 'amount_due'],
      fields: [
        { key: 'admission_number', label: 'Admission Number', required: true, type: 'Text', rule: 'Unique student admission number (e.g. ADM2026-001) to link fee invoice', example: 'ADM2026-001' },
        { key: 'term', label: 'Billing Term', required: true, type: 'Text', rule: 'Billing term identifier (e.g. Term 1 2026)', example: 'Term 1 2026' },
        { key: 'amount_due', label: 'Amount Due ($)', required: true, type: 'Number', rule: 'Total invoice billing amount in USD', example: '450.00' },
        { key: 'amount_paid', label: 'Amount Paid ($)', required: false, type: 'Number', rule: 'Initial amount prepaid by guardian. If > 0, receipt is generated.', example: '200.00' },
        { key: 'due_date', label: 'Payment Due Date', required: false, type: 'Date', rule: 'Payment deadline in YYYY-MM-DD format', example: '2026-01-31' },
        { key: 'title', label: 'Fee Description', required: false, type: 'Text', rule: 'Invoice line description (e.g. Tuition, Science Levy)', example: 'Term 1 Tuition Fee' }
      ],
      sampleHeaders: 'admission_number,term,amount_due,amount_paid,due_date,title',
      sampleRows: [
        { admission_number: 'ADM2026-001', term: 'Term 1 2026', amount_due: '450.00', amount_paid: '450.00', due_date: '2026-01-31', title: 'Term 1 Tuition & Levies' },
        { admission_number: 'ADM2026-002', term: 'Term 1 2026', amount_due: '450.00', amount_paid: '200.00', due_date: '2026-01-31', title: 'Term 1 Tuition & Levies' },
        { admission_number: 'ADM2026-003', term: 'Term 1 2026', amount_due: '520.00', amount_paid: '0.00', due_date: '2026-01-31', title: 'Term 1 Boarding & Tuition' }
      ],
      rules: [
        'Automatic Student Matching: Maps invoices directly to students by admission number.',
        'Receipt Generation: Any amount in "amount_paid" generates an official payment receipt.'
      ]
    }
  };

  return specs[entity] || specs.students;
}

export default function ImportModal({
  isOpen,
  onClose,
  schoolId,
  entity = 'students', // 'students' | 'staff' | 'classes' | 'subjects'
  title = 'Import Records',
  invalidateKeys = []
}) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('specs'); // 'specs' | 'ingest'
  const [activeIngestMode, setActiveIngestMode] = useState('upload'); // 'upload' | 'paste'
  const [file, setFile] = useState(null);
  const [rawText, setRawText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [copiedHeaders, setCopiedHeaders] = useState(false);
  const [copiedCreds, setCopiedCreds] = useState(false);

  const { activeSchool, schools } = useAuth();
  const currentSchool = activeSchool || schools.find(s => s.id === schoolId) || { id: schoolId };

  // Active spec metadata dynamically tailored to school type & stream policy
  const spec = useMemo(() => {
    return getDynamicEntitySpec(entity, currentSchool);
  }, [entity, currentSchool]);

  // Header validation against mandatory fields
  const missingMandatoryHeaders = useMemo(() => {
    if (!previewData || !previewData.headers || previewData.headers.length === 0) return [];
    const normalizedPresent = previewData.headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '_'));
    return spec.mandatory.filter(reqKey => {
      // Check variations
      if (reqKey === 'first_name') return !normalizedPresent.some(h => ['first_name', 'firstname', 'fname', 'name'].includes(h));
      if (reqKey === 'last_name') return !normalizedPresent.some(h => ['last_name', 'lastname', 'lname', 'name'].includes(h));
      if (reqKey === 'class_name') return !normalizedPresent.some(h => ['class_name', 'classname', 'class', 'grade', 'form'].includes(h));
      if (reqKey === 'role_title') return !normalizedPresent.some(h => ['role_title', 'role', 'title', 'designation'].includes(h));
      return !normalizedPresent.includes(reqKey);
    });
  }, [previewData, spec.mandatory]);

  // Read file as text or Excel array buffer
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setParsing(true);

    const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          const csvText = XLSX.utils.sheet_to_csv(worksheet);
          setRawText(csvText);

          const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          if (rawRows.length > 0) {
            const rawHeaders = Object.keys(rawRows[0]);
            const normalizedRows = rawRows.map(row => {
              const obj = {};
              Object.entries(row).forEach(([k, v]) => {
                obj[k.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')] = String(v ?? '').trim();
              });
              return obj;
            });
            setPreviewData({ headers: rawHeaders, rows: normalizedRows });
          } else {
            setPreviewData({ headers: [], rows: [] });
          }
          setParsing(false);
          setImportResult(null);
        } catch (err) {
          console.error('Excel parse error:', err);
          toast.error('Failed to parse Excel file.');
          setParsing(false);
        }
      };
      reader.onerror = () => {
        toast.error('Failed to read file.');
        setParsing(false);
      };
      reader.readAsArrayBuffer(selectedFile);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        setRawText(content);
        const parsed = parseClientTable(content);
        setPreviewData(parsed);
        setParsing(false);
        setImportResult(null);
      };
      reader.onerror = () => {
        toast.error('Failed to read file.');
        setParsing(false);
      };
      reader.readAsText(selectedFile);
    }
  };

  const handlePasteChange = (e) => {
    const val = e.target.value;
    setRawText(val);
    if (val.trim()) {
      const parsed = parseClientTable(val);
      setPreviewData(parsed);
      setImportResult(null);
    } else {
      setPreviewData(null);
    }
  };

  const handleCopyHeaders = () => {
    navigator.clipboard.writeText(spec.sampleHeaders);
    setCopiedHeaders(true);
    toast.success('CSV Headers copied to clipboard!');
    setTimeout(() => setCopiedHeaders(false), 2000);
  };

  const handleCopyCredentials = () => {
    if (!importResult?.credentials) return;
    const credText = importResult.credentials.map(c => `${c.name}: Username: ${c.username} | Password: ${c.password}`).join('\n');
    navigator.clipboard.writeText(credText);
    setCopiedCreds(true);
    toast.success('Staff credentials copied to clipboard!');
    setTimeout(() => setCopiedCreds(false), 2000);
  };

  const handleDownloadTemplate = () => {
    const headerRow = spec.sampleHeaders;
    const keys = headerRow.split(',');
    const bodyRows = spec.sampleRows.map(row => {
      return keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(',');
    }).join('\n');
    const blob = new Blob([headerRow + '\n' + bodyRows + '\n'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(currentSchool?.name || schoolId || 'school').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${entity}_template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Template for ${entity} downloaded.`);
  };

  const handleExecuteImport = async () => {
    if (!rawText.trim() && (!previewData || previewData.rows.length === 0)) {
      toast.error('No data found to import.');
      return;
    }

    if (missingMandatoryHeaders.length > 0) {
      toast.error(`Missing mandatory columns: ${missingMandatoryHeaders.join(', ')}`);
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const res = await api.post(`/schools/${schoolId}/import/${entity}`, {
        text: rawText,
        rows: previewData?.rows
      });

      const result = res.data?.data || res.data || {};
      setImportResult(result);

      if (result.imported > 0) {
        toast.success(`Successfully imported ${result.imported} ${entity}!`);
        if (invalidateKeys.length > 0) {
          invalidate(invalidateKeys);
        }
      } else {
        toast.warning('No records were imported. Please check row errors below.');
      }
    } catch (err) {
      console.error('Import execution error:', err);
      toast.error(err.response?.data?.message || err.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setRawText('');
    setPreviewData(null);
    setImportResult(null);
    setActiveTab('specs');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetState();
        onClose();
      }}
      title={title}
      size="xl"
    >
      <div className="space-y-4">
        {/* Institutional Guidelines Alert Banner */}
        <div className="p-3.5 bg-gradient-to-r from-emerald-500/10 via-brand-500/5 to-cyan-500/10 rounded-xl border border-emerald-500/30 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
          <div className="space-y-1 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-ink">Institutional Policy for {currentSchool?.name || schoolId}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                {(currentSchool?.school_type || 'secondary').toUpperCase()} SCHOOL
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                (currentSchool?.has_streams !== 0 && currentSchool?.has_streams !== false)
                  ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
              }`}>
                {(currentSchool?.has_streams !== 0 && currentSchool?.has_streams !== false) ? 'Streams Permitted' : 'Single Cohort (No Streams)'}
              </span>
            </div>
            <p className="text-muted leading-relaxed">
              {((currentSchool?.school_type || '').toLowerCase() === 'primary')
                ? 'Only ECD and Grade 1 to Grade 7 classes are permitted. Secondary Form cohorts will be rejected during validation.'
                : 'Only Secondary Form 1 to Form 4/6 classes are permitted. Primary grades (Grade 1-7) are strictly prohibited and will be rejected.'}
              {(currentSchool?.has_streams === 0 || currentSchool?.has_streams === false)
                ? ' Streams are disabled for this school: imported class names must be unstreamed (no stream letters, colors, or sections).'
                : ''}
            </p>
          </div>
        </div>

        {/* Top Header Card: Entity Description & Quick Actions */}
        <div className="p-3.5 bg-gradient-to-r from-brand-50/70 via-surface to-brand-50/40 dark:from-brand-950/40 dark:to-surface rounded-xl border border-brand-500/20 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-500/15 text-brand-700 dark:text-brand-300 uppercase tracking-wider">
                {entity.toUpperCase()} INGESTION
              </span>
              <h4 className="text-xs font-bold text-ink">
                {spec.title}
              </h4>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              {spec.description}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyHeaders}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-700 bg-surface border border-brand-500/30 rounded-lg shadow-2xs hover:bg-brand-50 dark:hover:bg-brand-950/50 transition cursor-pointer"
              title="Copy CSV Header columns to clipboard"
            >
              {copiedHeaders ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedHeaders ? 'Headers Copied' : 'Copy Headers'}</span>
            </button>

            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-brand-700 rounded-lg shadow-2xs hover:bg-brand-900 transition cursor-pointer"
              title="Download pre-formatted CSV template file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV Template</span>
            </button>
          </div>
        </div>

        {/* Primary View Switcher: 1. Format Specifications | 2. Upload & Ingest */}
        <div className="flex border-b border-line gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('specs')}
            className={`pb-2.5 transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'specs'
                ? 'border-brand-700 text-brand-700 font-bold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>1. Required Format Specification</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-brand-500/15 text-brand-700 font-mono">
              Mandatory Rules
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ingest')}
            className={`pb-2.5 transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ingest'
                ? 'border-brand-700 text-brand-700 font-bold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>2. Upload & Execute Ingestion</span>
            {previewData && previewData.rows.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono">
                {previewData.rows.length} rows ready
              </span>
            )}
          </button>
        </div>

        {/* ─── TAB 1: FORMAT SPECIFICATION VIEW ─── */}
        {activeTab === 'specs' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Critical Linking Callout for Students & Staff */}
            {entity === 'students' && (
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-950 dark:text-amber-200">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Important: Student & Guardian Linking Requirements</p>
                  <p className="text-[11px] leading-relaxed text-amber-900/80 dark:text-amber-300">
                    Students are linked directly to their class stream (<code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded font-mono">class_name</code>).
                    Providing <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded font-mono">guardian_phone</code> and <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded font-mono">guardian_email</code> provisions private parent portal accounts and automated billing links. Parents can NEVER see children other than their own.
                  </p>
                </div>
              </div>
            )}

            {entity === 'staff' && (
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-500/30 flex items-start gap-2.5 text-xs text-blue-950 dark:text-blue-200">
                <LinkIcon className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Important: Form Master & Subject Allocation Linking</p>
                  <p className="text-[11px] leading-relaxed text-blue-900/80 dark:text-blue-300">
                    The <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/50 rounded font-mono">class_name</code> column automatically assigns the teacher as the official <strong>Form Master / Class Teacher</strong> for that class.
                    The <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/50 rounded font-mono">subjects</code> column (semicolon-separated) automatically establishes <strong>Teaching Assignments</strong> so the teacher can immediately record marks and schemes of work.
                  </p>
                </div>
              </div>
            )}

            {/* Field Specification Matrix Table */}
            <div className="border border-line rounded-xl overflow-hidden bg-surface shadow-2xs">
              <div className="px-3.5 py-2 bg-canvas border-b border-line flex items-center justify-between">
                <span className="text-xs font-bold text-ink uppercase tracking-wider">
                  Field Specification Matrix
                </span>
                <span className="text-[11px] text-muted">
                  {spec.fields.length} supported columns ({spec.mandatory.length} mandatory)
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-canvas/50 border-b border-line sticky top-0">
                    <tr>
                      <th className="p-2.5 font-semibold text-muted text-[11px]">Column Name</th>
                      <th className="p-2.5 font-semibold text-muted text-[11px]">Requirement</th>
                      <th className="p-2.5 font-semibold text-muted text-[11px]">Data Type & Rule</th>
                      <th className="p-2.5 font-semibold text-muted text-[11px]">Example Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {spec.fields.map((f, idx) => (
                      <tr key={idx} className="hover:bg-canvas/40 transition">
                        <td className="p-2.5 font-mono font-semibold text-ink">
                          <code>{f.key}</code>
                        </td>
                        <td className="p-2.5">
                          {f.required ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-danger/15 text-danger font-mono uppercase tracking-wider">
                              Required
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-muted dark:bg-neutral-800 font-mono uppercase tracking-wider">
                              Optional
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-muted max-w-xs">
                          <div className="text-ink font-medium text-[11px]">{f.label} ({f.type})</div>
                          <div className="text-[11px] text-muted">{f.rule}</div>
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-brand-700 dark:text-brand-300">
                          {f.example}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Realistic Sample Spreadsheet Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-ink">
                <span>Sample CSV Preview (First 3 Example Rows)</span>
                <span className="text-[11px] text-muted">Copy or download template for full schema</span>
              </div>
              <div className="border border-line rounded-xl overflow-hidden overflow-x-auto bg-surface shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-canvas border-b border-line">
                    <tr>
                      {spec.fields.map((f, idx) => (
                        <th key={idx} className="p-2 font-mono text-[11px] text-muted whitespace-nowrap">
                          {f.key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {spec.sampleRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-canvas/50">
                        {spec.fields.map((f, cIdx) => (
                          <td key={cIdx} className="p-2 text-ink font-mono text-[11px] whitespace-nowrap">
                            {row[f.key] || <span className="text-muted italic">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ready to Import Button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveTab('ingest')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition shadow-xs cursor-pointer"
              >
                <span>Proceed to Ingestion</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB 2: UPLOAD & EXECUTE INGESTION VIEW ─── */}
        {activeTab === 'ingest' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Mode Switcher */}
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setActiveIngestMode('upload')}
                className={`px-3 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                  activeIngestMode === 'upload'
                    ? 'bg-brand-50 border-brand-500/40 text-brand-700 font-bold dark:bg-brand-950/50'
                    : 'border-line text-muted hover:text-ink'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File (.xlsx, .xls, .csv, .tsv, .txt)</span>
              </button>
              <button
                onClick={() => setActiveIngestMode('paste')}
                className={`px-3 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                  activeIngestMode === 'paste'
                    ? 'bg-brand-50 border-brand-500/40 text-brand-700 font-bold dark:bg-brand-950/50'
                    : 'border-line text-muted hover:text-ink'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Paste Tabular Data (from Excel / Google Sheets)</span>
              </button>
            </div>

            {/* Ingestion Source Controls */}
            {activeIngestMode === 'upload' ? (
              <div className="border-2 border-dashed border-line rounded-xl p-5 text-center hover:border-brand-500 transition bg-canvas/30">
                <Upload className="w-7 h-7 mx-auto text-muted mb-2" />
                <p className="text-xs font-semibold text-ink mb-1">
                  {file ? file.name : 'Choose Excel (.xlsx / .xls) or CSV file or drag & drop here'}
                </p>
                <p className="text-[11px] text-muted mb-3">
                  Format must strictly conform to the specifications outlined in Tab 1
                </p>
                <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 cursor-pointer shadow-xs transition">
                  <span>Browse File</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv, .tsv, .txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink flex items-center justify-between">
                  <span>Paste Copied Table Rows from Clipboard</span>
                  <span className="text-[11px] text-muted">Respects tab-separated Excel copy</span>
                </label>
                <textarea
                  rows={5}
                  value={rawText}
                  onChange={handlePasteChange}
                  placeholder={`${spec.sampleHeaders}\n${spec.sampleRows && spec.sampleRows.length > 0 ? spec.sampleHeaders.split(',').map(h => spec.sampleRows[0][h] || '').join(',') : ''}`}
                  className="w-full text-xs font-mono p-3 rounded-xl border border-line bg-canvas focus:bg-white dark:focus:bg-surface focus:border-brand-700 focus:outline-hidden transition resize-y"
                />
              </div>
            )}

            {/* Validation Feedback on Parsed Headers */}
            {missingMandatoryHeaders.length > 0 && (
              <div className="p-3 bg-red-50/80 dark:bg-red-950/40 rounded-xl border border-red-500/30 flex items-start gap-2 text-xs text-danger">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Missing Required Columns: </span>
                  <span>Your file is missing required headers: </span>
                  <code className="font-bold">{missingMandatoryHeaders.join(', ')}</code>.
                  <span className="block mt-0.5 text-[11px] text-red-700 dark:text-red-300">
                    Please ensure the first row includes headers matching the Required Format Specification.
                  </span>
                </div>
              </div>
            )}

            {/* Live Parsing Preview */}
            {previewData && previewData.rows.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-ink">
                  <span>Parsed Records ({previewData.rows.length} rows ready)</span>
                  {missingMandatoryHeaders.length === 0 && (
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> All mandatory columns detected
                    </span>
                  )}
                </div>
                <div className="border border-line rounded-xl overflow-hidden max-h-48 overflow-y-auto bg-surface shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-canvas border-b border-line sticky top-0">
                      <tr>
                        {previewData.headers.map((h, idx) => (
                          <th key={idx} className="p-2 font-mono text-muted text-[11px] uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {previewData.rows.slice(0, 5).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-canvas/50">
                          {Object.values(row).map((val, cIdx) => (
                            <td key={cIdx} className="p-2 text-ink truncate max-w-[140px] font-mono text-[11px]">
                              {val || <span className="text-muted italic">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewData.rows.length > 5 && (
                  <p className="text-[11px] text-muted italic">
                    Showing first 5 rows of {previewData.rows.length} total detected records.
                  </p>
                )}
              </div>
            )}

            {/* Import Execution Results */}
            {importResult && (
              <div className="p-3.5 rounded-xl border border-line bg-canvas space-y-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <h5 className="text-xs font-bold text-ink">Ingestion Execution Completed</h5>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-surface rounded-lg border border-line">
                    <div className="text-base font-bold text-ink">{importResult.total_processed || 0}</div>
                    <div className="text-[10px] text-muted uppercase font-mono">Processed</div>
                  </div>
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-500/30">
                    <div className="text-base font-bold text-emerald-700 dark:text-emerald-400">{importResult.imported || 0}</div>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-mono">Imported</div>
                  </div>
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-500/30">
                    <div className="text-base font-bold text-amber-700 dark:text-amber-400">{importResult.skipped || 0}</div>
                    <div className="text-[10px] text-amber-700 dark:text-amber-300 uppercase font-mono">Skipped</div>
                  </div>
                </div>

                {/* Generated Accounts & Credentials Display (Staff or Parents) */}
                {importResult.credentials && importResult.credentials.length > 0 && (
                  <div className="p-3 bg-surface rounded-xl border border-line space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-accent" />
                        <span>
                          {entity === 'students'
                            ? `Generated Parent Portal Accounts (${importResult.credentials.length})`
                            : `Generated Staff User Accounts (${importResult.credentials.length})`}
                        </span>
                      </div>
                      <button
                        onClick={handleCopyCredentials}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-brand-700 bg-canvas border border-line rounded-lg hover:bg-surface transition cursor-pointer"
                      >
                        {copiedCreds ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedCreds ? 'Copied' : 'Copy All Credentials'}</span>
                      </button>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[11px]">
                      {importResult.credentials.map((c, i) => (
                        <div key={i} className="flex items-center justify-between py-1 px-2 rounded-lg bg-canvas border border-line/60">
                          <span className="font-sans font-medium text-ink">
                            {c.name} {c.student ? `(Child: ${c.student})` : `(${c.role})`}
                          </span>
                          <span className="text-brand-700 dark:text-brand-300">
                            User: <strong>{c.username}</strong> | Pass: <strong>{c.password}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ingestion Errors List */}
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="text-xs space-y-1 text-danger">
                    <div className="font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Row Warnings ({importResult.errors.length}):
                    </div>
                    <ul className="list-disc pl-5 text-[11px] max-h-24 overflow-y-auto space-y-0.5 font-mono">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>Row {err.row}: {err.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Modal Execution Buttons */}
            <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-line">
              <button
                onClick={() => setActiveTab('specs')}
                className="text-xs text-muted hover:text-ink font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Review Format Specifications</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    resetState();
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition cursor-pointer"
                >
                  {importResult?.imported > 0 ? 'Close' : 'Cancel'}
                </button>
                <button
                  onClick={handleExecuteImport}
                  disabled={importing || !previewData || previewData.rows.length === 0 || missingMandatoryHeaders.length > 0}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Ingesting Records...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      Ingest {previewData?.rows.length || 0} Records
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
