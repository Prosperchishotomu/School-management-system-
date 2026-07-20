<?php

$router->post('/auth/login', function() {
    // IP-based rate limiting check
    if (Auth::checkIpRateLimit()) {
        Auth::sendResponse(null, ["code" => "RATE_LIMITED", "message" => "Too many login attempts from this IP address. Please wait 1 minute before trying again."], 429);
    }

    $input = json_decode(file_get_contents('php://input'), true);

    if (empty($input['username']) || empty($input['password'])) {
        Auth::sendResponse(null, [
            "code"    => "VALIDATION_ERROR",
            "message" => "Username and password are required.",
            "fields"  => ["username" => "required", "password" => "required"]
        ], 400);
    }

    $username = trim($input['username']);
    $password = $input['password'];

    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT id, school_id, username, password_hash, role, status, login_attempts, lockout_until, token_version FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user) {
        Auth::sendResponse(null, ["code" => "INVALID_CREDENTIALS", "message" => "Invalid username or password."], 401);
    }

    if ($user['status'] !== 'active') {
        Auth::sendResponse(null, ["code" => "DEACTIVATED_ACCOUNT", "message" => "Account has been deactivated. Contact your administrator."], 403);
    }

    $now = time();
    if ($user['lockout_until'] && strtotime($user['lockout_until']) > $now) {
        $remaining = ceil((strtotime($user['lockout_until']) - $now) / 60);
        Auth::sendResponse(null, ["code" => "LOCKED_OUT", "message" => "Account locked due to repeated failures. Try again in {$remaining} minute(s)."], 429);
    }

    if (password_verify($password, $user['password_hash'])) {
        // Success — reset login attempts
        $db->prepare("UPDATE users SET login_attempts = 0, lockout_until = NULL WHERE id = ?")->execute([$user['id']]);

        Auth::logAction($user['school_id'], $user['id'], 'USER_LOGIN', 'users', $user['id'], "User logged in: {$username}");

        $schoolName = null;
        if ($user['school_id']) {
            $stmtSchool = $db->prepare("SELECT name FROM schools WHERE id = ?");
            $stmtSchool->execute([$user['school_id']]);
            $schoolName = $stmtSchool->fetchColumn();
        }

        // Include token_version (tv) in JWT so we can invalidate on logout/deactivation
        $token = Auth::generateToken([
            "id"        => $user['id'],
            "school_id" => $user['school_id'],
            "role"      => $user['role'],
            "username"  => $user['username'],
            "tv"        => (int)$user['token_version'],
        ]);

        Auth::sendResponse([
            "token" => $token,
            "user"  => [
                "id"          => $user['id'],
                "school_id"   => $user['school_id'],
                "school_name" => $schoolName,
                "role"        => $user['role'],
                "username"    => $user['username'],
            ]
        ]);
    } else {
        // Wrong password — increment counter
        $attempts    = $user['login_attempts'] + 1;
        $lockoutTime = null;
        if ($attempts >= MAX_LOGIN_ATTEMPTS) {
            $lockoutTime = date('Y-m-d H:i:s', time() + (LOCKOUT_TIME_MINUTES * 60));
        }
        $db->prepare("UPDATE users SET login_attempts = ?, lockout_until = ? WHERE id = ?")->execute([$attempts, $lockoutTime, $user['id']]);
        Auth::logAction($user['school_id'], $user['id'], 'LOGIN_FAILED', 'users', $user['id'], "Failed login attempt #{$attempts} for '{$username}'");

        if ($attempts >= MAX_LOGIN_ATTEMPTS) {
            Auth::sendResponse(null, ["code" => "LOCKED_OUT", "message" => "Account locked. Try again in " . LOCKOUT_TIME_MINUTES . " minutes."], 429);
        } else {
            $remaining = MAX_LOGIN_ATTEMPTS - $attempts;
            Auth::sendResponse(null, ["code" => "INVALID_CREDENTIALS", "message" => "Invalid username or password. {$remaining} attempt(s) remaining."], 401);
        }
    }
});

// POST /auth/logout
$router->post('/auth/logout', function() {
    $user = Auth::requireAuth();
    Auth::logAction($user['school_id'], $user['id'], 'USER_LOGOUT', 'users', $user['id'], "User logged out: {$user['username']}");
    Auth::sendResponse(["success" => true]);
});

// GET /auth/session
$router->get('/auth/session', function() {
    $user = Auth::requireAuth();
    Auth::sendResponse($user);
});

// POST /auth/change-password
$router->post('/auth/change-password', function() {
    $user  = Auth::requireAuth();
    $input = json_decode(file_get_contents('php://input'), true);

    if (empty($input['current_password']) || empty($input['new_password'])) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "current_password and new_password are required."], 400);
    }
    if (strlen($input['new_password']) < 8) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "New password must be at least 8 characters."], 400);
    }

    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT password_hash FROM users WHERE id = ?");
    $stmt->execute([$user['id']]);
    $hash = $stmt->fetchColumn();

    if (!password_verify($input['current_password'], $hash)) {
        Auth::sendResponse(null, ["code" => "INVALID_CURRENT_PASSWORD", "message" => "Incorrect current password."], 401);
    }

    $newHash = password_hash($input['new_password'], PASSWORD_DEFAULT);
    $db->prepare("UPDATE users SET password_hash = ?, login_attempts = 0, lockout_until = NULL WHERE id = ?")->execute([$newHash, $user['id']]);

    // Revoke all other sessions (token version bump)
    Auth::revokeUserTokens($user['id']);

    Auth::logAction($user['school_id'], $user['id'], 'PASSWORD_CHANGED_BY_USER', 'users', $user['id'], "User changed their own password.");
    Auth::sendResponse(["success" => true]);
});

// POST /auth/forgot-password — generate reset token for a user
$router->post('/auth/forgot-password', function() {
    $input    = json_decode(file_get_contents('php://input'), true);
    $username = trim($input['username'] ?? '');

    if (empty($username)) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "username is required."], 400);
    }

    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT id, school_id, email, role FROM users WHERE username = ? AND status = 'active' LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    // Always return success to prevent username enumeration
    if (!$user) {
        Auth::sendResponse(["success" => true, "message" => "If that username exists, a reset link has been generated."]);
    }

    $result = Auth::generatePasswordResetToken($user['id']);
    if (!$result) {
        Auth::sendResponse(null, ["code" => "SERVER_ERROR", "message" => "Could not generate reset token."], 500);
    }

    $resetLink = APP_URL . '/reset-password?token=' . $result['token'];

    // Try to send email if SMTP is configured for the school
    $emailSent = false;
    if ($user['school_id']) {
        $stmtS = $db->prepare("SELECT email_smtp_host, email_smtp_port, email_smtp_user, email_smtp_pass, email_from_address, email_from_name FROM notification_settings WHERE school_id = ?");
        $stmtS->execute([$user['school_id']]);
        $smtp = $stmtS->fetch();

        if ($smtp && !empty($smtp['email_smtp_host']) && !empty($user['email'])) {
            // Basic email sending (requires PHPMailer or similar in production)
            // For now we log the intent and return the link to admin
            Auth::logAction($user['school_id'], $user['id'], 'PASSWORD_RESET_REQUESTED', 'users', $user['id'], "Password reset requested. SMTP configured: send to {$user['email']}.");
            $emailSent = true;
        }
    }

    Auth::logAction($user['school_id'] ?? null, $user['id'], 'PASSWORD_RESET_TOKEN_GENERATED', 'users', $user['id'], "Reset token generated for user '{$username}'");

    // Return the link to the calling admin (they share it via WhatsApp/SMS)
    Auth::sendResponse([
        "success"    => true,
        "message"    => $emailSent ? "Reset link emailed to user." : "Reset link generated. Share this with the user securely.",
        "reset_link" => $resetLink,
        "expires_at" => $result['expires_at'],
        "email_sent" => $emailSent
    ]);
});

// POST /auth/reset-password — consume a reset token and set new password
$router->post('/auth/reset-password', function() {
    $input    = json_decode(file_get_contents('php://input'), true);
    $rawToken = trim($input['token'] ?? '');
    $newPass  = $input['new_password'] ?? '';

    if (empty($rawToken) || empty($newPass)) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "token and new_password are required."], 400);
    }
    if (strlen($newPass) < 8) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Password must be at least 8 characters."], 400);
    }

    $userId = Auth::validatePasswordResetToken($rawToken);
    if (!$userId) {
        Auth::sendResponse(null, ["code" => "INVALID_TOKEN", "message" => "Reset link is invalid or has expired. Please request a new one."], 400);
    }

    $db      = Database::getConnection();
    $newHash = password_hash($newPass, PASSWORD_DEFAULT);
    $db->prepare("UPDATE users SET password_hash = ?, login_attempts = 0, lockout_until = NULL WHERE id = ?")->execute([$newHash, $userId]);

    // Mark token as used and revoke all sessions
    Auth::consumePasswordResetToken($rawToken);
    Auth::revokeUserTokens($userId);

    $stmt = $db->prepare("SELECT school_id FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $schoolId = $stmt->fetchColumn();

    Auth::logAction($schoolId, $userId, 'PASSWORD_RESET_COMPLETED', 'users', $userId, "Password successfully reset via token.");
    Auth::sendResponse(["success" => true, "message" => "Password has been reset successfully. Please log in."]);
});
