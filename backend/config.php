<?php

$_envFile = __DIR__ . '/.env';
if (file_exists($_envFile)) {
    $lines = file($_envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            [$key, $val] = explode('=', $line, 2);
            $key = trim($key); $val = trim($val);
            if (!array_key_exists($key, $_SERVER) && !array_key_exists($key, $_ENV)) {
                putenv("$key=$val");
                $_ENV[$key] = $val;
                $_SERVER[$key] = $val;
            }
        }
    }
}

// ── Database Configuration ───────────────────────────────────────────────────
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'schoolbase');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');

// ── CORS ────────────────────────────────────────────────────────────────────
define('CORS_ALLOWED_ORIGIN', getenv('CORS_ALLOWED_ORIGIN') ?: 'http://localhost:5173');

// ── Security Configurations ──────────────────────────────────────────────────
$_jwtSecret = getenv('JWT_SECRET_KEY');
if (!$_jwtSecret || strlen($_jwtSecret) < 32) {
    // In production, this must be set. In dev, use a deterministic default.
    $_jwtSecret = 'schoolbase-dev-only-key-rotate-in-production-CHANGEME123456789';
}
define('JWT_SECRET_KEY', $_jwtSecret);
define('JWT_EXPIRY_SECONDS', (int)(getenv('JWT_EXPIRY_SECONDS') ?: 28800));
define('MAX_LOGIN_ATTEMPTS', (int)(getenv('MAX_LOGIN_ATTEMPTS') ?: 5));
define('LOCKOUT_TIME_MINUTES', (int)(getenv('LOCKOUT_TIME_MINUTES') ?: 15));

// App URL (for password reset links etc.)
define('APP_URL', rtrim(getenv('APP_URL') ?: 'http://localhost', '/'));
define('APP_ENV', getenv('APP_ENV') ?: 'development');

// ── Error Reporting ──────────────────────────────────────────────────────────
error_reporting(E_ALL);
ini_set('display_errors', 0); // Never show errors to clients
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error.log');

// ── CORS Handler ─────────────────────────────────────────────────────────────
function handleCors() {
    if (isset($_SERVER['HTTP_ORIGIN'])) {
        $origin = $_SERVER['HTTP_ORIGIN'];
        if ($origin === CORS_ALLOWED_ORIGIN || preg_match('/^https?:\/\/localhost(:\d+)?$/', $origin)) {
            header("Access-Control-Allow-Origin: $origin");
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Max-Age: 86400');
        }
    }

    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD'])) {
            header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
        }
        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])) {
            header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
        }
        exit(0);
    }
}
