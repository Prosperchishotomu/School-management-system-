<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/db.php';

class Auth {
    /**
     * Encode data to Base64Url format.
     */
    private static function base64UrlEncode($data) {
        return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
    }

    /**
     * Decode data from Base64Url format.
     */
    private static function base64UrlDecode($data) {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        return base64_decode(str_replace(['-', '_'], ['+', '/'], $data));
    }

    /**
     * Generate a signed JWT token.
     */
    public static function generateToken($payload) {
        $header = json_encode(['alg' => 'HS256', 'typ' => 'JWT']);
        $payload['exp'] = time() + JWT_EXPIRY_SECONDS;

        $base64UrlHeader  = self::base64UrlEncode($header);
        $base64UrlPayload = self::base64UrlEncode(json_encode($payload));

        $signature          = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, JWT_SECRET_KEY, true);
        $base64UrlSignature = self::base64UrlEncode($signature);

        return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    }

    /**
     * Verify a JWT token. Returns payload or false.
     * Also validates token_version to allow server-side token invalidation.
     */
    public static function verifyToken($token, $checkVersion = false, $userId = null, $expectedVersion = null) {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return false;

        list($header, $payload, $signature) = $parts;

        $validSignature        = hash_hmac('sha256', $header . "." . $payload, JWT_SECRET_KEY, true);
        $validBase64Signature  = self::base64UrlEncode($validSignature);

        if (!hash_equals($validBase64Signature, $signature)) return false;

        $decodedPayload = json_decode(self::base64UrlDecode($payload), true);
        if (!$decodedPayload || !isset($decodedPayload['exp']) || $decodedPayload['exp'] < time()) {
            return false;
        }

        return $decodedPayload;
    }

    /**
     * Check IP-based rate limiting. Returns true if the IP is rate-limited.
     * Allows MAX 30 login attempts per IP per minute.
     */
    public static function checkIpRateLimit() {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        try {
            $db = Database::getConnection();

            // Clean expired windows (older than 1 minute)
            $db->prepare("DELETE FROM `login_rate_limit` WHERE `window_start` < DATE_SUB(NOW(), INTERVAL 1 MINUTE)")->execute();

            $stmt = $db->prepare("SELECT `attempts`, `window_start` FROM `login_rate_limit` WHERE `ip` = ?");
            $stmt->execute([$ip]);
            $row = $stmt->fetch();

            if ($row) {
                if ((int)$row['attempts'] >= 30) {
                    return true; // Rate limited
                }
                $db->prepare("UPDATE `login_rate_limit` SET `attempts` = `attempts` + 1 WHERE `ip` = ?")->execute([$ip]);
            } else {
                $db->prepare("INSERT INTO `login_rate_limit` (`ip`, `attempts`, `window_start`) VALUES (?, 1, NOW())")->execute([$ip]);
            }
        } catch (Exception $e) {
            error_log("IP rate limit check failed: " . $e->getMessage());
        }
        return false;
    }

    /**
     * Validate a date string format (YYYY-MM-DD).
     * Returns the date string if valid, or triggers a 400 response.
     */
    public static function validateDate($dateStr, $fieldName = 'date') {
        if (empty($dateStr)) return null;
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateStr) || !strtotime($dateStr)) {
            self::sendResponse(null, [
                "code"    => "VALIDATION_ERROR",
                "message" => "Invalid date format for '$fieldName'. Use YYYY-MM-DD.",
                "fields"  => [$fieldName => "invalid_format"]
            ], 400);
        }
        return $dateStr;
    }

    /**
     * Require authentication. Reads Authorization header, verifies token,
     * checks token_version, and returns current user or terminates with 401/403.
     */
    public static function requireAuth() {
        $headers   = getallheaders();
        $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

        if (empty($authHeader) && isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
        }

        if (empty($authHeader) && isset($_GET['token'])) {
            $authHeader = 'Bearer ' . $_GET['token'];
        }

        if (empty($authHeader) || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            self::sendResponse(null, ["code" => "UNAUTHENTICATED", "message" => "Authentication token is missing."], 401);
        }

        $token   = $matches[1];
        $payload = self::verifyToken($token);

        if (!$payload) {
            self::sendResponse(null, ["code" => "UNAUTHENTICATED", "message" => "Session has expired or token is invalid."], 401);
        }

        // Fetch user from DB to verify active status AND token_version
        $db   = Database::getConnection();
        $stmt = $db->prepare("SELECT u.id, u.school_id, u.username, u.role, u.status, u.token_version,
                                     s.status as school_status
                              FROM users u
                              LEFT JOIN schools s ON u.school_id = s.id
                              WHERE u.id = ?");
        $stmt->execute([$payload['id']]);
        $user = $stmt->fetch();

        if (!$user || $user['status'] !== 'active') {
            self::sendResponse(null, ["code" => "UNAUTHORIZED", "message" => "User account is suspended or deleted."], 403);
        }

        // Token version check — if the DB version is newer, this token is revoked
        $payloadVersion = isset($payload['tv']) ? (int)$payload['tv'] : 1;
        if ((int)$user['token_version'] !== $payloadVersion) {
            self::sendResponse(null, ["code" => "UNAUTHENTICATED", "message" => "Session is no longer valid. Please log in again."], 401);
        }

        // License check (non-super admins)
        if ($user['role'] !== 'super_admin') {
            self::checkLicense($user['school_id']);
        }

        return $user;
    }

    /**
     * Require user to have specific roles.
     */
    public static function requireRoles($user, $allowedRoles) {
        if (!in_array($user['role'], $allowedRoles)) {
            self::sendResponse(null, ["code" => "FORBIDDEN", "message" => "You do not have permission to access this resource."], 403);
        }
    }

    /**
     * Check if a school's license is valid. Grace period warning.
     */
    public static function checkLicense($schoolId) {
        $db   = Database::getConnection();
        $stmt = $db->prepare("SELECT * FROM licenses WHERE school_id = ? AND status = 'active' ORDER BY expires_at DESC LIMIT 1");
        $stmt->execute([$schoolId]);
        $license = $stmt->fetch();

        if (!$license) {
            self::sendResponse(null, ["code" => "LICENSE_REQUIRED", "message" => "No active license found for this school."], 403);
        }

        $expiryTime  = strtotime($license['expires_at']);
        $currentTime = time();

        if ($currentTime > $expiryTime) {
            $graceEnd = $expiryTime + (14 * 24 * 60 * 60);
            if ($currentTime > $graceEnd) {
                $stmtUpdate = $db->prepare("UPDATE licenses SET status = 'expired' WHERE id = ?");
                $stmtUpdate->execute([$license['id']]);
                self::sendResponse(null, ["code" => "LICENSE_EXPIRED", "message" => "The school's license has expired and the grace period has ended. Please renew."], 403);
            } else {
                self::logSystemEvent($schoolId, 'warning', 'LICENSE_EXPIRY_GRACE', "School license expired on {$license['expires_at']}. Accessing within 14-day grace period.");
            }
        }
    }

    /**
     * Increment token_version for a user, invalidating all their existing tokens.
     */
    public static function revokeUserTokens($userId) {
        try {
            $db = Database::getConnection();
            $db->prepare("UPDATE users SET token_version = token_version + 1 WHERE id = ?")->execute([$userId]);
        } catch (Exception $e) {
            error_log("Token revocation failed: " . $e->getMessage());
        }
    }

    /**
     * Generate a secure password reset token for a user.
     * Returns ['token' => rawToken, 'expires_at' => timestamp] or false.
     */
    public static function generatePasswordResetToken($userId) {
        try {
            $db        = Database::getConnection();
            $rawToken  = bin2hex(random_bytes(32)); // 64-char hex token
            $tokenHash = hash('sha256', $rawToken);
            $expiresAt = date('Y-m-d H:i:s', time() + 3600); // 1 hour

            // Invalidate any existing tokens for this user
            $db->prepare("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0")->execute([$userId]);

            $tokenId = Database::generateUniqueId('password_reset_tokens');
            $stmt    = $db->prepare("INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)");
            $stmt->execute([$tokenId, $userId, $tokenHash, $expiresAt]);

            return ['token' => $rawToken, 'expires_at' => $expiresAt];
        } catch (Exception $e) {
            error_log("Password reset token generation failed: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Validate a password reset token. Returns userId or false.
     */
    public static function validatePasswordResetToken($rawToken) {
        try {
            $db        = Database::getConnection();
            $tokenHash = hash('sha256', $rawToken);
            $stmt      = $db->prepare("SELECT user_id FROM password_reset_tokens
                                       WHERE token_hash = ? AND used = 0 AND expires_at > NOW()
                                       LIMIT 1");
            $stmt->execute([$tokenHash]);
            $row = $stmt->fetch();
            return $row ? $row['user_id'] : false;
        } catch (Exception $e) {
            error_log("Password reset token validation failed: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Mark a reset token as used after successful password change.
     */
    public static function consumePasswordResetToken($rawToken) {
        try {
            $db        = Database::getConnection();
            $tokenHash = hash('sha256', $rawToken);
            $db->prepare("UPDATE password_reset_tokens SET used = 1 WHERE token_hash = ?")->execute([$tokenHash]);
        } catch (Exception $e) {
            error_log("Password reset token consumption failed: " . $e->getMessage());
        }
    }

    /**
     * Log user activity in audit_logs.
     */
    public static function logAction($schoolId, $userId, $action, $entityType, $entityId, $description) {
        try {
            $db        = Database::getConnection();
            $ipAddress = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : null;
            $logId     = Database::generateUniqueId('audit_logs');
            $stmt      = $db->prepare("INSERT INTO audit_logs (id, school_id, user_id, action, entity_type, entity_id, description, ip_address)
                                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$logId, $schoolId, $userId, $action, $entityType, $entityId, $description, $ipAddress]);
        } catch (Exception $e) {
            error_log("Audit log failed: " . $e->getMessage());
        }
    }

    /**
     * Log platform/system status changes.
     */
    public static function logSystemEvent($schoolId, $severity, $eventType, $message) {
        try {
            $db      = Database::getConnection();
            $eventId = Database::generateUniqueId('system_events');
            $stmt    = $db->prepare("INSERT INTO system_events (id, school_id, severity, event_type, message)
                                     VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$eventId, $schoolId, $severity, $eventType, $message]);
        } catch (Exception $e) {
            error_log("System event log failed: " . $e->getMessage());
        }
    }

    /**
     * Send user notification helper.
     */
    public static function sendNotification($schoolId, $userId, $title, $message) {
        try {
            $db = Database::getConnection();
            $notificationId = Database::generateUniqueId('user_notifications');
            $stmt = $db->prepare("INSERT INTO user_notifications (id, school_id, user_id, title, message, is_read) VALUES (?, ?, ?, ?, ?, 0)");
            $stmt->execute([$notificationId, $schoolId, $userId, $title, $message]);
        } catch (Exception $e) {
            error_log("User notification insert failed: " . $e->getMessage());
        }
    }

    /**
     * Standard response helper.
     */
    public static function sendResponse($data, $error = null, $statusCode = 200, $meta = []) {
        header('Content-Type: application/json');
        header('X-API-Version: v1');
        http_response_code($statusCode);

        $response = [
            "data"  => $data,
            "meta"  => empty($meta) ? new stdClass() : $meta,
            "error" => $error
        ];

        echo json_encode($response);
        exit;
    }
}
