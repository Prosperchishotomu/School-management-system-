/**
 * app.js — Express application factory (no listen call)
 * Imported by both server.js and the Jest test suite.
 */
const express = require('express');
const cors = require('cors');

const authRoutes          = require('./routes/authRoutes');
const studentsRoutes      = require('./routes/studentsRoutes');
const staffRoutes         = require('./routes/staffRoutes');
const classesRoutes       = require('./routes/classesRoutes');
const { router: gradesRoutes, thresholdsRouter } = require('./routes/gradesRoutes');
const feesRoutes          = require('./routes/feesRoutes');
const tasksRoutes         = require('./routes/tasksRoutes');
const notificationsRoutes = require('./routes/notificationsRoutes');
const miscRoutes          = require('./routes/miscRoutes');
const extraRoutes         = require('./routes/extraRoutes');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key', 'X-Active-School-Id']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'SchoolBase Node.js API', time: new Date().toISOString() });
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
app.use('/api/v1',                                             feesRoutes);
app.use('/api/v1/schools/:schoolId/tasks',                     tasksRoutes);
app.use('/api/v1/notifications',                               notificationsRoutes);
app.use('/api/v1',                                             miscRoutes);
app.use('/api/v1',                                             extraRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found.` } });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Global API Error:', err);
  res.status(err.status || 500).json({
    error: { code: err.code || 'INTERNAL_SERVER_ERROR', message: err.message || 'An unexpected error occurred.' }
  });
});

module.exports = app;
