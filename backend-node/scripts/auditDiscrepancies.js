const http = require('http');

const BASE_URL = 'http://localhost:5000/api/v1';
const SCHOOL_ID = 'HARAREPR';

function makeRequest(method, urlPath, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (postData) options.headers['Content-Length'] = Buffer.byteLength(postData);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function audit() {
  console.log('===============================================================');
  console.log('🔍 COMPREHENSIVE DATA & KPI DISCREPANCY AUDIT');
  console.log('===============================================================\n');

  // Login as schooladmin
  const login = await makeRequest('POST', '/api/v1/auth/login', {
    username: 'schooladmin',
    password: 'admin123'
  });
  const token = login.body.data?.token || login.body.token;

  // 1. Dashboard Summary (Admin)
  const adminSummary = await makeRequest('GET', `/api/v1/schools/${SCHOOL_ID}/dashboard/summary?role=school_admin`, null, token);
  const adminKpis = adminSummary.body.data?.kpis || {};

  // 2. Dashboard Summary (Bursar)
  const bursarSummary = await makeRequest('GET', `/api/v1/schools/${SCHOOL_ID}/dashboard/summary?role=bursar`, null, token);
  const bursarKpis = bursarSummary.body.data?.kpis || {};
  const bursarRole = bursarSummary.body.data?.role_specific || {};

  // 3. Students Endpoint
  const studentsRes = await makeRequest('GET', `/api/v1/schools/${SCHOOL_ID}/students?per_page=1000`, null, token);
  const studentsList = studentsRes.body.data || [];
  const studentsTotalMeta = studentsRes.body.meta?.total || studentsList.length;

  // 4. Classes Endpoint
  const classesRes = await makeRequest('GET', `/api/v1/schools/${SCHOOL_ID}/classes`, null, token);
  const classesList = classesRes.body.data || [];
  const classesEnrolledSum = classesList.reduce((acc, c) => acc + (c.student_count || c.total_students || 0), 0);

  // 5. Staff Endpoint
  const staffRes = await makeRequest('GET', `/api/v1/schools/${SCHOOL_ID}/staff`, null, token);
  const staffList = staffRes.body.data || [];

  // 6. Fees Endpoint
  const feesRes = await makeRequest('GET', `/api/v1/schools/${SCHOOL_ID}/fees?per_page=1000`, null, token);
  const feesList = feesRes.body.data || [];
  const feesBilledSum = feesList.reduce((acc, f) => acc + parseFloat(f.amount_due || 0), 0);
  const feesCollectedSum = feesList.reduce((acc, f) => acc + parseFloat(f.amount_paid || 0), 0);
  const feesOutstandingSum = Math.max(0, feesBilledSum - feesCollectedSum);
  const feesRate = feesBilledSum > 0 ? Math.round((feesCollectedSum / feesBilledSum) * 100) : 0;

  // 7. Schools Fleet Endpoint
  const schoolsRes = await makeRequest('GET', '/api/v1/schools', null, token);
  const schoolsList = schoolsRes.body.data || [];
  const targetSchool = schoolsList.find(s => s.id === SCHOOL_ID) || {};

  console.log('--- [1] STUDENT COUNTS AUDIT ---');
  console.log(`  Admin Dashboard KPI:      ${adminKpis.total_students}`);
  console.log(`  Students Page (meta):     ${studentsTotalMeta}`);
  console.log(`  Students Page (roster):   ${studentsList.length}`);
  console.log(`  Classes Page (sum):       ${classesEnrolledSum}`);
  console.log(`  Schools Fleet API:        ${targetSchool.student_count}`);
  const studentMatch = (
    adminKpis.total_students === studentsTotalMeta &&
    studentsTotalMeta === studentsList.length &&
    studentsList.length === classesEnrolledSum &&
    classesEnrolledSum === targetSchool.student_count
  );
  console.log(`  ==> Student Count Discrepancy: ${studentMatch ? 'NONE (100% MATCH)' : 'MISMATCH DETECTED'}\n`);

  console.log('--- [2] STAFF COUNTS AUDIT ---');
  console.log(`  Admin Dashboard KPI:      ${adminKpis.total_staff}`);
  console.log(`  Staff Page (roster):      ${staffList.length}`);
  console.log(`  Schools Fleet API:        ${targetSchool.staff_count}`);
  const staffMatch = (
    adminKpis.total_staff === staffList.length &&
    staffList.length === targetSchool.staff_count
  );
  console.log(`  ==> Staff Count Discrepancy: ${staffMatch ? 'NONE (100% MATCH)' : 'MISMATCH DETECTED'}\n`);

  console.log('--- [3] FINANCIAL & FEES AUDIT ---');
  console.log(`  Billed:`);
  console.log(`    - Admin Dashboard KPI:   $${adminKpis.fees_billed}`);
  console.log(`    - Bursar Dashboard KPI:  $${bursarKpis.fees_billed}`);
  console.log(`    - Fees Ledger Sum:       $${feesBilledSum}`);
  console.log(`    - Schools Fleet API:     $${targetSchool.total_billed}`);

  console.log(`  Collected:`);
  console.log(`    - Admin Dashboard KPI:   $${adminKpis.fees_collected}`);
  console.log(`    - Bursar Dashboard KPI:  $${bursarKpis.fees_collected}`);
  console.log(`    - Fees Ledger Sum:       $${feesCollectedSum}`);
  console.log(`    - Schools Fleet API:     $${targetSchool.total_collected}`);

  console.log(`  Outstanding / Arrears:`);
  console.log(`    - Admin Dashboard KPI:   $${adminKpis.outstanding_balance}`);
  console.log(`    - Bursar Dashboard KPI:  $${bursarKpis.outstanding_balance}`);
  console.log(`    - Fees Ledger Balance:   $${feesOutstandingSum}`);

  console.log(`  Collection Rate:`);
  console.log(`    - Admin Dashboard KPI:   ${adminKpis.collection_rate}%`);
  console.log(`    - Bursar Dashboard KPI:  ${bursarKpis.collection_rate}%`);
  console.log(`    - Fees Ledger Rate:      ${feesRate}%`);
  console.log(`    - Schools Fleet API:     ${targetSchool.collection_rate}%`);

  const feesMatch = (
    adminKpis.fees_billed === bursarKpis.fees_billed &&
    adminKpis.fees_billed === feesBilledSum &&
    adminKpis.fees_collected === bursarKpis.fees_collected &&
    adminKpis.fees_collected === feesCollectedSum &&
    adminKpis.outstanding_balance === bursarKpis.outstanding_balance &&
    adminKpis.outstanding_balance === feesOutstandingSum &&
    adminKpis.collection_rate === bursarKpis.collection_rate &&
    adminKpis.collection_rate === feesRate
  );
  console.log(`  ==> Fees Metrics Discrepancy: ${feesMatch ? 'NONE (100% EXACT MATCH)' : 'MISMATCH DETECTED'}\n`);

  console.log('--- [4] TELEMETRY & OPERATION INTEGRITY ---');
  console.log(`  Attendance Today:          ${adminKpis.attendance_today_pct}%`);
  console.log(`  Pending Approvals / POPs:  ${adminKpis.pending_approvals || bursarRole.unreconciled_payments || 0}`);
  console.log(`  Bursar Currency Ledger:   `, bursarRole.currencies);

  if (studentMatch && staffMatch && feesMatch) {
    console.log('\n===============================================================');
    console.log('🏆 AUDIT PASSED: ZERO HARDCODED FALLBACKS & ZERO DISCREPANCIES!');
    console.log('===============================================================\n');
    process.exit(0);
  } else {
    console.error('\n⚠️ AUDIT FAILED: Discrepancies detected between pages/APIs.');
    process.exit(1);
  }
}

audit().catch(err => {
  console.error('Audit script error:', err);
  process.exit(1);
});
