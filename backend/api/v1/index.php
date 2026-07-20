<?php
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../utils/db.php';
require_once __DIR__ . '/../../utils/auth.php';

// Handle CORS requests first
handleCors();

// ── Router class ─────────────────────────────────────────────────────────────
class Router {
    private $routes = [];

    private function compileRoute($path) {
        $pattern = preg_replace('/\{([a-zA-Z0-9_]+)\}/', '(?P<$1>[^/]+)', $path);
        return '#^' . $pattern . '$#';
    }

    public function addRoute($method, $path, $handler) {
        $this->routes[] = [
            'method'  => strtoupper($method),
            'pattern' => $this->compileRoute($path),
            'handler' => $handler
        ];
    }

    public function get($path, $handler)    { $this->addRoute('GET',    $path, $handler); }
    public function post($path, $handler)   { $this->addRoute('POST',   $path, $handler); }
    public function put($path, $handler)    { $this->addRoute('PUT',    $path, $handler); }
    public function patch($path, $handler)  { $this->addRoute('PATCH',  $path, $handler); }
    public function delete($path, $handler) { $this->addRoute('DELETE', $path, $handler); }

    public function dispatch() {
        $requestMethod = $_SERVER['REQUEST_METHOD'];
        $requestUri    = $_SERVER['REQUEST_URI'];
        $basePath      = dirname($_SERVER['SCRIPT_NAME']);
        $path          = str_replace($basePath, '', $requestUri);
        $path          = explode('?', $path)[0];
        $path          = '/' . trim($path, '/');

        try {
            foreach ($this->routes as $route) {
                if ($route['method'] === $requestMethod && preg_match($route['pattern'], $path, $matches)) {
                    $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
                    call_user_func_array($route['handler'], array_values($params));
                    return;
                }
            }
        } catch (Throwable $e) {
            error_log("API Error: " . $e->getMessage() . " in " . $e->getFile() . " on line " . $e->getLine());
            if (defined('APP_ENV') && APP_ENV === 'development') {
                Auth::sendResponse(null, [
                    "code" => "INTERNAL_SERVER_ERROR",
                    "message" => $e->getMessage(),
                    "file" => $e->getFile(),
                    "line" => $e->getLine(),
                    "trace" => $e->getTraceAsString()
                ], 500);
            } else {
                Auth::sendResponse(null, ["code" => "INTERNAL_SERVER_ERROR", "message" => "An internal server error occurred."], 500);
            }
        }

        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "Endpoint not found."], 404);
    }
}

// Instantiate router
$router = new Router();

// ── Health check (unauthenticated) ───────────────────────────────────────────
$router->get('/health', function() {
    $dbOk = false;
    try {
        Database::getConnection()->query("SELECT 1");
        $dbOk = true;
    } catch (Exception $e) { /* ignore */ }

    $status = $dbOk ? 'ok' : 'degraded';
    http_response_code($dbOk ? 200 : 503);
    header('Content-Type: application/json');
    header('X-API-Version: v1');
    echo json_encode([
        "data"  => [
            "service"   => "SchoolBase API",
            "version"   => "v1",
            "status"    => $status,
            "db"        => $dbOk ? "connected" : "unreachable",
            "timestamp" => date('c')
        ],
        "meta"  => (object)[],
        "error" => null
    ]);
    exit;
});

// ── Load route groups ─────────────────────────────────────────────────────────
require_once __DIR__ . '/routes/auth.php';
require_once __DIR__ . '/routes/schools.php';
require_once __DIR__ . '/routes/classes.php';
require_once __DIR__ . '/routes/students.php';
require_once __DIR__ . '/routes/attendance.php';
require_once __DIR__ . '/routes/grades.php';
require_once __DIR__ . '/routes/fees.php';
require_once __DIR__ . '/routes/staff.php';
require_once __DIR__ . '/routes/users.php';
require_once __DIR__ . '/routes/licenses.php';
require_once __DIR__ . '/routes/misc.php';
require_once __DIR__ . '/routes/reporting.php';
require_once __DIR__ . '/routes/notifications.php';
require_once __DIR__ . '/routes/teaching_assignments.php';
require_once __DIR__ . '/routes/tasks.php';
require_once __DIR__ . '/routes/admin.php';
require_once __DIR__ . '/routes/leave_requests.php';

// ── Dispatch ─────────────────────────────────────────────────────────────────
$router->dispatch();