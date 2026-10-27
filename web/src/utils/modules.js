// ─── Module & Page Permissions Engine for SchoolBase ─────────────────────────────
// Defines compulsory vs. optional school modules, boarding isolation, and route mapping.

export const COMPULSORY_MODULES = [
  { id: 'dashboard', label: 'Dashboard & Cockpit', description: 'Real-time administrative KPIs, alerts, and operational telemetry' },
  { id: 'students', label: 'Student Directory & Profiles', description: 'Student rosters, emergency records, enrollments, and guardians' },
  { id: 'staff', label: 'Staff Roster & Faculty', description: 'Faculty registry, teacher assignments, and staff profiles' },
  { id: 'classes', label: 'Classes & Curriculum Subjects', description: 'Class rosters, grade levels, streams, and subject catalog' },
  { id: 'attendance', label: 'Attendance Registers', description: 'Daily morning roll calls, session absence tracking, and reports' },
  { id: 'grades', label: 'Gradebook & Marks Entry', description: 'Continuous assessment tracking, score entries, and class rankings' },
  { id: 'results', label: 'Results & Report Cards', description: 'Termly report cards, comment banks, transcripts, and analytics' },
  { id: 'users', label: 'User & Account Management', description: 'System credentials, role permissions, and password recovery' },
  { id: 'security', label: 'Security & User Profile', description: 'Account settings, password management, and personal profile' }
];

export const COMPULSORY_MODULE_IDS = COMPULSORY_MODULES.map(m => m.id);

export const CONFIGURABLE_MODULES = [
  {
    id: 'boarding',
    label: 'Boarding & Hostels',
    shortLabel: 'Boarding',
    description: 'Hostel dormitories, bed allocation, house points, exeat permits & warden dashboard',
    category: 'Boarding & Facilities',
    dependsOnBoarding: true,
    routes: ['/hostels', '/boarding/exeats', '/boarding/dashboard', '/boarding/allocations', '/boarding/houses', '/admin/boarding', '/parent/exeats']
  },
  {
    id: 'exams',
    label: 'Examinations & ZIMSEC Desk',
    shortLabel: 'Examinations',
    description: 'Exam series, timetable schedules, mark verification, candidate desk & ZIMSEC portal',
    category: 'Academics',
    routes: ['/exams', '/zimsec/portal', '/admin/exams', '/admin/exam-entries']
  },
  {
    id: 'fees',
    label: 'Fees & Cashier Ledger',
    shortLabel: 'Fees & Cashier',
    description: 'Multi-currency invoicing, cashier collections, receipt generation, reconciliation & debtors',
    category: 'Finance',
    routes: ['/fees', '/finance/dashboard', '/finance/fee-structures', '/finance/invoices', '/finance/payments', '/parent/fees/pay']
  },
  {
    id: 'expenses',
    label: 'School Expenses & Procurement',
    shortLabel: 'Expenses',
    description: 'Operational expenses, petty cash, requisition approvals, and expenditure breakdown',
    category: 'Finance',
    routes: ['/expenses', '/finance/expenses']
  },
  {
    id: 'enquiries',
    label: 'Admissions & Enquiries Pipeline',
    shortLabel: 'Enquiries',
    description: 'Prospective student intake, admissions pipeline, applicant notes, and conversion tracking',
    category: 'Administration',
    routes: ['/enquiries', '/admin/admissions']
  },
  {
    id: 'timetable',
    label: 'Timetable & Room Scheduling',
    shortLabel: 'Timetable',
    description: 'Bell schedules, classroom allocations, master teacher timetables, and calendars',
    category: 'Academics',
    routes: ['/timetable', '/calendar', '/teacher/timetable', '/admin/timetable', '/admin/calendar']
  },
  {
    id: 'schemes',
    label: 'Schemes of Work',
    shortLabel: 'Schemes of Work',
    description: 'Curriculum plans, weekly lesson schemes, syllabus coverage, and HOD evaluations',
    category: 'Academics',
    routes: ['/academics/schemes', '/teacher/schemes']
  },
  {
    id: 'academics_setup',
    label: 'Academic Setup & Terms',
    shortLabel: 'Academic Setup',
    description: 'Academic sessions, term dates, grading threshold scales, and progression rules',
    category: 'Academics',
    routes: ['/academics/setup', '/admin/academics']
  },
  {
    id: 'health',
    label: 'Clinic & Health Records',
    shortLabel: 'Health & Clinic',
    description: 'Student medical profiles, dispensary clinic visits, allergy logs, and guidance notes',
    category: 'Welfare',
    routes: ['/health-records', '/health/dashboard', '/health/students', '/guidance/sessions']
  },
  {
    id: 'discipline',
    label: 'Discipline & Conduct',
    shortLabel: 'Discipline',
    description: 'Disciplinary incidents, corrective actions, detentions, merits, and parent notifications',
    category: 'Welfare',
    routes: ['/discipline']
  },
  {
    id: 'leave',
    label: 'Staff Leave Requests',
    shortLabel: 'Leave Requests',
    description: 'Faculty leave submissions, relief teacher assignments, and headmaster approvals',
    category: 'Administration',
    routes: ['/leave-requests']
  },
  {
    id: 'library',
    label: 'Library Catalog & Inventory',
    shortLabel: 'Library',
    description: 'Book cataloging, ISBN tracker, student borrow/return log, and overdue book alerts',
    category: 'Resources',
    routes: ['/library', '/admin/library']
  },
  {
    id: 'assets',
    label: 'Fixed Assets Registry',
    shortLabel: 'Assets',
    description: 'Physical equipment inventory, room location tracking, condition audits, and serials',
    category: 'Resources',
    routes: ['/assets']
  },
  {
    id: 'tasks',
    label: 'Staff Tasks & Reminders',
    shortLabel: 'Tasks',
    description: 'Administrative checklists, departmental action items, reminders, and deadline alerts',
    category: 'Administration',
    routes: ['/tasks']
  },
  {
    id: 'emis',
    label: 'EMIS Ministry Returns',
    shortLabel: 'EMIS Returns',
    description: 'Automated Ministry of Primary & Secondary Education statistical census returns',
    category: 'Administration',
    routes: ['/reports/emis', '/admin/reports/emis', '/admin/approvals']
  },
  {
    id: 'reporting',
    label: 'Reporting & Analytics',
    shortLabel: 'Reporting',
    description: 'Cross-module performance reports, cohort analytics, fee summaries, and data exports',
    category: 'Administration',
    routes: ['/reporting', '/admin/reports/registers', '/finance/reports']
  },
  {
    id: 'communication',
    label: 'Communication & Messaging',
    shortLabel: 'Messages & Alerts',
    description: 'Internal direct messaging, school announcements, SMS gateway alerts, and notifications',
    category: 'Communication',
    routes: ['/notifications', '/messages', '/admin/announcements']
  }
];

export const ALL_CONFIGURABLE_MODULE_IDS = CONFIGURABLE_MODULES.map(m => m.id);

/**
 * Checks if a given school operates as a boarding or dual school.
 * Non-boarding (day) schools strictly return false.
 */
export function isSchoolBoarding(school) {
  if (!school) return true; // Default fallback if context not loaded yet
  if (school.boarding_type === 'day') return false;
  if (school.is_boarding === 0 || school.is_boarding === false || school.is_boarding === '0') return false;
  return Boolean(school.is_boarding || school.boarding_type === 'boarding' || school.boarding_type === 'dual' || school.boarding_type === 'day_and_boarding');
}

/**
 * Retrieves the list of enabled module IDs for a given school.
 */
export function getSchoolEnabledModules(school) {
  const isBoarding = isSchoolBoarding(school);
  if (!school) {
    return ALL_CONFIGURABLE_MODULE_IDS.filter(id => id !== 'boarding');
  }

  let modules = null;
  if (school.enabled_modules) {
    if (Array.isArray(school.enabled_modules)) {
      modules = [...school.enabled_modules];
    } else if (typeof school.enabled_modules === 'string') {
      try {
        const parsed = JSON.parse(school.enabled_modules);
        if (Array.isArray(parsed)) modules = parsed;
      } catch (_) {}
    }
  }

  // If no custom module config found, default to all modules enabled (except boarding if not boarding)
  if (!modules) {
    modules = [...ALL_CONFIGURABLE_MODULE_IDS];
  }

  // CRITICAL RULE: Non-boarding schools must NEVER have boarding enabled
  if (!isBoarding) {
    modules = modules.filter(m => m !== 'boarding');
  }

  return modules;
}

/**
 * Checks whether a specific module ID is enabled for a given school.
 */
export function isModuleEnabled(school, moduleId) {
  if (!moduleId) return true;
  if (COMPULSORY_MODULE_IDS.includes(moduleId)) return true;
  if (moduleId === 'boarding' && !isSchoolBoarding(school)) return false;

  const enabledList = getSchoolEnabledModules(school);
  return enabledList.includes(moduleId);
}

/**
 * Checks whether a route path is accessible for a given school.
 * Maps the route to its module and verifies if enabled.
 */
export function isPathEnabled(school, path) {
  if (!path || !school) return true;
  const cleanPath = path.split('?')[0].toLowerCase().trim();

  // Special checks for boarding paths
  if (
    cleanPath.startsWith('/hostel') ||
    cleanPath.startsWith('/boarding') ||
    cleanPath === '/parent/exeats'
  ) {
    if (!isSchoolBoarding(school)) return false;
    return isModuleEnabled(school, 'boarding');
  }

  // Find if route matches any configurable module
  for (const mod of CONFIGURABLE_MODULES) {
    const matches = mod.routes.some(r => {
      const target = r.split('?')[0].toLowerCase().trim();
      return cleanPath === target || cleanPath.startsWith(target + '/');
    });
    if (matches) {
      return isModuleEnabled(school, mod.id);
    }
  }

  // Path is compulsory or public
  return true;
}
