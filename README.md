# SchoolBase

SchoolBase is a Zimbabwe-focused school management system for ECD, primary,
O-Level, and A-Level schools. The backend is Node.js/Express with MySQL and the
frontend is React/Vite.

## Local development

1. Create `backend-node/.env` from the local environment requirements.
2. Ensure MySQL is running and import `backend-node/database.sql` into the
   configured database.
3. Start the API from `backend-node` with `npm start`.
4. Start the frontend from `web` with `npm run dev`.

The API listens on port `5000` by default and the frontend on port `5173`.
Runtime migrations add compatibility columns and communication tables at API
startup. Do not run destructive schema resets against a live school database.

## Environment contracts

Required in production: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
`DB_NAME`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, and `ALLOWED_ORIGINS`.

Optional integrations: `REDIS_URL`, `SMS_GATEWAY_URL`, `EMAIL_GATEWAY_URL`,
and `WHATSAPP_GATEWAY_URL`. Delivery is persisted in `delivery_outbox` and
retried by the worker when a gateway is configured.

## Integrity workflows

Results publication, results release, ZIMSEC submission/import, fee activation,
invoice voiding, and payment reversal use the approvals queue. The requester
cannot approve or reject their own request. Attendance and marks synchronization
accept version metadata and return `STALE_VERSION` on conflicts.

## Excluded deliverables

OpenAPI 3.1, Docker/Nginx deployment files, and S3/private document storage
are intentionally outside this implementation scope.
