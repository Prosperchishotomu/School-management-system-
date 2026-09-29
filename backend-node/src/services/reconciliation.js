const { query } = require('../config/db');

async function runAttendanceReconciliation() {
  const conflicts = await query(`SELECT ex.id, ex.school_id, ex.student_id, ex.actual_departure_at
    FROM exeats ex INNER JOIN attendance a ON a.student_id = ex.student_id AND a.date = DATE(ex.actual_departure_at)
    WHERE ex.status = 'checked_out' AND a.status = 'present'`);
  for (const conflict of conflicts) {
    await query(`INSERT INTO audit_logs (id, school_id, user_id, action, entity_type, entity_id, description)
      VALUES (?, ?, NULL, 'EXEAT_ATTENDANCE_CONFLICT', 'exeats', ?, ?)`, [`LOG${Date.now().toString(36)}${conflict.id}`, conflict.school_id, conflict.id, JSON.stringify({ student_id: conflict.student_id, departure_at: conflict.actual_departure_at })]);
  }
  return conflicts.length;
}

function startReconciliationJob() {
  const timer = setInterval(() => runAttendanceReconciliation().catch(error => console.warn(JSON.stringify({ event: 'reconciliation_error', error: error.message }))), 60 * 60 * 1000);
  timer.unref();
  return timer;
}

module.exports = { runAttendanceReconciliation, startReconciliationJob };
