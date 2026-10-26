/**
 * app.js — Express application factory (no listen call)
 * Imported by both server.js and the Jest test suite.
 */
const express = require('express');
const cors = require('cors');
const requestContext = require('./middleware/requestContext');
const { generalRateLimit } = require('./middleware/rateLimit');
const { queryOne } = require('./config/db');

const authRoutes          = require('./routes/authRoutes');
const studentsRoutes      = require('./routes/studentsRoutes');
const staffRoutes         = require('./routes/staffRoutes');
const classesRoutes       = require('./routes/classesRoutes');
const { router: gradesRoutes, thresholdsRouter, schoolGradesRouter } = require('./routes/gradesRoutes');
const feesRoutes          = require('./routes/feesRoutes');
const tasksRoutes         = require('./routes/tasksRoutes');
const notificationsRoutes = require('./routes/notificationsRoutes');
const miscRoutes          = require('./routes/miscRoutes');
const extraRoutes         = require('./routes/extraRoutes');
const academicsRoutes     = require('./routes/academicsRoutes');
const schemesRoutes       = require('./routes/schemesRoutes');
const zimsecRoutes        = require('./routes/zimsecRoutes');
const financeExtraRoutes  = require('./routes/financeExtraRoutes');
const boardingRoutes      = require('./routes/boardingRoutes');
const emisRoutes          = require('./routes/emisRoutes');
const healthCounsellingRoutes = require('./routes/healthCounsellingRoutes');
const messagesRoutes       = require('./routes/messagesRoutes');
const analyticsRoutes      = require('./routes/analyticsRoutes');
const importRoutes         = require('./routes/importRoutes');

const app = express();

app.disable('x-powered-by');
app.use(requestContext);

// Developer-friendly, clean & colorized terminal logger
app.use((req, res, next) => {
  // 1. Completely silence CORS pre-flight OPTIONS requests (status 204) to avoid terminal noise
  if (req.method === 'OPTIONS') {
    return next();
  }

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    // 2. Filter out noisy polling 304s (Not Modified) on background polling endpoints
    const isQuietPoller = res.statusCode === 304 && (
      req.originalUrl.includes('/notifications') ||
      req.originalUrl.includes('/admin/alerts') ||
      req.originalUrl.includes('/admin/stats') ||
      req.originalUrl.includes('/admin/audit-log') ||
      req.originalUrl.includes('/admin/licenses')
    );
    if (isQuietPoller) return;

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const roundedMs = Math.round(durationMs * 10) / 10;

    // Support structured JSON in production if explicitly configured
    if (process.env.LOG_FORMAT === 'json') {
      console.log(JSON.stringify({
        event: 'http_request',
        request_id: req.requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        duration_ms: roundedMs
      }));
      return;
    }

    // Modern colorized terminal output
    const now = new Date();
    const timeStr = [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0')
    ].join(':');

    // Method coloring (pad to 6 chars)
    let methodColored = req.method.padEnd(6, ' ');
    if (req.method === 'GET') methodColored = `\x1b[36m${methodColored}\x1b[0m`; // cyan
    else if (req.method === 'POST') methodColored = `\x1b[32m${methodColored}\x1b[0m`; // green
    else if (req.method === 'PUT' || req.method === 'PATCH') methodColored = `\x1b[33m${methodColored}\x1b[0m`; // yellow
    else if (req.method === 'DELETE') methodColored = `\x1b[31m${methodColored}\x1b[0m`; // red
    else methodColored = `\x1b[35m${methodColored}\x1b[0m`; // magenta

    // Status coloring
    let statusColored = String(res.statusCode);
    if (res.statusCode >= 500) statusColored = `\x1b[1;31m${statusColored}\x1b[0m`; // bold red
    else if (res.statusCode >= 400) statusColored = `\x1b[33m${statusColored}\x1b[0m`; // yellow
    else if (res.statusCode >= 300) statusColored = `\x1b[90m${statusColored}\x1b[0m`; // gray
    else statusColored = `\x1b[32m${statusColored}\x1b[0m`; // green

    // Duration coloring
    let durationColored = `${roundedMs}ms`;
    if (roundedMs >= 1000) durationColored = `\x1b[31m${(roundedMs / 1000).toFixed(2)}s\x1b[0m`;
    else if (roundedMs >= 300) durationColored = `\x1b[33m${roundedMs}ms\x1b[0m`;
    else durationColored = `\x1b[90m${roundedMs}ms\x1b[0m`;

    const cleanPath = req.originalUrl.length > 55 ? req.originalUrl.slice(0, 52) + '...' : req.originalUrl;
    console.log(`\x1b[90m[${timeStr}]\x1b[0m ${methodColored} ${cleanPath.padEnd(54, ' ')} ${statusColored} \x1b[90m(\x1b[0m${durationColored}\x1b[90m)\x1b[0m`);
  });
  next();
});

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or postman)
    if (!origin) return callback(null, true);
    
    // In development/test mode, or if origin matches allowed list, permit access
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*') || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    return callback(new Error('CORS Policy Denied: Origin not allowed.'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key', 'X-Active-School-Id'],
  credentials: true
}));


app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(generalRateLimit);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'SchoolBase Node.js API', time: new Date().toISOString() });
});

app.get('/health/ready', async (req, res) => {
  try {
    await queryOne('SELECT 1 AS ok');
    const queue = await queryOne("SELECT COUNT(*) AS queued FROM delivery_outbox WHERE status = 'queued'");
    return res.json({ status: 'ready', database: 'ok', delivery_queue: Number(queue?.queued || 0), time: new Date().toISOString() });
  } catch (error) {
    return res.status(503).json({ error: { code: 'NOT_READY', message: 'A required dependency is unavailable.' }, request_id: req.requestId });
  }
});

app.get('/health/metrics', async (req, res) => {
  try {
    const [queue, failed, active] = await Promise.all([
      queryOne("SELECT COUNT(*) AS count FROM delivery_outbox WHERE status = 'queued'"),
      queryOne("SELECT COUNT(*) AS count FROM delivery_outbox WHERE status = 'failed'"),
      queryOne("SELECT COUNT(*) AS count FROM users WHERE status = 'active'")
    ]);
    return res.json({ data: { delivery_queue: Number(queue?.count || 0), delivery_failed: Number(failed?.count || 0), active_users: Number(active?.count || 0) } });
  } catch (error) { return res.status(503).json({ error: { code: 'METRICS_UNAVAILABLE', message: 'Operational metrics are unavailable.' }, request_id: req.requestId }); }
});

// API Routes
app.use('/api/v1',      authRoutes);
app.use('/api/v1/auth', authRoutes);

app.use('/api/v1/schools/:schoolId/students',                  studentsRoutes);
app.use('/api/v1/schools/:schoolId/promote-students',          studentsRoutes);
app.use('/api/v1/schools/:schoolId/staff',                     staffRoutes);
app.use('/api/v1/schools/:schoolId',                           classesRoutes);
app.use('/api/v1/schools/:schoolId/classes/:classId/grades',   gradesRoutes);
app.use('/api/v1/schools/:schoolId/grade-thresholds',           thresholdsRouter);
app.use('/api/v1/schools/:schoolId/grades',                     schoolGradesRouter);
app.use('/api/v1',                                             feesRoutes);
app.use('/api/v1/schools/:schoolId/tasks',                     tasksRoutes);
app.use('/api/v1/notifications',                               notificationsRoutes);
app.use('/api/v1/messages',                                    messagesRoutes);
app.use('/api/v1',                                             academicsRoutes);
app.use('/api/v1/schools/:schoolId',                           academicsRoutes);
app.use('/api/v1',                                             schemesRoutes);
app.use('/api/v1/schools/:schoolId',                           schemesRoutes);
app.use('/api/v1',                                             zimsecRoutes);
app.use('/api/v1/schools/:schoolId',                           zimsecRoutes);
app.use('/api/v1',                                             financeExtraRoutes);
app.use('/api/v1/schools/:schoolId',                           financeExtraRoutes);
app.use('/api/v1',                                             boardingRoutes);
app.use('/api/v1/schools/:schoolId',                           boardingRoutes);
app.use('/api/v1',                                             emisRoutes);
app.use('/api/v1/schools/:schoolId',                           emisRoutes);
app.use('/api/v1',                                             healthCounsellingRoutes);
app.use('/api/v1/schools/:schoolId',                           healthCounsellingRoutes);
app.use('/api/v1',                                             miscRoutes);
app.use('/api/v1',                                             analyticsRoutes);
app.use('/api/v1/schools/:schoolId/import',                    importRoutes);
app.use('/api/v1',                                             extraRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found.` }, request_id: req.requestId });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Global API Error:', err);
  res.status(err.status || 500).json({
    error: { code: err.code || 'INTERNAL_SERVER_ERROR', message: err.message || 'An unexpected error occurred.' },
    request_id: req.requestId
  });
});

module.exports = app;
