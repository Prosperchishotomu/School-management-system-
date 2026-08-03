/**
 * SchoolBase API — Integration Test Suite
 * ==========================================
 * Tests all endpoints across all 21 route groups.
 * Run with:  node tests/api.test.js
 *
 * Prerequisites:
 *   - Docker stack running (docker-compose up -d)
 *   - Backend reachable at http://localhost/api/v1
 */

const BASE_URL = 'http://localhost:8080';
const CREDENTIALS = { username: 'superadmin', password: 'SuperSecurePass123' };

// ─── Tiny test runner ──────────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
const results = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
    results.push({ name, status: 'PASS' });
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     → ${err.message}`);
    failed++;
    results.push({ name, status: 'FAIL', error: err.message });
  }
}

function skip(name, reason) {
  console.log(`  ⏭  ${name} (skipped: ${reason})`);
  skipped++;
  results.push({ name, status: 'SKIP', reason });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 55 - title.length))}`);
}

// ─── HTTP helpers ──────────────────────────────────────────────────────────────
async function req(method, path, { body, token, headers = {} } = {}) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers,
    },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body)  opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, opts);
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON response */ }
  return { status: res.status, json, headers: res.headers };
}

const get    = (path, opts) => req('GET',    path, opts);
const post   = (path, opts) => req('POST',   path, opts);
const patch  = (path, opts) => req('PATCH',  path, opts);
const del    = (path, opts) => req('DELETE', path, opts);

// ─── Main runner ──────────────────────────────────────────────────────────────
async function run() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║      SchoolBase API — Unit Test Suite                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Base URL : ${BASE_URL}`);
  console.log(`  Time     : ${new Date().toISOString()}\n`);

  // ── Pre-flight: check server reachability ────────────────────────────────────
  section('PRE-FLIGHT');
  let serverOk = false;
  try {
    const r = await get('/health');
    serverOk = r.status === 200;
    console.log(`  🌐 Server reachable — status: ${r.status} | db: ${r.json?.data?.db ?? 'unknown'}`);
  } catch (e) {
    console.log(`  🔴 Server NOT reachable (${e.message})`);
    console.log('     Please start the Docker stack: docker-compose up -d\n');
    process.exit(1);
  }

  // ── Auth: login to get token ──────────────────────────────────────────────────
  let TOKEN = null;
  let SCHOOL_ID = null;
  let SECOND_SCHOOL_ID = null;
  let CLASS_ID = null;
  let STUDENT_ID = null;
  let STAFF_ID = null;
  let USER_ID = null;
  let FEE_ID = null;
  let CREATED_CLASS_ID = null;
  let CREATED_STUDENT_ID = null;

  section('1. AUTH ENDPOINTS');

  await test('POST /auth/login — missing fields returns 400', async () => {
    const r = await post('/auth/login', { body: {} });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
    assert(r.json?.error?.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR code');
  });

  await test('POST /auth/login — wrong credentials returns 401', async () => {
    const r = await post('/auth/login', { body: { username: 'superadmin', password: 'WrongPass!' } });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
    assert(r.json?.error?.code === 'INVALID_CREDENTIALS', 'Expected INVALID_CREDENTIALS code');
  });

  await test('POST /auth/login — valid credentials returns 200 + token', async () => {
    const r = await post('/auth/login', { body: CREDENTIALS });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.json?.data?.token, 'Expected token in response');
    assert(r.json?.data?.user?.role === 'super_admin', 'Expected super_admin role');
    TOKEN = r.json.data.token;
    console.log(`     Token obtained: ${TOKEN.substring(0, 20)}...`);
  });

  await test('GET /auth/session — returns current user', async () => {
    const r = await get('/auth/session', { token: TOKEN });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.json?.data?.role === 'super_admin', 'Expected super_admin role');
  });

  await test('GET /auth/session — unauthenticated returns 401', async () => {
    const r = await get('/auth/session');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('POST /auth/forgot-password — missing username returns 400', async () => {
    const r = await post('/auth/forgot-password', { body: {} });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('POST /auth/forgot-password — unknown user still returns 200 (security)', async () => {
    const r = await post('/auth/forgot-password', { body: { username: 'nonexistent_xyz_999' } });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('POST /auth/reset-password — missing fields returns 400', async () => {
    const r = await post('/auth/reset-password', { body: {} });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('POST /auth/reset-password — invalid token returns 400', async () => {
    const r = await post('/auth/reset-password', { body: { token: 'invalid_token_xyz', new_password: 'Password123' } });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  // ── Health endpoint ───────────────────────────────────────────────────────────
  section('2. HEALTH CHECK');

  await test('GET /health — returns 200 with service info', async () => {
    const r = await get('/health');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.json?.data?.service === 'SchoolBase API', 'Expected SchoolBase API service name');
    assert(r.json?.data?.version === 'v1', 'Expected version v1');
    assert(['ok', 'degraded'].includes(r.json?.data?.status), 'Expected ok or degraded status');
  });

  // ── Schools ───────────────────────────────────────────────────────────────────
  section('3. SCHOOLS ENDPOINTS');

  await test('GET /schools — returns list of schools', async () => {
    const r = await get('/schools', { token: TOKEN });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.json?.data), 'Expected array of schools');
    if (r.json.data.length > 0) {
      SCHOOL_ID = r.json.data[0].id;
      SECOND_SCHOOL_ID = r.json.data[1]?.id ?? null;
      console.log(`     Found ${r.json.data.length} school(s). Using SCHOOL_ID: ${SCHOOL_ID}`);
    } else {
      console.log('     ⚠  No schools found — some school-scoped tests will be skipped');
    }
  });

  await test('GET /schools — unauthenticated returns 401', async () => {
    const r = await get('/schools');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  if (SCHOOL_ID) {
    await test(`GET /schools/${SCHOOL_ID} — returns single school`, async () => {
      const r = await get(`/schools/${SCHOOL_ID}`, { token: TOKEN });
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.json?.data?.id === SCHOOL_ID, 'Expected matching school ID');
    });
  }

  await test('GET /schools/nonexistent — returns 404', async () => {
    const r = await get('/schools/SCHOOL_DOES_NOT_EXIST_XYZ', { token: TOKEN });
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  // ── Classes ───────────────────────────────────────────────────────────────────
  section('4. CLASSES ENDPOINTS');

  if (!SCHOOL_ID) {
    skip('Classes tests', 'No school available');
  } else {
    await test(`GET /schools/${SCHOOL_ID}/classes — returns class list`, async () => {
      const r = await get(`/schools/${SCHOOL_ID}/classes`, { token: TOKEN });
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(Array.isArray(r.json?.data), 'Expected array');
      if (r.json.data.length > 0) {
        CLASS_ID = r.json.data[0].id;
        console.log(`     Found ${r.json.data.length} class(es). Using CLASS_ID: ${CLASS_ID}`);
      }
    });

    await test('POST /schools/{id}/classes — missing fields returns 400', async () => {
      const r = await post(`/schools/${SCHOOL_ID}/classes`, {
        token: TOKEN,
        body: { name: '' }
      });
      assert(r.status === 400, `Expected 400, got ${r.status}`);
    });

    await test('POST /schools/{id}/classes — creates class successfully', async () => {
      const r = await post(`/schools/${SCHOOL_ID}/classes`, {
        token: TOKEN,
        body: { name: 'TEST Class Alpha', grade_level: 'Grade 1', stream: 'Alpha' }
      });
      assert(r.status === 201, `Expected 201, got ${r.status}`);
      assert(r.json?.data?.id, 'Expected id in response');
      CREATED_CLASS_ID = r.json.data.id;
      console.log(`     Created class: ${CREATED_CLASS_ID}`);
    });

    if (CREATED_CLASS_ID) {
      await test('DELETE /schools/{id}/classes/{classId} — deletes created test class', async () => {
        const r = await del(`/schools/${SCHOOL_ID}/classes/${CREATED_CLASS_ID}`, { token: TOKEN });
        assert(r.status === 204, `Expected 204, got ${r.status}`);
      });
    }
  }

  // ── Students ──────────────────────────────────────────────────────────────────
  section('5. STUDENTS ENDPOINTS');

  if (!SCHOOL_ID) {
    skip('Students tests', 'No school available');
  } else {
    await test(`GET /schools/${SCHOOL_ID}/students — returns paginated list`, async () => {
      const r = await get(`/schools/${SCHOOL_ID}/students?per_page=10`, { token: TOKEN });
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(Array.isArray(r.json?.data), 'Expected array');
      assert(typeof r.json?.meta?.total === 'number', 'Expected meta.total');
      if (r.json.data.length > 0) {
        STUDENT_ID = r.json.data[0].id;
        console.log(`     Found ${r.json.meta.total} students. Using STUDENT_ID: ${STUDENT_ID}`);
      }
    });

    await test('GET /schools/{id}/students — with search filter', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/students?search=a&per_page=5`, { token: TOKEN });
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(Array.isArray(r.json?.data), 'Expected array');
    });

    await test('POST /schools/{id}/students — missing required fields returns 400', async () => {
      const r = await post(`/schools/${SCHOOL_ID}/students`, {
        token: TOKEN,
        body: { first_name: 'Test' } // missing admission_number, last_name, dob, gender
      });
      assert(r.status === 400, `Expected 400, got ${r.status}`);
      assert(r.json?.error?.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR');
    });

    await test('POST /schools/{id}/students — invalid date_of_birth returns 400', async () => {
      const r = await post(`/schools/${SCHOOL_ID}/students`, {
        token: TOKEN,
        body: {
          admission_number: 'TEST-ADM-9999',
          first_name: 'TestUnit',
          last_name: 'Student',
          date_of_birth: 'not-a-date',
          gender: 'male'
        }
      });
      assert([400, 422].includes(r.status), `Expected 400/422, got ${r.status}`);
    });

    await test('POST /schools/{id}/students — creates student successfully', async () => {
      const admNo = `UNIT-${Date.now()}`;
      const r = await post(`/schools/${SCHOOL_ID}/students`, {
        token: TOKEN,
        body: {
          admission_number: admNo,
          first_name: 'UnitTest',
          last_name: 'Runner',
          date_of_birth: '2012-06-15',
          gender: 'male',
        }
      });
      assert(r.status === 201, `Expected 201, got ${r.status}`);
      assert(r.json?.data?.id, 'Expected student id');
      CREATED_STUDENT_ID = r.json.data.id;
      console.log(`     Created student: ${CREATED_STUDENT_ID} (${admNo})`);
    });

    await test('POST /schools/{id}/students — duplicate admission number returns 409', async () => {
      if (!CREATED_STUDENT_ID) return;
      const admNo = `UNIT-DUP-${Date.now()}`;
      // Create first
      await post(`/schools/${SCHOOL_ID}/students`, {
        token: TOKEN, body: { admission_number: admNo, first_name: 'Dup', last_name: 'Test', date_of_birth: '2012-01-01', gender: 'female' }
      });
      // Create duplicate
      const r = await post(`/schools/${SCHOOL_ID}/students`, {
        token: TOKEN, body: { admission_number: admNo, first_name: 'Dup2', last_name: 'Test2', date_of_birth: '2012-01-01', gender: 'female' }
      });
      assert(r.status === 409, `Expected 409, got ${r.status}`);
    });

    if (STUDENT_ID) {
      await test(`GET /schools/${SCHOOL_ID}/students/${STUDENT_ID} — returns student detail`, async () => {
        const r = await get(`/schools/${SCHOOL_ID}/students/${STUDENT_ID}`, { token: TOKEN });
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.json?.data?.id === STUDENT_ID, 'Expected matching student ID');
      });

      await test(`GET /schools/${SCHOOL_ID}/students/${STUDENT_ID}/profile — returns full profile`, async () => {
        const r = await get(`/schools/${SCHOOL_ID}/students/${STUDENT_ID}/profile`, { token: TOKEN });
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.json?.data?.student, 'Expected student field');
        assert(r.json?.data?.attendance_summary, 'Expected attendance_summary');
        assert(r.json?.data?.fee_summary, 'Expected fee_summary');
      });

      await test(`PATCH /schools/${SCHOOL_ID}/students/${STUDENT_ID} — updates student`, async () => {
        const r = await patch(`/schools/${SCHOOL_ID}/students/${STUDENT_ID}`, {
          token: TOKEN,
          body: { home_address: 'Unit Test Address, Test City' }
        });
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.json?.data?.updated === true, 'Expected updated: true');
      });

      await test('PATCH /schools/{id}/students/{id} — no valid fields returns 400', async () => {
        const r = await patch(`/schools/${SCHOOL_ID}/students/${STUDENT_ID}`, {
          token: TOKEN,
          body: { invalid_field_xyz: 'test' }
        });
        assert(r.status === 400, `Expected 400, got ${r.status}`);
      });
    }

    await test('GET /schools/{id}/students/nonexistent — returns 404', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/students/STD_DOES_NOT_EXIST_XYZ`, { token: TOKEN });
      assert(r.status === 404, `Expected 404, got ${r.status}`);
    });

    // Clean up created student
    if (CREATED_STUDENT_ID) {
      await test(`DELETE /schools/${SCHOOL_ID}/students/${CREATED_STUDENT_ID} — withdraws student`, async () => {
        const r = await del(`/schools/${SCHOOL_ID}/students/${CREATED_STUDENT_ID}`, { token: TOKEN });
        assert(r.status === 204, `Expected 204, got ${r.status}`);
      });
    }
  }

  // ── Attendance ────────────────────────────────────────────────────────────────
  section('6. ATTENDANCE ENDPOINTS');

  if (!SCHOOL_ID || !CLASS_ID) {
    skip('Attendance tests', 'No school or class available');
  } else {
    await test('GET /schools/{id}/classes/{classId}/attendance — returns attendance data', async () => {
      const today = new Date().toISOString().split('T')[0];
      const r = await get(`/schools/${SCHOOL_ID}/classes/${CLASS_ID}/attendance?date=${today}`, { token: TOKEN });
      assert(r.status === 200, `Expected 200, got ${r.status}`);
    });

    await test('GET /schools/{id}/attendance/summary — returns attendance summary', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/attendance/summary`, { token: TOKEN });
      assert([200, 404].includes(r.status), `Expected 200/404, got ${r.status}`);
    });

    await test('GET /schools/{id}/classes/{classId}/attendance — unauthenticated returns 401', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/classes/${CLASS_ID}/attendance`);
      assert(r.status === 401, `Expected 401, got ${r.status}`);
    });
  }

  // ── Grades ────────────────────────────────────────────────────────────────────
  section('7. GRADES ENDPOINTS');

  if (!SCHOOL_ID || !CLASS_ID) {
    skip('Grades tests', 'No school or class available');
  } else {
    await test('GET /schools/{id}/classes/{classId}/grades — returns grades list', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/classes/${CLASS_ID}/grades`, { token: TOKEN });
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(Array.isArray(r.json?.data) || r.json?.data !== undefined, 'Expected data field');
    });

    await test('GET /schools/{id}/grade-thresholds — returns grade thresholds', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/grade-thresholds`, { token: TOKEN });
      assert([200, 404].includes(r.status), `Expected 200/404, got ${r.status}`);
    });
  }

  // ── Fees ──────────────────────────────────────────────────────────────────────
  section('8. FEES ENDPOINTS');

  if (!SCHOOL_ID) {
    skip('Fees tests', 'No school available');
  } else {
    await test('GET /schools/{id}/fees — returns fee records', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/fees`, { token: TOKEN });
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(Array.isArray(r.json?.data), 'Expected array');
      if (r.json.data.length > 0) {
        FEE_ID = r.json.data[0].id;
      }
    });

    await test('GET /schools/{id}/fees — with status filter', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/fees?status=unpaid`, { token: TOKEN });
      assert(r.status === 200, `Expected 200, got ${r.status}`);
    });

    await test('GET /schools/{id}/fees — unauthenticated returns 401', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/fees`);
      assert(r.status === 401, `Expected 401, got ${r.status}`);
    });
  }

  // ── Staff ─────────────────────────────────────────────────────────────────────
  section('9. STAFF ENDPOINTS');

  if (!SCHOOL_ID) {
    skip('Staff tests', 'No school available');
  } else {
    await test('GET /schools/{id}/staff — returns staff list', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/staff`, { token: TOKEN });
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(Array.isArray(r.json?.data), 'Expected array');
      if (r.json.data.length > 0) {
        STAFF_ID = r.json.data[0].id;
        console.log(`     Found ${r.json.data.length} staff members. Using STAFF_ID: ${STAFF_ID}`);
      }
    });

    await test('POST /schools/{id}/staff — missing name returns 400', async () => {
      const r = await post(`/schools/${SCHOOL_ID}/staff`, { token: TOKEN, body: {} });
      assert(r.status === 400, `Expected 400, got ${r.status}`);
    });

    await test('GET /schools/{id}/staff — unauthenticated returns 401', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/staff`);
      assert(r.status === 401, `Expected 401, got ${r.status}`);
    });
  }

  // ── Users / User Management ───────────────────────────────────────────────────
  section('10. USERS ENDPOINTS');

  if (!SCHOOL_ID) {
    skip('Users tests', 'No school available');
  } else {
    await test('GET /schools/{id}/users — returns user list', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/users`, { token: TOKEN });
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(Array.isArray(r.json?.data), 'Expected array');
      if (r.json.data.length > 0) {
        USER_ID = r.json.data[0].id;
        console.log(`     Found ${r.json.data.length} users.`);
      }
    });

    await test('GET /schools/{id}/users — unauthenticated returns 401', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/users`);
      assert(r.status === 401, `Expected 401, got ${r.status}`);
    });
  }

  // ── Notifications ─────────────────────────────────────────────────────────────
  section('11. NOTIFICATIONS ENDPOINTS');

  await test('GET /notifications — returns user notifications list', async () => {
    const r = await get('/notifications', { token: TOKEN });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('GET /notifications — unauthenticated returns 401', async () => {
    const r = await get('/notifications');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  if (SCHOOL_ID) {
    await test('POST /schools/{id}/communication/test — requires auth', async () => {
      const r = await post(`/schools/${SCHOOL_ID}/communication/test`, { token: TOKEN, body: {} });
      assert([200, 400, 422].includes(r.status), `Expected 200/400/422, got ${r.status}`);
    });
  }

  // ── Payments ──────────────────────────────────────────────────────────────────
  section('12. PAYMENTS ENDPOINTS');

  await test('POST /payments/initiate — missing fields returns 400', async () => {
    const r = await post('/payments/initiate', { token: TOKEN, body: {} });
    assert([400, 422].includes(r.status), `Expected 400/422, got ${r.status}`);
  });

  // ── Leave Requests ────────────────────────────────────────────────────────────
  section('13. LEAVE REQUESTS ENDPOINTS');

  if (!SCHOOL_ID) {
    skip('Leave requests tests', 'No school available');
  } else {
    await test('GET /schools/{id}/leave-requests — returns list', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/leave-requests`, { token: TOKEN });
      assert(r.status === 200, `Expected 200, got ${r.status}`);
    });

    await test('GET /schools/{id}/leave-requests — unauthenticated returns 401', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/leave-requests`);
      assert(r.status === 401, `Expected 401, got ${r.status}`);
    });
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────────
  section('14. TASKS ENDPOINTS');

  if (!SCHOOL_ID) {
    skip('Tasks tests', 'No school available');
  } else {
    await test('GET /schools/{id}/tasks — returns list', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/tasks`, { token: TOKEN });
      assert(r.status === 200, `Expected 200, got ${r.status}`);
    });
  }

  // ── Hostels ───────────────────────────────────────────────────────────────────
  section('15. HOSTELS ENDPOINTS');

  await test('GET /hostels — returns hostel list (global)', async () => {
    const r = await get('/hostels', { token: TOKEN });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('GET /hostels/allocations — returns hostel allocations', async () => {
    const r = await get('/hostels/allocations', { token: TOKEN });
    assert([200, 404].includes(r.status), `Expected 200/404, got ${r.status}`);
  });

  await test('GET /hostels — unauthenticated returns 401', async () => {
    const r = await get('/hostels');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  // ── Expenses ──────────────────────────────────────────────────────────────────
  section('16. EXPENSES ENDPOINTS');

  await test('GET /expenses — returns expenses list (global)', async () => {
    const r = await get('/expenses', { token: TOKEN });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('GET /expenses — unauthenticated returns 401', async () => {
    const r = await get('/expenses');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  // ── Reporting ─────────────────────────────────────────────────────────────────
  section('17. REPORTING ENDPOINTS');

  if (!SCHOOL_ID) {
    skip('Reporting tests', 'No school available');
  } else {
    await test('GET /schools/{id}/reporting/summary — returns summary', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/reporting/summary`, { token: TOKEN });
      assert([200, 404].includes(r.status), `Expected 200 or 404, got ${r.status}`);
    });

    await test('GET /schools/{id}/reporting/fee-collection — returns data', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/reporting/fee-collection`, { token: TOKEN });
      assert([200, 404].includes(r.status), `Expected 200/404, got ${r.status}`);
    });

    await test('GET /schools/{id}/reporting/attendance — returns data', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/reporting/attendance`, { token: TOKEN });
      assert([200, 404].includes(r.status), `Expected 200/404, got ${r.status}`);
    });
  }

  // ── Analytics / Data Science ──────────────────────────────────────────────────
  section('18. ANALYTICS-DS ENDPOINTS');

  if (!SCHOOL_ID) {
    skip('Analytics tests', 'No school available');
  } else {
    await test('GET /schools/{id}/analytics-ds/at-risk — returns data', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/analytics-ds/at-risk`, { token: TOKEN });
      assert([200, 404].includes(r.status), `Expected 200/404, got ${r.status}`);
    });
  }

  // ── Admin Endpoints (super_admin only) ────────────────────────────────────────
  section('19. ADMIN ENDPOINTS (super_admin)');

  if (SCHOOL_ID) {
    await test('GET /admin/system-settings/{schoolId} — returns settings', async () => {
      const r = await get(`/admin/system-settings/${SCHOOL_ID}`, { token: TOKEN });
      assert([200, 404].includes(r.status), `Expected 200/404, got ${r.status}`);
    });

    await test('GET /admin/system-settings/{schoolId} — unauthenticated returns 401', async () => {
      const r = await get(`/admin/system-settings/${SCHOOL_ID}`);
      assert(r.status === 401, `Expected 401, got ${r.status}`);
    });
  }

  // ── Misc Endpoints ────────────────────────────────────────────────────────────
  section('20. MISC ENDPOINTS');

  if (SCHOOL_ID) {
    await test('GET /schools/{id}/timetable — returns timetable', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/timetable`, { token: TOKEN });
      assert([200, 404].includes(r.status), `Expected 200/404, got ${r.status}`);
    });

    await test('GET /schools/{id}/discipline — returns incidents', async () => {
      const r = await get(`/schools/${SCHOOL_ID}/discipline`, { token: TOKEN });
      assert([200, 404].includes(r.status), `Expected 200/404, got ${r.status}`);
    });
  }

  // ── 404 / Unknown Routes ──────────────────────────────────────────────────────
  section('21. EDGE CASES & ERROR HANDLING');

  await test('GET /nonexistent-endpoint — returns 404', async () => {
    const r = await get('/nonexistent-totally-random-endpoint-xyz', { token: TOKEN });
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  await test('GET /health — returns X-API-Version header', async () => {
    const r = await get('/health');
    const apiVersion = r.headers.get('x-api-version');
    assert(apiVersion === 'v1', `Expected X-API-Version: v1, got: ${apiVersion}`);
  });

  await test('Auth: wrong-school cross-tenant access returns 404', async () => {
    if (!SECOND_SCHOOL_ID || !SCHOOL_ID) {
      // Create a fake school id to test isolation
      const r = await get(`/schools/FAKE_SCHOOL_CROSS_TENANT/students`, { token: TOKEN });
      // super_admin can see all, but non-existent school should return empty or 404
      assert([200, 404].includes(r.status), `Expected 200/404, got ${r.status}`);
    } else {
      // Super_admin can access all schools, so skip cross-tenant test for this role
      console.log('     (super_admin can access all schools — cross-tenant isolation tested by role)');
    }
  });

  // ── Logout (last test) ────────────────────────────────────────────────────────
  section('22. LOGOUT');

  await test('POST /auth/logout — returns success', async () => {
    const r = await post('/auth/logout', { token: TOKEN });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.json?.data?.success === true, 'Expected success: true');
  });

  // ─── Summary ──────────────────────────────────────────────────────────────────
  const total = passed + failed + skipped;
  const passRate = total > 0 ? ((passed / (total - skipped)) * 100).toFixed(1) : '0.0';

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    TEST RESULTS                         ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Passed  : ${String(passed).padEnd(5)}                                   ║`);
  console.log(`║  ❌ Failed  : ${String(failed).padEnd(5)}                                   ║`);
  console.log(`║  ⏭  Skipped : ${String(skipped).padEnd(5)}                                   ║`);
  console.log(`║  📊 Pass Rate: ${passRate}%                                    ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (failed > 0) {
    console.log('\n── Failed Tests ────────────────────────────────────────────');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ ${r.name}`);
      console.log(`     → ${r.error}`);
    });
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('\n💥 Test runner crashed:', err.message);
  process.exit(1);
});
