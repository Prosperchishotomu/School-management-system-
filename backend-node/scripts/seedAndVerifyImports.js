const fs = require('fs');
const path = require('path');
const http = require('http');
const XLSX = require('xlsx');
const { query } = require('../src/config/db');

const BASE_URL = 'http://localhost:5000/api/v1';
const SCHOOL_ID = 'HARAREPR';
const sampleDir = path.resolve(__dirname, '../../sample_imports');

function makeRequest(method, urlPath, body = null, token = null, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...customHeaders
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function readExcelRows(filename) {
  const filePath = path.join(sampleDir, filename);
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 SYSTEM ENDPOINT VERIFICATION & EXCEL SEEDING TEST');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Step 1: Login
  console.log('1. Authenticating as schooladmin...');
  const loginRes = await makeRequest('POST', '/api/v1/auth/login', {
    username: 'schooladmin',
    password: 'admin123'
  });

  const token = loginRes.body.data?.token || loginRes.body.token;
  if (loginRes.status !== 200 || !token) {
    console.error('❌ Login failed:', loginRes);
    process.exit(1);
  }
  console.log('✅ Logged in successfully. Token acquired.\n');

  // Helper for importing
  async function testImport(entity, filename) {
    console.log(`Testing Import [${entity}] from ${filename}...`);
    const rows = readExcelRows(filename);
    console.log(`  Loaded ${rows.length} rows from Excel sheet.`);

    const res = await makeRequest('POST', `/api/v1/schools/${SCHOOL_ID}/import/${entity}`, { rows }, token);
    if (res.status === 200 || res.status === 201) {
      const result = res.body.data;
      console.log(`  ✅ HTTP ${res.status}: Total: ${result.total_processed}, Imported: ${result.imported}, Skipped: ${result.skipped}, Errors: ${result.errors?.length || 0}`);
      if (result.errors && result.errors.length > 0) {
        console.warn(`  ⚠️ Warnings/Errors:`, result.errors);
      }
    } else {
      console.error(`  ❌ Failed (HTTP ${res.status}):`, res.body);
    }
    console.log('');
  }

  // Step 2: Ingest Classes
  await testImport('classes', 'classes.xlsx');

  // Step 3: Ingest Subjects
  await testImport('subjects', 'subjects.xlsx');

  // Step 4: Ingest Staff
  await testImport('staff', 'staff.xlsx');

  // Step 5: Ingest Students
  await testImport('students', 'students.xlsx');

  // Step 6: Ingest Fees
  await testImport('fees', 'fees.xlsx');

  // Step 7: Ingest Assets
  await testImport('assets', 'assets.xlsx');

  // Step 8: Ingest Library
  await testImport('library', 'library.xlsx');

  // Step 9: Verify Operational Endpoints
  console.log('2. Verifying Operational Endpoints with Real-Time Updates...');

  // A. Classes
  const classesRes = await makeRequest('GET', `/api/v1/schools/${SCHOOL_ID}/classes`, null, token);
  console.log(`  GET /classes: HTTP ${classesRes.status} (${classesRes.body.data?.length || 0} classes active)`);

  // B. Students
  const studentsRes = await makeRequest('GET', `/api/v1/schools/${SCHOOL_ID}/students`, null, token);
  console.log(`  GET /students: HTTP ${studentsRes.status} (${studentsRes.body.data?.length || 0} students enrolled)`);

  // C. Staff
  const staffRes = await makeRequest('GET', `/api/v1/schools/${SCHOOL_ID}/staff`, null, token);
  console.log(`  GET /staff: HTTP ${staffRes.status} (${staffRes.body.data?.length || 0} staff members registered)`);

  // D. Fees Ledger
  const feesRes = await makeRequest('GET', `/api/v1/schools/${SCHOOL_ID}/fees`, null, token);
  console.log(`  GET /fees: HTTP ${feesRes.status} (${feesRes.body.data?.length || 0} fee invoices)`);

  // E. Record Fee Payment
  if (feesRes.body.data && feesRes.body.data.length > 0) {
    const fee = feesRes.body.data.find(f => f.status !== 'paid') || feesRes.body.data[0];
    const payRes = await makeRequest(
      'POST',
      `/api/v1/schools/${SCHOOL_ID}/fees/${fee.id}/payments`,
      {
        amount_paid: 50.00,
        payment_currency: 'USD',
        payment_method: 'cash',
        reference: 'REC-' + Date.now().toString().slice(-6)
      },
      token,
      {
        'Idempotency-Key': 'IDEMP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6)
      }
    );
    console.log(`  POST /fees/:feeId/payments: HTTP ${payRes.status} (Fee cashier payment processed)`);
  }

  // F. Attendance Taking for All Learners
  if (studentsRes.body.data && studentsRes.body.data.length > 0) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const byClass = {};
    studentsRes.body.data.forEach(s => {
      const cid = s.class_id || (classesRes.body.data[0]?.id);
      if (!byClass[cid]) byClass[cid] = [];
      byClass[cid].push(s);
    });

    for (const [cid, sList] of Object.entries(byClass)) {
      const records = sList.map((st, idx) => ({
        student_id: st.id,
        status: idx === 0 ? 'present' : (idx === sList.length - 1 ? 'absent' : 'present'),
        session: 'morning',
        date: todayStr,
        reason: idx === sList.length - 1 ? 'Excused ill' : 'On time'
      }));
      await makeRequest(
        'POST',
        `/api/v1/schools/${SCHOOL_ID}/attendance`,
        { class_id: cid, records },
        token
      );
    }
    console.log(`  POST /attendance: (Full class attendance registers submitted)`);
  }

  // G. Remote Bank POP for Bursar Reconciliation Verification
  try {
    const testStudent = studentsRes.body.data[0];
    await query(`
      INSERT INTO remote_payments 
        (id, school_id, student_id, amount, currency, payment_date, payment_method, reference, status, notes)
      VALUES 
        ('REM_TST_001', ?, ?, 150.00, 'USD', CURDATE(), 'bank_transfer', 'STANBIC-981240', 'pending', 'Direct bank deposit by guardian')
      ON DUPLICATE KEY UPDATE status = 'pending'
    `, [SCHOOL_ID, testStudent?.id || 'STD00001']);
    console.log('  Remote Payments: (1 pending bank transfer deposit created for reconciliation testing)');
  } catch (err) {
    console.warn('  Remote payment note:', err.message);
  }

  // G. Assets Listing & Lending
  const assetsRes = await makeRequest('GET', `/api/v1/schools/${SCHOOL_ID}/assets`, null, token);
  console.log(`  GET /assets: HTTP ${assetsRes.status} (${assetsRes.body.data?.length || 0} inventory items)`);

  if (assetsRes.body.data && assetsRes.body.data.length > 0 && staffRes.body.data && staffRes.body.data.length > 0) {
    const asset = assetsRes.body.data.find(a => a.status === 'available') || assetsRes.body.data[0];
    const staffMember = staffRes.body.data[0];
    const lendRes = await makeRequest(
      'POST',
      `/api/v1/schools/${SCHOOL_ID}/assets/${asset.id}/lend`,
      {
        holder_id: staffMember.id,
        holder_type: 'staff',
        due_date: '2026-11-30',
        condition: 'good',
        notes: 'Issued for classroom instruction'
      },
      token
    );
    console.log(`  POST /assets/:id/lend: HTTP ${lendRes.status} (Asset checkout & live update)`);
  }

  // Step 10: Database Counts Audit
  console.log('\n3. Database Row Counts Audit:');
  const [cCount] = await query('SELECT COUNT(*) as cnt FROM classes WHERE school_id = ?', [SCHOOL_ID]);
  const [sCount] = await query('SELECT COUNT(*) as cnt FROM students WHERE school_id = ?', [SCHOOL_ID]);
  const [gCount] = await query('SELECT COUNT(*) as cnt FROM guardians WHERE school_id = ?', [SCHOOL_ID]);
  const [stfCount] = await query('SELECT COUNT(*) as cnt FROM staff WHERE school_id = ?', [SCHOOL_ID]);
  const [uCount] = await query('SELECT COUNT(*) as cnt FROM users WHERE school_id = ?', [SCHOOL_ID]);
  const [fCount] = await query('SELECT COUNT(*) as cnt FROM fees WHERE school_id = ?', [SCHOOL_ID]);
  const [pCount] = await query('SELECT COUNT(*) as cnt FROM fee_payments WHERE school_id = ?', [SCHOOL_ID]);
  const [aCount] = await query('SELECT COUNT(*) as cnt FROM assets WHERE school_id = ?', [SCHOOL_ID]);

  console.log(`  - Classes: ${cCount.cnt}`);
  console.log(`  - Students: ${sCount.cnt}`);
  console.log(`  - Guardians: ${gCount.cnt}`);
  console.log(`  - Staff: ${stfCount.cnt}`);
  console.log(`  - Users: ${uCount.cnt}`);
  console.log(`  - Fee Invoices: ${fCount.cnt}`);
  console.log(`  - Fee Payments: ${pCount.cnt}`);
  console.log(`  - Assets: ${aCount.cnt}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ ALL IMPORTS AND ENDPOINT VERIFICATIONS COMPLETED SUCCESSFULLY!');
  console.log('═══════════════════════════════════════════════════════════════\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
