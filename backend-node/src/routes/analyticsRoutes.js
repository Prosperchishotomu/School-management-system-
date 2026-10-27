const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const defaultMeta = (extra = {}) => ({
  period: 'Term 1 2026',
  currency: 'USD',
  generatedAt: new Date().toISOString(),
  ...extra
});

// ─── 1. Role-Shaped Dashboard Summary ────────────────────────────────────────
// GET /schools/:schoolId/dashboard/summary?role=
router.get('/schools/:schoolId/dashboard/summary', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const actualRole = (req.user?.role || 'school_admin').toLowerCase();
    // Parents and students can NEVER impersonate other administrative roles
    const role = (actualRole === 'parent' || actualRole === 'student')
      ? actualRole
      : (req.query.role || actualRole).toLowerCase();
    const today = new Date().toISOString().slice(0, 10);

    // ─── PARENT WORKSPACE: Strictly scoped to linked children only ────────────
    if (role === 'parent') {
      const parentUser = req.user;
      let linkedChildren = [];
      try {
        linkedChildren = await query(
          `SELECT DISTINCT
             st.id,
             CONCAT_WS(' ', st.first_name, st.last_name) as name,
             COALESCE(c.name, 'Class Unassigned') as class,
             COALESCE(
               (SELECT ROUND((COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)))
                FROM attendance a WHERE a.student_id = st.id AND a.school_id = ?),
               0
             ) as attendance_pct,
             COALESCE(
               (SELECT ROUND(AVG(g.grade_value), 1) FROM grades g WHERE g.student_id = st.id AND g.school_id = ?),
               0.0
             ) as term_average,
             COALESCE(
               (SELECT SUM(f.amount_due - f.amount_paid) FROM fees f WHERE f.student_id = st.id AND f.school_id = ?),
               0.00
             ) as fee_balance,
             COALESCE(
               (SELECT SUM(f.amount_due) FROM fees f WHERE f.student_id = st.id AND f.school_id = ?),
               0.00
             ) as fee_billed,
             COALESCE(
               (SELECT SUM(f.amount_paid) FROM fees f WHERE f.student_id = st.id AND f.school_id = ?),
               0.00
             ) as fee_paid
           FROM students st
           JOIN student_guardians sg ON st.id = sg.student_id
           JOIN guardians g ON sg.guardian_id = g.id
           LEFT JOIN classes c ON st.class_id = c.id
           WHERE (
             g.user_id = ?
             OR (g.email IS NOT NULL AND g.email != '' AND g.email = ?)
             OR (g.phone IS NOT NULL AND g.phone != '' AND g.phone = ?)
           ) AND st.school_id = ? AND st.status IN ('enrolled', 'active', 'suspended')
           ORDER BY st.first_name ASC`,
          [schoolId, schoolId, schoolId, schoolId, schoolId, parentUser.id, parentUser.email || '', parentUser.phone || '', schoolId]
        );
      } catch (err) {
        console.error('Failed to query linked children for parent summary:', err);
      }

      // Compute family totals ONLY - parents must NEVER see school treasury or all student fees
      const totalFamilyBilled = linkedChildren.reduce((sum, c) => sum + Number(c.fee_billed || 0), 0);
      const totalFamilyPaid = linkedChildren.reduce((sum, c) => sum + Number(c.fee_paid || 0), 0);
      const totalFamilyBalance = linkedChildren.reduce((sum, c) => sum + Number(c.fee_balance || 0), 0);
      const avgAttendance = linkedChildren.length > 0
        ? Math.round(linkedChildren.reduce((sum, c) => sum + Number(c.attendance_pct || 0), 0) / linkedChildren.length)
        : 0;

      return res.json({
        data: {
          role: 'parent',
          kpis: {
            total_children: linkedChildren.length,
            average_attendance_pct: avgAttendance,
            fees_billed: totalFamilyBilled,
            fees_collected: totalFamilyPaid,
            outstanding_balance: totalFamilyBalance
          },
          role_specific: {
            children: linkedChildren
          }
        },
        meta: defaultMeta()
      });
    }

    // Common counts for school staff / administrators
    let totalStudents = 0, totalStaff = 0, totalClasses = 0;
    try {
      const [st] = await query("SELECT COUNT(*) as c FROM students WHERE school_id = ? AND status NOT IN ('withdrawn', 'graduated', 'transferred', 'dropped_out')", [schoolId]);
      totalStudents = Number(st?.c || 0);
    } catch (_) {}

    try {
      const [stf] = await query("SELECT COUNT(*) as c FROM staff WHERE school_id = ?", [schoolId]);
      totalStaff = Number(stf?.c || 0);
    } catch (_) {}

    try {
      const [cls] = await query("SELECT COUNT(*) as c FROM classes WHERE school_id = ?", [schoolId]);
      totalClasses = Number(cls?.c || 0);
    } catch (_) {}

    // Attendance today
    let attendanceTodayPct = 0;
    try {
      const [att] = await query(
        `SELECT
           COUNT(CASE WHEN status IN ('present', 'late') THEN 1 END) as present_cnt,
           COUNT(*) as total_cnt
         FROM attendance WHERE school_id = ? AND date = ?`,
        [schoolId, today]
      );
      if (att && att.total_cnt > 0) {
        attendanceTodayPct = Math.round((att.present_cnt / att.total_cnt) * 100);
      } else {
        attendanceTodayPct = 0;
      }
    } catch (_) {
      attendanceTodayPct = 0;
    }

    // Fees billed & collected (staff/admin only)
    let totalBilled = 0, totalCollected = 0, collectionRate = 0;
    try {
      const [fee] = await query(
        `SELECT
           COALESCE(SUM(amount_due), 0) as billed,
           COALESCE(SUM(amount_paid), 0) as collected
         FROM fees WHERE school_id = ?`,
        [schoolId]
      );
      totalBilled = parseFloat(fee?.billed || 0);
      totalCollected = parseFloat(fee?.collected || 0);
      if (totalBilled > 0) {
        collectionRate = Math.min(100, Math.round((totalCollected / totalBilled) * 100));
      }
    } catch (_) {}
    const outstanding = Math.max(0, totalBilled - totalCollected);

    // Pending approvals
    let pendingApprovals = 0;
    try {
      const [ex] = await query("SELECT COUNT(*) as c FROM exeats WHERE school_id = ? AND status = 'pending'", [schoolId]);
      const [lv] = await query("SELECT COUNT(*) as c FROM leave_requests WHERE school_id = ? AND status = 'pending'", [schoolId]);
      pendingApprovals = Number(ex?.c || 0) + Number(lv?.c || 0);
    } catch (_) {}

    // Role-tailored payloads
    let roleData = {};

    if (role === 'bursar') {
      let todayCollected = 0;
      let monthCollected = 0;
      try {
        const [payToday] = await query(
          "SELECT COALESCE(SUM(COALESCE(amount_paid, amount)), 0) as s FROM fee_payments WHERE school_id = ? AND (DATE(payment_date) = ? OR DATE(created_at) = ?)",
          [schoolId, today, today]
        );
        todayCollected = parseFloat(payToday?.s || 0);
      } catch (_) {}

      try {
        const [payMonth] = await query(
          "SELECT COALESCE(SUM(COALESCE(amount_paid, amount)), 0) as s FROM fee_payments WHERE school_id = ? AND MONTH(COALESCE(payment_date, created_at)) = MONTH(CURRENT_DATE()) AND YEAR(COALESCE(payment_date, created_at)) = YEAR(CURRENT_DATE())",
          [schoolId]
        );
        monthCollected = parseFloat(payMonth?.s || 0);
        if (monthCollected === 0 && totalCollected > 0) {
          monthCollected = totalCollected;
        }
      } catch (_) {}

      let pendingRemote = 0;
      try {
        const [rem] = await query("SELECT COUNT(*) as c FROM remote_payments WHERE school_id = ? AND status = 'pending'", [schoolId]);
        pendingRemote = Number(rem?.c || 0);
      } catch (_) {}

      let currMap = { USD: 0, ZiG: 0, ZAR: 0 };
      try {
        const currRows = await query(
          "SELECT COALESCE(payment_currency, 'USD') as currency, COALESCE(SUM(COALESCE(amount_paid, amount)), 0) as total FROM fee_payments WHERE school_id = ? GROUP BY COALESCE(payment_currency, 'USD')",
          [schoolId]
        );
        currRows.forEach(r => {
          if (r.currency && currMap.hasOwnProperty(r.currency)) {
            currMap[r.currency] = parseFloat(r.total || 0);
          }
        });
        if (currMap.USD === 0 && currMap.ZiG === 0 && currMap.ZAR === 0 && totalCollected > 0) {
          currMap.USD = totalCollected;
        }
      } catch (_) {}

      roleData = {
        today_receipts: todayCollected,
        month_collected: monthCollected,
        collection_rate: collectionRate,
        outstanding: outstanding,
        unreconciled_payments: pendingRemote,
        currencies: currMap
      };
    } else if (role === 'teacher') {
      const teacherUserId = req.user?.id;
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayDay = dayNames[now.getDay()];

      let staffMember = null;
      try {
        staffMember = await queryOne('SELECT id, name, class_id FROM staff WHERE user_id = ? OR id = ?', [teacherUserId, teacherUserId]);
      } catch (_) {}
      const staffId = staffMember?.id || teacherUserId;

      // Subject teacher assignments (for secondary and high school)
      let myAssignments = [];
      try {
        myAssignments = await query(
          `SELECT ta.*, c.name as class_name, c.level as class_level, sub.name as subject_name, sub.code as subject_code
           FROM teaching_assignments ta
           JOIN classes c ON ta.class_id = c.id
           JOIN subjects sub ON ta.subject_id = sub.id
           WHERE ta.school_id = ? AND (ta.teacher_id = ? OR ta.teacher_id = ?)
           ORDER BY c.name ASC, sub.name ASC`,
          [schoolId, staffId, teacherUserId]
        );
      } catch (_) {}

      // Class teacher assignments (Form master allocations)
      let formMasterClasses = [];
      try {
        formMasterClasses = await query(
          `SELECT c.id, c.name, c.level, c.grade_level
           FROM classes c
           WHERE c.school_id = ? AND (
             c.form_master_id = ?
             OR c.form_master_id = ?
             OR c.id IN (SELECT class_id FROM staff WHERE (user_id = ? OR id = ?) AND class_id IS NOT NULL)
           )`,
          [schoolId, staffId, teacherUserId, teacherUserId, teacherUserId]
        );
      } catch (_) {}

      // Check real timetable entries for today
      let todaySchedule = [];
      try {
        todaySchedule = await query(
          `SELECT tt.period, tt.subject, c.name as class_name, tt.teacher
           FROM timetable tt
           LEFT JOIN classes c ON tt.class_id = c.id
           WHERE tt.school_id = ? AND (tt.day = ? OR LOWER(tt.day) = LOWER(?))
             AND (tt.teacher = ? OR tt.teacher = ? OR tt.teacher LIKE ?)
           ORDER BY tt.period ASC`,
          [schoolId, todayDay, todayDay, staffMember?.name || '', String(staffId), `%${staffMember?.name || ''}%`]
        );
      } catch (_) {}

      const periodTimes = [
        { period: '1', time: '08:00 - 08:45', start: 480, end: 525 },
        { period: '2', time: '08:50 - 09:35', start: 530, end: 575 },
        { period: '3', time: '09:40 - 10:25', start: 580, end: 625 },
        { period: '4', time: '10:45 - 11:30', start: 645, end: 690 },
        { period: '5', time: '11:35 - 12:20', start: 695, end: 740 },
        { period: '6', time: '13:30 - 14:15', start: 810, end: 855 },
        { period: '7', time: '14:20 - 15:05', start: 860, end: 905 }
      ];

      let computedTimetable = [];

      if (todaySchedule && todaySchedule.length > 0) {
        computedTimetable = todaySchedule.map(s => {
          const pt = periodTimes.find(p => String(p.period) === String(s.period)) || { time: '08:00 - 08:45', start: 480, end: 525 };
          const status = currentMinutes >= pt.start && currentMinutes <= pt.end
            ? 'current'
            : currentMinutes > pt.end ? 'completed' : 'upcoming';
          return {
            period: String(s.period),
            time: pt.time,
            subject: s.subject || 'Subject Lesson',
            class: s.class_name || 'Class Stream',
            status
          };
        });
      } else {
        computedTimetable = [];
      }

      const activeNow = computedTimetable.find(p => p.status === 'current');

      roleData = {
        classes_to_mark: myAssignments.length,
        marks_entered_pct: 0,
        students_at_risk: 0,
        is_class_teacher: formMasterClasses.length > 0,
        class_teacher_classes: formMasterClasses,
        teaching_assignments: myAssignments,
        timetable_today: computedTimetable,
        current_period: activeNow || null,
        scheduled_count: computedTimetable.length,
        day_of_week: todayDay,
        is_weekend: now.getDay() === 0 || now.getDay() === 6
      };
    } else if (role === 'student') {
      let stAttPct = 0, stAvg = 0, stTasks = 0, stSubjs = 0;
      try {
        const stUser = await queryOne('SELECT id FROM students WHERE user_id = ? OR id = ?', [req.user.id, req.user.id]);
        if (stUser) {
          const [att] = await query("SELECT ROUND((COUNT(CASE WHEN status IN ('present', 'late') THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))) as pct FROM attendance WHERE student_id = ? AND school_id = ?", [stUser.id, schoolId]);
          stAttPct = Number(att?.pct || 0);
          const [grd] = await query("SELECT ROUND(AVG(grade_value), 1) as avg FROM grades WHERE student_id = ? AND school_id = ?", [stUser.id, schoolId]);
          stAvg = Number(grd?.avg || 0);
          const [sub] = await query("SELECT COUNT(DISTINCT subject) as cnt FROM grades WHERE student_id = ? AND school_id = ?", [stUser.id, schoolId]);
          stSubjs = Number(sub?.cnt || 0);
          const [tsk] = await query("SELECT COUNT(*) as cnt FROM tasks WHERE school_id = ? AND status != 'completed'", [schoolId]);
          stTasks = Number(tsk?.cnt || 0);
        }
      } catch (_) {}
      roleData = {
        attendance_pct: stAttPct,
        term_average: stAvg,
        upcoming_tasks: stTasks,
        subjects_count: stSubjs
      };
    } else if (role === 'boarding_master' || role === 'warden') {
      let totalBoarders = 0, hostelCap = 0, occPct = 0, outNow = 0, pendingEx = 0;
      try {
        const [bCount] = await query("SELECT COUNT(*) as c FROM students WHERE school_id = ? AND is_boarding = 1", [schoolId]);
        totalBoarders = Number(bCount?.c || 0);
        const [hCap] = await query("SELECT COALESCE(SUM(capacity), 0) as c FROM hostel_rooms WHERE school_id = ?", [schoolId]);
        hostelCap = Number(hCap?.c || 0);
        occPct = hostelCap > 0 ? Math.round((totalBoarders / hostelCap) * 100) : 0;
        const [ex] = await query("SELECT COUNT(*) as c FROM exeats WHERE school_id = ? AND status = 'pending'", [schoolId]);
        pendingEx = Number(ex?.c || 0);
        const [out] = await query("SELECT COUNT(*) as c FROM exeats WHERE school_id = ? AND status = 'approved' AND return_date >= CURRENT_DATE()", [schoolId]);
        outNow = Number(out?.c || 0);
      } catch (_) {}
      roleData = {
        total_boarders: totalBoarders,
        hostel_capacity: hostelCap,
        occupancy_pct: occPct,
        out_of_school_now: outNow,
        pending_exeats: pendingEx,
        reconciliation_flags: 0
      };
    } else if (role === 'nurse') {
      let visitsToday = 0, chronicCount = 0, allergiesCount = 0;
      try {
        const [v] = await query("SELECT COUNT(*) as c FROM student_health WHERE school_id = ? AND DATE(created_at) = CURRENT_DATE()", [schoolId]);
        visitsToday = Number(v?.c || 0);
        const [ch] = await query("SELECT COUNT(*) as c FROM students WHERE school_id = ? AND medical_notes IS NOT NULL AND medical_notes != ''", [schoolId]);
        chronicCount = Number(ch?.c || 0);
        const [al] = await query("SELECT COUNT(*) as c FROM students WHERE school_id = ? AND allergies IS NOT NULL AND allergies != ''", [schoolId]);
        allergiesCount = Number(al?.c || 0);
      } catch (_) {}
      roleData = {
        visits_today: visitsToday,
        chronic_conditions_count: chronicCount,
        allergies_count: allergiesCount,
        referrals_this_term: 0
      };
    } else if (role === 'super_admin') {
      let totalSchools = 0, totalPlatformUsers = 0, activeLic = 0;
      try {
        const [sc] = await query("SELECT COUNT(*) as c FROM schools");
        totalSchools = Number(sc?.c || 0);
        const [u] = await query("SELECT COUNT(*) as c FROM users");
        totalPlatformUsers = Number(u?.c || 0);
        const [l] = await query("SELECT COUNT(*) as c FROM licenses WHERE status = 'active'");
        activeLic = Number(l?.c || 0);
      } catch (_) {}
      roleData = {
        total_schools: totalSchools,
        active_licenses: activeLic,
        total_platform_users: totalPlatformUsers,
        system_health: 'optimal',
        db_pool_status: 'healthy',
        outbox_queue: 0
      };
    }

    return res.json({
      data: {
        role,
        kpis: {
          attendance_today_pct: attendanceTodayPct,
          attendance_delta: 0,
          total_students: totalStudents,
          total_staff: totalStaff,
          total_classes: totalClasses,
          fees_billed: totalBilled,
          fees_collected: totalCollected,
          collection_rate: collectionRate,
          outstanding_balance: outstanding,
          pending_approvals: pendingApprovals
        },
        role_specific: roleData
      },
      meta: defaultMeta()
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to retrieve dashboard summary.' } });
  }
});

// ─── 2. Rule-Based Insights Engine ───────────────────────────────────────────
// GET /schools/:schoolId/dashboard/insights
router.get('/schools/:schoolId/dashboard/insights', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const insights = [];

    // Rule 1: License expiry warning (<= 30 days)
    try {
      const lic = await queryOne('SELECT * FROM licenses WHERE school_id = ? ORDER BY expires_at DESC LIMIT 1', [schoolId]);
      if (lic && lic.expires_at) {
        const daysLeft = Math.ceil((new Date(lic.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 30 && daysLeft > 0) {
          insights.push({
            id: 'lic_expiry',
            severity: 'warning',
            message: `School license expires in ${daysLeft} days. Renew now to avoid automated operational freeze.`,
            metric: `${daysLeft}d left`,
            href: '/school-admin/license',
            actionLabel: 'Renew License'
          });
        }
      }
    } catch (_) {}

    // Rule 2: Unpaid Debtors 
    try {
      const [debt] = await query(
        `SELECT COUNT(*) as debtor_cnt, COALESCE(SUM(amount_due - amount_paid), 0) as total_debt
         FROM fees WHERE school_id = ? AND (amount_due - amount_paid) > 0`,
        [schoolId]
      );
      if (debt && Number(debt.debtor_cnt) > 0) {
        insights.push({
          id: 'fee_debtors',
          severity: 'warning',
          message: `${debt.debtor_cnt} accounts have outstanding balances totaling US$ ${Number(debt.total_debt).toLocaleString()}. Reminders ready to dispatch.`,
          metric: `US$ ${Math.round(Number(debt.total_debt)).toLocaleString()}`,
          href: '/fees?tab=debtors',
          actionLabel: 'Review Debtors'
        });
      }
    } catch (_) {}

    // Rule 3: Academic pass rate check (< 60% average in any subject)
    try {
      const lowSubjects = await query(
        `SELECT subject, ROUND(AVG(grade_value), 1) as avg_score
         FROM grades WHERE school_id = ?
         GROUP BY subject
         HAVING avg_score < 60
         ORDER BY avg_score ASC
         LIMIT 1`,
        [schoolId]
      );
      if (lowSubjects.length > 0) {
        insights.push({
          id: 'academic_alert',
          severity: 'critical',
          message: `${lowSubjects[0].subject} average is currently ${lowSubjects[0].avg_score}%, which is below the target pass threshold.`,
          metric: `${lowSubjects[0].avg_score}% avg`,
          href: `/results?subject=${encodeURIComponent(lowSubjects[0].subject)}`,
          actionLabel: 'View Subject Analytics'
        });
      }
    } catch (_) {}

    // Rule 4: Exeat discrepancy flags (checked out but marked present)
    try {
      const [mismatches] = await query(
        `SELECT COUNT(*) as cnt FROM exeats WHERE school_id = ? AND status = 'flagged'`,
        [schoolId]
      );
      if (mismatches && Number(mismatches.cnt) > 0) {
        insights.push({
          id: 'exeat_flag',
          severity: 'critical',
          message: `${mismatches.cnt} exeat attendance discrepancies flagged by gate verification.`,
          metric: `${mismatches.cnt} Flagged`,
          href: '/boarding/exeats',
          actionLabel: 'Resolve Gate Discrepancy'
        });
      }
    } catch (_) {}

    // Rule 5: Low class attendance (< 80%)
    try {
      const lowAtt = await query(
        `SELECT c.name, ROUND(COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) * 100.0 / NULLIF(COUNT(a.id), 0), 1) as att_pct
         FROM classes c
         JOIN students st ON c.id = st.class_id
         JOIN attendance a ON st.id = a.student_id
         WHERE c.school_id = ?
         GROUP BY c.id, c.name
         HAVING att_pct < 80
         ORDER BY att_pct ASC
         LIMIT 1`,
        [schoolId]
      );
      if (lowAtt.length > 0) {
        insights.push({
          id: 'low_class_att',
          severity: 'warning',
          message: `${lowAtt[0].name} attendance has fallen to ${lowAtt[0].att_pct}%. Follow-up recommended.`,
          metric: `${lowAtt[0].att_pct}%`,
          href: `/attendance?class=${encodeURIComponent(lowAtt[0].name)}`,
          actionLabel: 'View Class Register'
        });
      }
    } catch (_) {}

    return res.json({
      data: insights.slice(0, 5),
      meta: defaultMeta()
    });
  } catch (err) {
    console.error('Insights engine error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to compute operational insights.' } });
  }
});

// ─── 3. Analytics: Fees (group=method|class|month) ───────────────────────────
// GET /schools/:schoolId/analytics/fees?group=method|class|month
router.get('/schools/:schoolId/analytics/fees', authenticateToken, requireRoles('school_admin', 'bursar', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const group = (req.query.group || 'method').toLowerCase();

    let series = [];

    if (group === 'method') {
      try {
        series = await query(
          `SELECT
             COALESCE(method, 'Cash') as label,
             COUNT(*) as transaction_count,
             COALESCE(SUM(amount), 0) as collected
           FROM payments
           WHERE school_id = ?
           GROUP BY method
           ORDER BY collected DESC`,
          [schoolId]
        );
      } catch (_) {
        series = [];
      }

      if (!series || series.length === 0) {
        try {
          series = await query(
            `SELECT
               COALESCE(payment_method, 'Cash') as label,
               COUNT(*) as transaction_count,
               COALESCE(SUM(COALESCE(amount_paid, amount, 0)), 0) as collected
             FROM fee_payments
             WHERE school_id = ?
             GROUP BY payment_method
             ORDER BY collected DESC`,
            [schoolId]
          );
        } catch (_) {}
      }
    } else if (group === 'class') {
      try {
        series = await query(
          `SELECT
             c.name as label,
             COALESCE(SUM(inv.total_amount), 0) as billed,
             COALESCE(SUM(inv.amount_paid), 0) as collected,
             COALESCE(SUM(inv.balance), 0) as outstanding
           FROM classes c
           JOIN students st ON c.id = st.class_id
           LEFT JOIN invoices inv ON st.id = inv.student_id
           WHERE c.school_id = ?
           GROUP BY c.id, c.name
           ORDER BY c.name ASC`,
          [schoolId]
        );
      } catch (_) {
        series = [];
      }

      if (!series || series.length === 0) {
        try {
          series = await query(
            `SELECT
               c.name as label,
               COALESCE(SUM(f.amount_due), 0) as billed,
               COALESCE(SUM(f.amount_paid), 0) as collected,
               COALESCE(SUM(f.amount_due - f.amount_paid), 0) as outstanding
             FROM classes c
             JOIN students st ON c.id = st.class_id
             LEFT JOIN fees f ON st.id = f.student_id
             WHERE c.school_id = ?
             GROUP BY c.id, c.name
             ORDER BY c.grade_level ASC`,
            [schoolId]
          );
        } catch (_) {}
      }
    } else {
      // Month
      try {
        series = await query(
          `SELECT
             DATE_FORMAT(paid_at, '%b %Y') as label,
             COALESCE(SUM(amount), 0) as collected
           FROM payments
           WHERE school_id = ? AND paid_at IS NOT NULL
           GROUP BY DATE_FORMAT(paid_at, '%b %Y')
           ORDER BY MIN(paid_at) ASC`,
          [schoolId]
        );
      } catch (_) {
        series = [];
      }

      if (!series || series.length === 0) {
        try {
          series = await query(
            `SELECT
               DATE_FORMAT(payment_date, '%b %Y') as label,
               COALESCE(SUM(COALESCE(amount_paid, amount, 0)), 0) as collected
             FROM fee_payments
             WHERE school_id = ? AND payment_date IS NOT NULL
             GROUP BY DATE_FORMAT(payment_date, '%b %Y')
             ORDER BY MIN(payment_date) ASC`,
            [schoolId]
          );
        } catch (_) {}
      }
    }

    return res.json({
      data: series || [],
      meta: defaultMeta({ group })
    });
  } catch (err) {
    console.error('Analytics fees error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to compute fee analytics.' } });
  }
});

// ─── 4. Analytics: Debtors Ageing ────────────────────────────────────────────
// GET /schools/:schoolId/analytics/fees/ageing
router.get('/schools/:schoolId/analytics/fees/ageing', authenticateToken, requireRoles('school_admin', 'bursar', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;

    let buckets = null;

    // Try invoices table first
    try {
      const [invBuckets] = await query(
        `SELECT
           COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), COALESCE(due_date, issued_at)) <= 30 THEN balance ELSE 0 END), 0) as bucket_0_30,
           COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), COALESCE(due_date, issued_at)) BETWEEN 31 AND 60 THEN balance ELSE 0 END), 0) as bucket_31_60,
           COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), COALESCE(due_date, issued_at)) BETWEEN 61 AND 90 THEN balance ELSE 0 END), 0) as bucket_61_90,
           COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), COALESCE(due_date, issued_at)) > 90 THEN balance ELSE 0 END), 0) as bucket_90_plus,
           COALESCE(SUM(balance), 0) as total_debt
         FROM invoices
         WHERE school_id = ? AND balance > 0`,
        [schoolId]
      );
      if (invBuckets && (Number(invBuckets.total_debt) > 0 || invBuckets.bucket_0_30 !== undefined)) {
        buckets = invBuckets;
      }
    } catch (_) {}

    // Fallback to fees table if invoices returned nothing or errored
    if (!buckets) {
      try {
        const [feeBuckets] = await query(
          `SELECT
             COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) <= 30 THEN (amount_due - amount_paid) ELSE 0 END), 0) as bucket_0_30,
             COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 31 AND 60 THEN (amount_due - amount_paid) ELSE 0 END), 0) as bucket_31_60,
             COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 61 AND 90 THEN (amount_due - amount_paid) ELSE 0 END), 0) as bucket_61_90,
             COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) > 90 THEN (amount_due - amount_paid) ELSE 0 END), 0) as bucket_90_plus,
             COALESCE(SUM(amount_due - amount_paid), 0) as total_debt
           FROM fees
           WHERE school_id = ? AND (amount_due - amount_paid) > 0`,
          [schoolId]
        );
        buckets = feeBuckets;
      } catch (_) {}
    }

    return res.json({
      data: {
        '0-30 days': parseFloat(buckets?.bucket_0_30 || 0),
        '31-60 days': parseFloat(buckets?.bucket_31_60 || 0),
        '61-90 days': parseFloat(buckets?.bucket_61_90 || 0),
        '90+ days': parseFloat(buckets?.bucket_90_plus || 0),
        total_outstanding: parseFloat(buckets?.total_debt || 0)
      },
      meta: defaultMeta()
    });
  } catch (err) {
    console.error('Debtors ageing error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to compute debtors ageing.' } });
  }
});

// ─── 5. Analytics: Top Debtors ───────────────────────────────────────────────
// GET /schools/:schoolId/analytics/fees/top-debtors
router.get('/schools/:schoolId/analytics/fees/top-debtors', authenticateToken, requireRoles('school_admin', 'bursar', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;

    let debtors = [];

    // Try invoices first
    try {
      debtors = await query(
        `SELECT
           st.id as student_id,
           CONCAT(st.first_name, ' ', st.last_name) as student_name,
           COALESCE(st.admission_no, st.admission_number, '') as admission_number,
           COALESCE(c.name, 'Unassigned') as class_name,
           inv.balance as balance_due,
           inv.due_date,
           DATEDIFF(CURDATE(), COALESCE(inv.due_date, inv.issued_at, CURDATE())) as days_overdue
         FROM invoices inv
         JOIN students st ON inv.student_id = st.id
         LEFT JOIN classes c ON st.class_id = c.id
         WHERE inv.school_id = ? AND inv.balance > 0
         ORDER BY balance_due DESC
         LIMIT 10`,
        [schoolId]
      );
    } catch (_) {
      debtors = [];
    }

    // Fallback to fees table if empty or invoices table doesn't have records
    if (!debtors || debtors.length === 0) {
      try {
        debtors = await query(
          `SELECT
             st.id as student_id,
             CONCAT(st.first_name, ' ', st.last_name) as student_name,
             COALESCE(st.admission_no, st.admission_number, '') as admission_number,
             COALESCE(c.name, 'Unassigned') as class_name,
             (f.amount_due - f.amount_paid) as balance_due,
             f.due_date,
             DATEDIFF(CURDATE(), COALESCE(f.due_date, CURDATE())) as days_overdue
           FROM fees f
           JOIN students st ON f.student_id = st.id
           LEFT JOIN classes c ON st.class_id = c.id
           WHERE f.school_id = ? AND (f.amount_due - f.amount_paid) > 0
           ORDER BY balance_due DESC
           LIMIT 10`,
          [schoolId]
        );
      } catch (_) {}
    }

    return res.json({
      data: debtors || [],
      meta: defaultMeta()
    });
  } catch (err) {
    console.error('Top debtors error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch top debtors.' } });
  }
});


// ─── 6. Analytics: Attendance ────────────────────────────────────────────────
// GET /schools/:schoolId/analytics/attendance?group=class|weekday|week
router.get('/schools/:schoolId/analytics/attendance', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const group = (req.query.group || 'class').toLowerCase();

    let data = [];

    if (group === 'weekday') {
      data = await query(
        `SELECT
           DAYNAME(date) as weekday,
           ROUND(COUNT(CASE WHEN status IN ('present', 'late') THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 1) as attendance_pct
         FROM attendance
         WHERE school_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
         GROUP BY DAYNAME(date), DAYOFWEEK(date)
         ORDER BY DAYOFWEEK(date) ASC`,
        [schoolId]
      );
    } else {
      data = await query(
        `SELECT
           c.name as class_name,
           ROUND(COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) * 100.0 / NULLIF(COUNT(a.id), 0), 1) as attendance_pct,
           COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) as present_cnt,
           COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_cnt
         FROM classes c
         JOIN students st ON c.id = st.class_id
         JOIN attendance a ON st.id = a.student_id
         WHERE c.school_id = ? AND a.date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
         GROUP BY c.id, c.name
         ORDER BY attendance_pct DESC`,
        [schoolId]
      );
    }

    return res.json({
      data,
      meta: defaultMeta({ group })
    });
  } catch (err) {
    console.error('Attendance analytics error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to compute attendance analytics.' } });
  }
});

// ─── 7. Analytics: Academics ─────────────────────────────────────────────────
// GET /schools/:schoolId/analytics/academics?group=subject|class|term
router.get('/schools/:schoolId/analytics/academics', authenticateToken, requireRoles('school_admin', 'teacher', 'super_admin'), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const group = (req.query.group || 'subject').toLowerCase();

    let data = [];
    if (group === 'class') {
      data = await query(
        `SELECT
           c.name as class_name,
           ROUND(AVG(g.grade_value), 1) as mean_score,
           ROUND(COUNT(CASE WHEN g.grade_value >= 50 THEN 1 END) * 100.0 / NULLIF(COUNT(g.id), 0), 1) as pass_rate
         FROM classes c
         JOIN students st ON c.id = st.class_id
         JOIN grades g ON st.id = g.student_id
         WHERE c.school_id = ?
         GROUP BY c.id, c.name
         ORDER BY mean_score DESC`,
        [schoolId]
      );
    } else {
      // By Subject
      data = await query(
        `SELECT
           g.subject,
           ROUND(AVG(g.grade_value), 1) as mean_score,
           ROUND(COUNT(CASE WHEN g.grade_value >= 50 THEN 1 END) * 100.0 / NULLIF(COUNT(g.id), 0), 1) as pass_rate,
           COUNT(CASE WHEN g.grade_value >= 75 THEN 1 END) as distinction_cnt,
           COUNT(CASE WHEN g.grade_value BETWEEN 60 AND 74 THEN 1 END) as merit_cnt,
           COUNT(CASE WHEN g.grade_value BETWEEN 50 AND 59 THEN 1 END) as credit_cnt,
           COUNT(CASE WHEN g.grade_value < 50 THEN 1 END) as fail_cnt
         FROM grades g
         WHERE g.school_id = ?
         GROUP BY g.subject
         ORDER BY pass_rate DESC`,
        [schoolId]
      );
    }

    return res.json({
      data,
      meta: defaultMeta({ group })
    });
  } catch (err) {
    console.error('Academics analytics error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to compute academic analytics.' } });
  }
});

// ─── 8. Analytics: Enrolment ─────────────────────────────────────────────────
// GET /schools/:schoolId/analytics/enrolment
router.get('/schools/:schoolId/analytics/enrolment', authenticateToken, requireRoles('school_admin', 'super_admin', 'bursar'), async (req, res) => {
  try {
    const { schoolId } = req.params;

    const byFormAndGender = await query(
      `SELECT
         COALESCE(c.grade_level, 'Other') as form,
         COUNT(CASE WHEN st.gender = 'female' THEN 1 END) as female_count,
         COUNT(CASE WHEN st.gender = 'male' THEN 1 END) as male_count,
         COUNT(CASE WHEN st.is_boarding = 1 THEN 1 END) as boarders_count,
         COUNT(*) as total_count
       FROM students st
       LEFT JOIN classes c ON st.class_id = c.id
       WHERE st.school_id = ? AND st.status NOT IN ('withdrawn', 'graduated', 'transferred', 'dropped_out')
       GROUP BY c.grade_level
       ORDER BY c.grade_level ASC`,
      [schoolId]
    );

    return res.json({
      data: byFormAndGender,
      meta: defaultMeta()
    });
  } catch (err) {
    console.error('Enrolment analytics error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to compute enrolment breakdown.' } });
  }
});

// ─── 9. Boarding Overview ────────────────────────────────────────────────────
// GET /schools/:schoolId/boarding/overview
router.get('/schools/:schoolId/boarding/overview', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;

    let hostels = [];
    try {
      hostels = await query(
        `SELECT
           h.id, h.name, h.gender, h.capacity,
           COUNT(st.id) as occupied,
           ROUND(COUNT(st.id) * 100.0 / NULLIF(h.capacity, 0), 1) as occupancy_pct
         FROM hostels h
         LEFT JOIN students st ON h.id = st.hostel_id AND st.is_boarding = 1
         WHERE h.school_id = ?
         GROUP BY h.id, h.name, h.gender, h.capacity`,
        [schoolId]
      );
    } catch (_) {}

    let outNow = [];
    try {
      outNow = await query(
        `SELECT
           e.id as exeat_id,
           CONCAT(st.first_name, ' ', st.last_name) as student_name,
           c.name as class_name,
           e.departure_date,
           e.expected_return,
           e.destination,
           e.status
         FROM exeats e
         JOIN students st ON e.student_id = st.id
         LEFT JOIN classes c ON st.class_id = c.id
         WHERE e.school_id = ? AND e.status = 'checked_out'`,
        [schoolId]
      );
    } catch (_) {}

    return res.json({
      data: {
        hostels,
        currently_out: outNow,
        out_count: outNow.length,
        flags_count: 0
      },
      meta: defaultMeta()
    });
  } catch (err) {
    console.error('Boarding overview error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch boarding overview.' } });
  }
});

// ─── 10. Audit Activity Feed ─────────────────────────────────────────────────
// GET /schools/:schoolId/activity?limit=
router.get('/schools/:schoolId/activity', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const limit = Math.min(50, parseInt(req.query.limit || '15', 10));

    let logs = [];
    try {
      logs = await query(
        `SELECT
           a.id,
           COALESCE(u.name, u.username, 'System') as actor_name,
           a.action,
           a.entity_type,
           a.entity_id,
           a.details,
           a.created_at
         FROM audit_logs a
         LEFT JOIN users u ON a.user_id = u.id
         WHERE a.school_id = ?
         ORDER BY a.created_at DESC
         LIMIT ?`,
        [schoolId, limit]
      );
    } catch (_) {}

    return res.json({
      data: logs,
      meta: defaultMeta()
    });
  } catch (err) {
    console.error('Activity feed error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch activity feed.' } });
  }
});

// ─── 11. Role-Scoped Global Search ───────────────────────────────────────────
// GET /search?q=
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ data: { students: [], staff: [], invoices: [], classes: [] } });
    }

    const schoolId = req.user?.school_id || req.headers['x-school-id'] || null;
    if (!schoolId) {
      return res.json({ data: { students: [], staff: [], invoices: [], classes: [] } });
    }
    const pattern = `%${q}%`;

    const [students, staff, invoices, classes] = await Promise.all([
      query(
        `SELECT id, first_name, last_name, admission_number
         FROM students
         WHERE school_id = ? AND (first_name LIKE ? OR last_name LIKE ? OR admission_number LIKE ?)
         LIMIT 6`,
        [schoolId, pattern, pattern, pattern]
      ).catch(() => []),

      query(
        `SELECT id, name, role, department
         FROM staff
         WHERE school_id = ? AND (name LIKE ? OR department LIKE ?)
         LIMIT 6`,
        [schoolId, pattern, pattern]
      ).catch(() => []),

      query(
        `SELECT f.id, f.title as invoice_number, CONCAT(st.first_name, ' ', st.last_name) as student_name
         FROM fees f
         JOIN students st ON f.student_id = st.id
         WHERE f.school_id = ? AND (f.id LIKE ? OR st.first_name LIKE ? OR st.last_name LIKE ?)
         LIMIT 6`,
        [schoolId, pattern, pattern, pattern]
      ).catch(() => []),

      query(
        `SELECT id, name, grade_level, level
         FROM classes
         WHERE school_id = ? AND name LIKE ?
         LIMIT 6`,
        [schoolId, pattern]
      ).catch(() => [])
    ]);

    return res.json({
      data: { students, staff, invoices, classes },
      meta: defaultMeta({ query: q })
    });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Search query failed.' } });
  }
});

module.exports = router;
