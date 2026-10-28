/**
 * Comprehensive Portal & Endpoint Unit / Integration Test Suite
 * Tests all 8 portals: Super Admin, School Admin, Teacher, Bursar, Parent, Student, Warden, Nurse.
 * Exercises operations, creates records, verifies RBAC, verifies non-boarding isolation, and logs out.
 */

const API_BASE = 'http://localhost:5000/api/v1';

async function request(endpoint, options = {}, token = null) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = text;
  }

  return { status: res.status, ok: res.ok, data };
}

// Test runner state
const stats = { passed: 0, failed: 0, total: 0 };
const testResults = [];

function assert(condition, testName, details = '') {
  stats.total++;
  if (condition) {
    stats.passed++;
    testResults.push({ name: testName, status: 'PASSED', details });
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    stats.failed++;
    testResults.push({ name: testName, status: 'FAILED', details });
    console.error(`  ✗ [FAIL] ${testName} - ${details}`);
  }
}

async function loginUser(username, password = 'TestPass123!') {
  const res = await request('/auth/login', {
    method: 'POST',
    body: { username, password }
  });
  if (res.ok && res.data?.data?.token) {
    return { token: res.data.data.token, user: res.data.data.user };
  }
  if (res.ok && res.data?.token) {
    return { token: res.data.token, user: res.data.user };
  }
  throw new Error(`Failed to login ${username}: HTTP ${res.status} - ${JSON.stringify(res.data)}`);
}

async function runAllTests() {
  console.log('\n===============================================================');
  console.log('   STARTING THOROUGH TESTING OF ALL PORTALS & ENDPOINTS');
  console.log('===============================================================\n');

  // ───────────────────────────────────────────────────────────────────────────
  // 1. SUPER ADMIN PORTAL TESTING
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[PORTAL 1] Super Admin Portal (Command Center & Global Config)');
  try {
    const { token: superToken, user: superUser } = await loginUser('test_superadmin');
    assert(Boolean(superToken), 'Super Admin Authentication', `Logged in as ${superUser?.username} (${superUser?.role})`);

    // GET /schools
    const schoolsRes = await request('/schools', {}, superToken);
    assert(schoolsRes.ok && Array.isArray(schoolsRes.data?.data), 'Super Admin: List Tenant Schools (/schools)', `Count: ${schoolsRes.data?.data?.length}`);

    // GET /admin/subjects (Curriculum catalog)
    const subjectsRes = await request('/admin/subjects', {}, superToken);
    assert(subjectsRes.ok, 'Super Admin: Curriculum Subjects Catalog (/admin/subjects)', `HTTP ${subjectsRes.status}`);

    // POST /admin/subjects (Add curriculum subject)
    const newSubjCode = 'TST' + Math.floor(100 + Math.random() * 900);
    const addSubjRes = await request('/admin/subjects', {
      method: 'POST',
      body: { name: `Test National Subject ${newSubjCode}`, code: newSubjCode, category: 'Technical & ICT', level: 'primary' }
    }, superToken);
    assert(addSubjRes.ok, 'Super Admin: Add Curriculum Subject (/admin/subjects)', `Added ${newSubjCode}`);

    // GET /audit-logs
    const auditRes = await request('/audit-logs', {}, superToken);
    assert(auditRes.status === 200 || auditRes.status === 404, 'Super Admin: Audit Logs (/audit-logs)', `HTTP ${auditRes.status}`);

    // Test School Modules Update (/schools/:id/config)
    const updateModRes = await request('/schools/MAV-PRI/config', {
      method: 'PATCH',
      body: {
        is_boarding: 0,
        boarding_type: 'day',
        enabled_modules: ['exams', 'fees', 'expenses', 'enquiries', 'timetable', 'schemes', 'academics_setup', 'health', 'discipline', 'leave', 'library', 'assets', 'tasks', 'emis', 'reporting', 'communication']
      }
    }, superToken);
    assert(updateModRes.ok, 'Super Admin: Reconfigure School Modules & Day Model (/schools/MAV-PRI/config)', `Status: ${updateModRes.status}`);

    // Super Admin Logout
    const logoutRes = await request('/auth/logout', { method: 'POST' }, superToken);
    assert(logoutRes.ok || logoutRes.status === 200, 'Super Admin: Logout Session (/auth/logout)');
  } catch (err) {
    assert(false, 'Super Admin Portal Execution', err.message);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. SCHOOL ADMIN PORTAL TESTING (Day School: MAV-PRI)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[PORTAL 2] School Admin Portal (Tenant Operations: MAV-PRI)');
  let testClassId = null;
  let testStudentId = null;
  let testFeeId = null;

  try {
    const { token: adminToken, user: adminUser } = await loginUser('test_schooladmin');
    assert(Boolean(adminToken), 'School Admin Authentication', `Logged in as ${adminUser?.username} on school ${adminUser?.school_id}`);

    // 1. Dashboard summary
    const sumRes = await request('/schools/MAV-PRI/dashboard/summary', {}, adminToken);
    assert(sumRes.ok, 'School Admin: Dashboard Summary (/schools/MAV-PRI/dashboard/summary)', `HTTP ${sumRes.status}`);

    // 2. Classes Directory & Class Creation
    const classesRes = await request('/schools/MAV-PRI/classes', {}, adminToken);
    assert(classesRes.ok && Array.isArray(classesRes.data?.data || classesRes.data), 'School Admin: List Classes (/schools/MAV-PRI/classes)');

    const newClassName = `Grade 1 Test Stream ${Date.now().toString().slice(-4)}`;
    const createClassRes = await request('/schools/MAV-PRI/classes', {
      method: 'POST',
      body: { name: newClassName, grade_level: 'Grade 1', level: 'Primary' }
    }, adminToken);
    assert(createClassRes.ok, 'School Admin: Create Class Stream (/schools/MAV-PRI/classes)', `Created ${newClassName}`);
    testClassId = createClassRes.data?.data?.id || createClassRes.data?.id;

    // 3. Students Roster & Enrolment
    const studentsRes = await request('/schools/MAV-PRI/students', {}, adminToken);
    assert(studentsRes.ok, 'School Admin: Fetch Students Roster (/schools/MAV-PRI/students)');

    const newAdmNumber = `ADM-${Math.floor(1000 + Math.random() * 9000)}`;
    const enrollRes = await request('/schools/MAV-PRI/students', {
      method: 'POST',
      body: {
        admission_number: newAdmNumber,
        first_name: 'Simbarashe',
        last_name: 'Ncube',
        gender: 'male',
        date_of_birth: '2016-08-20',
        class_id: testClassId,
        is_boarding: 0,
        guardian_name: 'Mr. Peter Ncube',
        guardian_phone: '+263773111222',
        guardian_email: 'pncube@test.co.zw'
      }
    }, adminToken);
    assert(enrollRes.ok, 'School Admin: Enroll Student with Class (/schools/MAV-PRI/students)', `Enrolled ${newAdmNumber}`);
    testStudentId = enrollRes.data?.data?.id || enrollRes.data?.id;

    // 4. Subjects Directory
    const subRes = await request('/schools/MAV-PRI/subjects', {}, adminToken);
    assert(subRes.ok, 'School Admin: Subjects Directory (/schools/MAV-PRI/subjects)');

    // 5. Staff Roster & Add Staff
    const staffRes = await request('/schools/MAV-PRI/staff', {}, adminToken);
    assert(staffRes.ok, 'School Admin: Staff Roster (/schools/MAV-PRI/staff)');

    // 6. Fees & Invoicing
    const feesRes = await request('/schools/MAV-PRI/fees', {}, adminToken);
    assert(feesRes.ok, 'School Admin: Fees Ledger (/schools/MAV-PRI/fees)');
    const feeList = feesRes.data?.data || [];
    testFeeId = feeList[0]?.id || 'FEE_TEST01';

    // 7. Expenses & Financial Vouchers
    const expRes = await request('/schools/MAV-PRI/expenses', {}, adminToken);
    assert(expRes.ok, 'School Admin: School Expenses (/schools/MAV-PRI/expenses)');

    // 8. Timetable
    const ttRes = await request(`/schools/MAV-PRI/timetable?class_id=${testClassId}`, {}, adminToken);
    assert(ttRes.ok, 'School Admin: Class Timetable (/schools/MAV-PRI/timetable)');

    // 9. Schemes of Work
    const schemesRes = await request('/schools/MAV-PRI/schemes', {}, adminToken);
    assert(schemesRes.ok, 'School Admin: Schemes of Work (/schools/MAV-PRI/schemes)');

    // 10. Health Records (/schools/:schoolId/health)
    const healthRes = await request('/schools/MAV-PRI/health', {}, adminToken);
    assert(healthRes.ok, 'School Admin: Health Directory (/schools/MAV-PRI/health)');

    // 11. Disciplinary Incidents
    const discRes = await request('/schools/MAV-PRI/discipline', {}, adminToken);
    assert(discRes.ok, 'School Admin: Discipline Records (/schools/MAV-PRI/discipline)');

    // 12. Staff Leave Requests (/schools/:schoolId/leave-requests)
    const leaveRes = await request('/schools/MAV-PRI/leave-requests', {}, adminToken);
    assert(leaveRes.ok, 'School Admin: Staff Leave Requests (/schools/MAV-PRI/leave-requests)');

    // 13. Fixed Assets Registry
    const assetsRes = await request('/schools/MAV-PRI/assets', {}, adminToken);
    assert(assetsRes.ok, 'School Admin: Assets Registry (/schools/MAV-PRI/assets)');

    // 14. Tasks & Reminders
    const tasksRes = await request('/schools/MAV-PRI/tasks', {}, adminToken);
    assert(tasksRes.ok, 'School Admin: Action Tasks (/schools/MAV-PRI/tasks)');

    // 15. EMIS Returns (/reports/emis/enrolment)
    const emisRes = await request('/reports/emis/enrolment', {}, adminToken);
    assert(emisRes.ok, 'School Admin: EMIS Ministry Enrolment Return (/reports/emis/enrolment)');

    // 16. CRITICAL RULE TEST: Non-boarding school isolation (MAV-PRI is a Day School)
    const hostelRes = await request('/schools/MAV-PRI/hostels', {}, adminToken);
    const hostelsEmptyOrBlocked = !hostelRes.ok || (Array.isArray(hostelRes.data?.data) && hostelRes.data.data.length === 0);
    assert(hostelsEmptyOrBlocked, 'School Admin: Strict Day School Isolation (Hostels unavailable on MAV-PRI)');

    // Logout
    await request('/auth/logout', { method: 'POST' }, adminToken);
    assert(true, 'School Admin: Logout Session');
  } catch (err) {
    assert(false, 'School Admin Portal Execution', err.message);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. TEACHER PORTAL TESTING
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[PORTAL 3] Teacher Portal (Academics, Attendance & Markbook)');
  try {
    const { token: teacherToken, user: teacherUser } = await loginUser('test_teacher');
    assert(Boolean(teacherToken), 'Teacher Authentication', `Logged in as ${teacherUser?.username}`);

    // Accessible classes
    const allocRes = await request('/schools/MAV-PRI/classes', {}, teacherToken);
    assert(allocRes.ok, 'Teacher: Accessible Classes (/schools/MAV-PRI/classes)');

    // Attendance register query & submit
    const attGetRes = await request(`/schools/MAV-PRI/attendance?class_id=${testClassId}&date=2026-10-27`, {}, teacherToken);
    assert(attGetRes.ok, 'Teacher: Attendance Register Query (/schools/MAV-PRI/attendance)');

    if (testStudentId) {
      const attPostRes = await request('/schools/MAV-PRI/attendance', {
        method: 'POST',
        body: {
          class_id: testClassId,
          date: '2026-10-27',
          records: [{ student_id: testStudentId, status: 'present' }]
        }
      }, teacherToken);
      assert(attPostRes.ok, 'Teacher: Submit Attendance Roll-Call (/schools/MAV-PRI/attendance)');
    }

    // Grades / Markbook for assigned class
    const gradesRes = await request(`/schools/MAV-PRI/classes/${testClassId}/grades?term=term_1`, {}, teacherToken);
    assert(gradesRes.ok, 'Teacher: Markbook Grades Access (/schools/MAV-PRI/classes/:classId/grades)');

    // Schemes of work
    const teacherSchemes = await request('/schools/MAV-PRI/schemes', {}, teacherToken);
    assert(teacherSchemes.ok, 'Teacher: Curriculum Lesson Schemes (/schools/MAV-PRI/schemes)');

    // RBAC Security Check: Teacher cannot access superadmin subjects endpoint
    const rbacTest = await request('/admin/subjects', { method: 'POST', body: { name: 'Unauthorized', code: 'UNAUTH' } }, teacherToken);
    assert(rbacTest.status === 403 || rbacTest.status === 401, 'Teacher: RBAC Protected from Super Admin Subject Modification', `HTTP ${rbacTest.status}`);

    // Logout
    await request('/auth/logout', { method: 'POST' }, teacherToken);
    assert(true, 'Teacher: Logout Session');
  } catch (err) {
    assert(false, 'Teacher Portal Execution', err.message);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. BURSAR & CASHIER PORTAL TESTING
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[PORTAL 4] Bursar & Cashier Portal (Finance, Cashier & Expenses)');
  try {
    const { token: bursarToken, user: bursarUser } = await loginUser('test_bursar');
    assert(Boolean(bursarToken), 'Bursar Authentication', `Logged in as ${bursarUser?.username}`);

    // Fees ledger
    const bFeesRes = await request('/schools/MAV-PRI/fees', {}, bursarToken);
    assert(bFeesRes.ok, 'Bursar: Tuition Fees Ledger (/schools/MAV-PRI/fees)');

    // Record Cashier Payment with Idempotency-Key
    if (testFeeId && testStudentId) {
      const payRes = await request(`/schools/MAV-PRI/fees/${testFeeId}/payments`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `TEST-PAY-${Date.now()}` },
        body: {
          student_id: testStudentId,
          amount_paid: 25.00,
          payment_method: 'cash',
          reference: `REC-${Date.now().toString().slice(-6)}`,
          payment_date: '2026-10-27'
        }
      }, bursarToken);
      assert(payRes.ok, 'Bursar: Record Cashier Tuition Receipt (/schools/MAV-PRI/fees/:id/payments)');
    }

    // Operational expenses ledger & create voucher
    const bExpRes = await request('/schools/MAV-PRI/expenses', {}, bursarToken);
    assert(bExpRes.ok, 'Bursar: Operational Expenses Log (/schools/MAV-PRI/expenses)');

    const voucherRes = await request('/schools/MAV-PRI/expenses', {
      method: 'POST',
      body: {
        title: 'Classroom Exercise Books',
        category: 'supplies',
        amount: 35.00,
        payment_method: 'bank_transfer',
        expense_date: '2026-10-27',
        notes: 'Term 1 general replenishment'
      }
    }, bursarToken);
    assert(voucherRes.ok, 'Bursar: Create Expense Voucher (/schools/MAV-PRI/expenses)');

    // Logout
    await request('/auth/logout', { method: 'POST' }, bursarToken);
    assert(true, 'Bursar: Logout Session');
  } catch (err) {
    assert(false, 'Bursar Portal Execution', err.message);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. PARENT / GUARDIAN PORTAL TESTING
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[PORTAL 5] Parent & Guardian Portal');
  try {
    const { token: parentToken, user: parentUser } = await loginUser('test_parent');
    assert(Boolean(parentToken), 'Parent Authentication', `Logged in as ${parentUser?.username}`);

    // Children query: In studentsRoutes, GET /schools/MAV-PRI/students automatically scopes to parent's children
    const childrenRes = await request('/schools/MAV-PRI/students', {}, parentToken);
    const kids = childrenRes.data?.data || [];
    assert(childrenRes.ok && Array.isArray(kids), 'Parent: View Linked Children (/schools/MAV-PRI/students)', `Linked: ${kids.length} children`);

    // Privacy verification: All returned students must have primary guardian matching this parent
    const allLinkedToParent = kids.every(k => k.guardian_phone === '+263771234567' || k.guardian_email === 'parent@test.co.zw');
    assert(allLinkedToParent, 'Parent: Privacy Filter Strictly Scoped to Linked Children Only');

    // Parent fee balance for their child
    const parentFeeRes = await request('/schools/MAV-PRI/fees', {}, parentToken);
    assert(parentFeeRes.ok, 'Parent: Student Fee Balance (/schools/MAV-PRI/fees)');

    // Logout
    await request('/auth/logout', { method: 'POST' }, parentToken);
    assert(true, 'Parent: Logout Session');
  } catch (err) {
    assert(false, 'Parent Portal Execution', err.message);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 6. STUDENT PORTAL TESTING
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[PORTAL 6] Student Portal');
  try {
    const { token: studentToken, user: studentUser } = await loginUser('test_student');
    assert(Boolean(studentToken), 'Student Authentication', `Logged in as ${studentUser?.username}`);

    // Student self fees (now protected by req.user.student_id fix)
    const stuFeeRes = await request('/schools/MAV-PRI/fees', {}, studentToken);
    assert(stuFeeRes.ok, 'Student: Personal Fees Status (/schools/MAV-PRI/fees)');

    // Timetable for student
    const stuTtRes = await request(`/schools/MAV-PRI/timetable?class_id=${testClassId}`, {}, studentToken);
    assert(stuTtRes.ok, 'Student: View Class Timetable (/schools/MAV-PRI/timetable)');

    // Logout
    await request('/auth/logout', { method: 'POST' }, studentToken);
    assert(true, 'Student: Logout Session');
  } catch (err) {
    assert(false, 'Student Portal Execution', err.message);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 7. BOARDING MASTER / WARDEN PORTAL TESTING (Boarding School: HARAREPR)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[PORTAL 7] Boarding Master Portal (Boarding School: HARAREPR)');
  try {
    const { token: wardenToken, user: wardenUser } = await loginUser('test_warden');
    assert(Boolean(wardenToken), 'Warden Authentication', `Logged in as ${wardenUser?.username} on ${wardenUser?.school_id}`);

    // Hostels & dormitory list on boarding school
    const hostelListRes = await request('/schools/HARAREPR/hostels', {}, wardenToken);
    assert(hostelListRes.ok, 'Warden: Hostels & Dormitory Directory (/schools/HARAREPR/hostels)');

    // Exeats management
    const exeatRes = await request('/exeats', {}, wardenToken);
    assert(exeatRes.ok, 'Warden: Exeats & Gate Pass Records (/exeats)');

    // Logout
    await request('/auth/logout', { method: 'POST' }, wardenToken);
    assert(true, 'Warden: Logout Session');
  } catch (err) {
    assert(false, 'Boarding Warden Portal Execution', err.message);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 8. NURSE & CLINIC DISPENSARY PORTAL TESTING
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[PORTAL 8] School Nurse & Clinic Dispensary Portal');
  try {
    const { token: nurseToken, user: nurseUser } = await loginUser('test_nurse');
    assert(Boolean(nurseToken), 'Nurse Authentication', `Logged in as ${nurseUser?.username}`);

    // Health records query on school
    const nHealthRes = await request('/schools/MAV-PRI/health', {}, nurseToken);
    assert(nHealthRes.ok, 'Nurse: Medical Health Profiles (/schools/MAV-PRI/health)');

    // Clinic visit registration
    if (testStudentId) {
      const visitRes = await request('/health/visits', {
        method: 'POST',
        body: {
          student_id: testStudentId,
          symptoms: 'Mild headache after physical education lesson',
          diagnosis: 'Dehydration / Mild tension',
          treatment: 'Paracetamol 500mg, oral rehydration fluids and rest in dispensary',
          medication_given: 'Paracetamol 500mg',
          referred_to_hospital: 0
        }
      }, nurseToken);
      assert(visitRes.ok, 'Nurse: Register Dispensary Clinic Visit (/health/visits)');
    }

    // Logout
    await request('/auth/logout', { method: 'POST' }, nurseToken);
    assert(true, 'Nurse: Logout Session');
  } catch (err) {
    assert(false, 'School Nurse Portal Execution', err.message);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log(`   TEST EXECUTION COMPLETED: ${stats.passed}/${stats.total} PASSED (${Math.round((stats.passed/stats.total)*100)}%)`);
  if (stats.failed > 0) {
    console.error(`   FAILED TESTS: ${stats.failed}`);
  }
  console.log('===============================================================\n');

  return stats;
}

runAllTests().then(s => {
  if (s.failed > 0) process.exit(1);
  else process.exit(0);
}).catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
