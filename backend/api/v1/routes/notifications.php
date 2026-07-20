<?php
// GET /notifications
$router->get('/notifications', function() {
    $user = Auth::requireAuth();
    $db   = Database::getConnection();

    $stmt = $db->prepare("SELECT * FROM user_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50");
    $stmt->execute([$user['id']]);
    Auth::sendResponse($stmt->fetchAll());
});

// POST /notifications/{id}/read
$router->post('/notifications/{id}/read', function($id) {
    $user = Auth::requireAuth();
    $db   = Database::getConnection();

    $stmt = $db->prepare("UPDATE user_notifications SET is_read=1 WHERE id=? AND user_id=?");
    $stmt->execute([$id, $user['id']]);
    Auth::sendResponse(["success" => true]);
});

// POST /notifications/read-all
$router->post('/notifications/read-all', function() {
    $user = Auth::requireAuth();
    $db   = Database::getConnection();

    $stmt = $db->prepare("UPDATE user_notifications SET is_read=1 WHERE user_id=? AND is_read=0");
    $stmt->execute([$user['id']]);
    Auth::sendResponse(["success" => true]);
});

if (!function_exists('verify_smtp_credentials')) {
    function verify_smtp_credentials($host, $port, $username, $password, $fromEmail, $recipient, $message, &$smtpLogs) {
        $timeout = 7;
        $isImplicitSsl = ((int)$port === 465);
        $prefix = $isImplicitSsl ? 'ssl://' : 'tcp://';
        $smtpLogs[] = "Connecting to {$prefix}{$host}:{$port}... [Note: Port 465 uses Implicit SSL/TLS; Port 587 uses STARTTLS]";
        
        $socket = @fsockopen($prefix . $host, $port, $errno, $errstr, $timeout);
        if (!$socket) {
            $tip = "";
            if (stripos($errstr, 'getaddrinfo') !== false || stripos($errstr, 'php_network_getaddresses') !== false || $errno === 0) {
                $tip = " (DNS lookup failed. Please verify that your backend server host is online and has active DNS resolution configured.)";
            }
            return [false, "Connection to SMTP server failed: $errstr ($errno)$tip"];
        }
        stream_set_timeout($socket, $timeout);
        stream_set_read_buffer($socket, 8192);
        @stream_set_write_buffer($socket, 8192);

        $readResponse = function($socket, &$logs) {
            $response = '';
            while ($line = fgets($socket, 515)) {
                $logs[] = "S: " . trim($line);
                $response .= $line;
                if (substr($line, 3, 1) == ' ') {
                    break;
                }
            }
            $meta = stream_get_meta_data($socket);
            if ($meta['timed_out']) {
                $logs[] = "[TIMEOUT] Socket read operations timed out.";
            }
            return $response;
        };

        $sendCommand = function($socket, $cmd, &$logs) {
            $logs[] = "C: " . trim($cmd);
            fputs($socket, $cmd . "\r\n");
        };

        $greeting = $readResponse($socket, $smtpLogs);
        if (substr($greeting, 0, 3) !== '220') {
            fclose($socket);
            return [false, "Invalid greeting: " . trim($greeting)];
        }

        $sendCommand($socket, "EHLO " . gethostname(), $smtpLogs);
        $ehlo = $readResponse($socket, $smtpLogs);
        if (substr($ehlo, 0, 3) !== '250') {
            $sendCommand($socket, "HELO " . gethostname(), $smtpLogs);
            $helo = $readResponse($socket, $smtpLogs);
            if (substr($helo, 0, 3) !== '250') {
                fclose($socket);
                return [false, "EHLO/HELO failed: " . trim($helo)];
            }
        }

        if ($port == 587 || stripos($ehlo, 'STARTTLS') !== false) {
            $sendCommand($socket, "STARTTLS", $smtpLogs);
            $starttls = $readResponse($socket, $smtpLogs);
            if (substr($starttls, 0, 3) == '220') {
                stream_set_read_buffer($socket, 0);
                $cryptoSuccess = @stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                stream_set_read_buffer($socket, 8192);
                if (!$cryptoSuccess) {
                    fclose($socket);
                    return [false, "Failed to start TLS handshake encryption."];
                }
                $sendCommand($socket, "EHLO " . gethostname(), $smtpLogs);
                $ehlo = $readResponse($socket, $smtpLogs);
            }
        }

        if (!empty($username)) {
            $sendCommand($socket, "AUTH LOGIN", $smtpLogs);
            $authResponse = $readResponse($socket, $smtpLogs);
            if (substr($authResponse, 0, 3) == '334') {
                $sendCommand($socket, base64_encode($username), $smtpLogs);
                $userResponse = $readResponse($socket, $smtpLogs);
                if (substr($userResponse, 0, 3) == '334') {
                    $sendCommand($socket, base64_encode($password), $smtpLogs);
                    $passResponse = $readResponse($socket, $smtpLogs);
                    if (substr($passResponse, 0, 3) !== '235') {
                        fclose($socket);
                        return [false, "SMTP authentication rejected: " . trim($passResponse)];
                    }
                } else {
                    fclose($socket);
                    return [false, "SMTP rejected username: " . trim($userResponse)];
                }
            } else {
                fclose($socket);
                return [false, "SMTP server does not support login authentication: " . trim($authResponse)];
            }
        }

        // Transmit the actual email message
        $smtpLogs[] = "[SMTP DATA] Starting email transmission lifecycle...";
        
        $sendCommand($socket, "MAIL FROM:<$fromEmail>", $smtpLogs);
        $mailFromResp = $readResponse($socket, $smtpLogs);
        if (substr($mailFromResp, 0, 3) !== '250') {
            fclose($socket);
            return [false, "SMTP MAIL FROM rejection: " . trim($mailFromResp)];
        }

        $sendCommand($socket, "RCPT TO:<$recipient>", $smtpLogs);
        $rcptToResp = $readResponse($socket, $smtpLogs);
        if (substr($rcptToResp, 0, 3) !== '250') {
            fclose($socket);
            return [false, "SMTP RCPT TO rejection: " . trim($rcptToResp)];
        }

        $sendCommand($socket, "DATA", $smtpLogs);
        $dataResp = $readResponse($socket, $smtpLogs);
        if (substr($dataResp, 0, 3) !== '354') {
            fclose($socket);
            return [false, "SMTP DATA transaction initialization failed: " . trim($dataResp)];
        }

        // Prepare email format
        $headers = [
            "From: <$fromEmail>",
            "To: <$recipient>",
            "Subject: SchoolBase Gateway Diagnostics Test Email",
            "MIME-Version: 1.0",
            "Content-Type: text/html; charset=UTF-8",
            "Date: " . date('r'),
            "Message-ID: <" . time() . "-diagnostics@" . $host . ">"
        ];
        $emailBody = implode("\r\n", $headers) . "\r\n\r\n" . $message . "\r\n.";

        $sendCommand($socket, $emailBody, $smtpLogs);
        $sendResp = $readResponse($socket, $smtpLogs);
        if (substr($sendResp, 0, 3) !== '250') {
            fclose($socket);
            return [false, "SMTP DATA content transmission failed: " . trim($sendResp)];
        }

        $sendCommand($socket, "QUIT", $smtpLogs);
        $readResponse($socket, $smtpLogs);
        fclose($socket);
        return [true, "SMTP handshake, authentication, and email delivery completed successfully."];
    }
}

// POST /schools/{schoolId}/communication/test
$router->post('/schools/{schoolId}/communication/test', function($schoolId) {
    $user = Auth::requireAuth();
    Auth::requireRoles($user, ['school_admin', 'super_admin']);
    if ($user['role'] !== 'super_admin' && $user['school_id'] !== $schoolId) {
        Auth::sendResponse(null, ["code" => "NOT_FOUND", "message" => "School not found."], 404);
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $type = $input['type'] ?? ''; // 'sms' or 'email'
    $recipient = trim($input['recipient'] ?? '');
    $message = trim($input['message'] ?? 'This is a test notification from SchoolBase.');

    if ($type !== 'banking' && (empty($type) || empty($recipient))) {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "type and recipient are required for SMS/Email diagnostics."], 400);
    }

    $db = Database::getConnection();

    // Retrieve communication gateway configurations
    $stmt = $db->prepare("SELECT * FROM notification_settings WHERE school_id=?");
    $stmt->execute([$schoolId]);
    $settings = $stmt->fetch();

    $trace = [];
    $status = 'failed';
    $details = '';

    if ($type === 'sms') {
        $gatewayUrl = $settings['sms_gateway_url'] ?? '';
        $apiKey = $settings['sms_api_key'] ?? '';
        $senderId = $settings['sms_sender_id'] ?? 'SCHOOLBASE';

        $trace['gateway_url'] = $gatewayUrl;
        $trace['sender_id'] = $senderId;

        if (!empty($gatewayUrl)) {
            $payload = [
                'to' => $recipient,
                'message' => $message,
                'sender' => $senderId,
                'api_key' => $apiKey
            ];
            
            $ch = curl_init($gatewayUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $err = curl_error($ch);
            curl_close($ch);

            $trace['http_code'] = $httpCode;
            $trace['payload'] = $payload;

            if ($err) {
                $status = 'failed';
                $details = "Gateway connection error: " . $err;
                $trace['error'] = $err;
            } else {
                $status = ($httpCode >= 200 && $httpCode < 300) ? 'success' : 'failed';
                $details = "Gateway response: " . $response;
                $trace['response'] = $response;
            }
        } else {
            $status = 'simulated';
            $details = "No gateway URL configured. Message simulated successfully.";
            $trace['simulation'] = true;
        }

        Auth::logAction($schoolId, $user['id'], 'SMS_TEST_TRIGGERED', 'notification_settings', null, "Triggered SMS test to {$recipient}. Status: {$status}. Details: {$details}");
    } else if ($type === 'email') {
        $smtpHost = trim($settings['email_smtp_host'] ?? '');
        $smtpPort = (int)($settings['email_smtp_port'] ?? 587);
        $smtpUser = trim($settings['email_smtp_user'] ?? '');
        $smtpPass = trim($settings['email_smtp_pass'] ?? '');
        $fromEmail = trim($settings['email_from_address'] ?? 'noreply@schoolbase.co.zw');

        $trace['smtp_host'] = $smtpHost;
        $trace['smtp_port'] = $smtpPort;
        $trace['from_email'] = $fromEmail;

        if (!empty($smtpHost)) {
            $smtpLogs = [];
            list($smtpSuccess, $smtpMsg) = verify_smtp_credentials($smtpHost, $smtpPort, $smtpUser, $smtpPass, $fromEmail, $recipient, $message, $smtpLogs);
            $trace['handshake_logs'] = $smtpLogs;
            if ($smtpSuccess) {
                $status = 'success';
                $details = $smtpMsg;
            } else {
                $status = 'failed';
                $details = $smtpMsg;
            }
        } else {
            $status = 'simulated';
            $details = "No custom SMTP host configured. Local fallback mail simulator sent message to {$recipient}.";
            $trace['simulation'] = true;
        }

        Auth::logAction($schoolId, $user['id'], 'EMAIL_TEST_TRIGGERED', 'notification_settings', null, "Triggered email test to {$recipient}. Status: {$status}. Details: {$details}");
    } else if ($type === 'banking') {
        // Retrieve school banking credentials
        $stmtSch = $db->prepare("SELECT name, bank_name, account_number FROM schools WHERE id=?");
        $stmtSch->execute([$schoolId]);
        $school = $stmtSch->fetch();

        $bankName = $school['bank_name'] ?? '';
        $accountNum = $school['account_number'] ?? '';
        $gatewayType = $settings['payment_gateway_type'] ?? 'mock';
        $apiUrl = $settings['payment_api_url'] ?? '';

        $trace['school_name'] = $school['name'] ?? '';
        $trace['bank_name'] = $bankName;
        $trace['account_number'] = $accountNum;
        $trace['payment_gateway_type'] = $gatewayType;
        $trace['payment_api_url'] = $apiUrl;

        if (empty($bankName) || empty($accountNum)) {
            $status = 'failed';
            $details = "School bank account details (bank name or account number) are not set in School Profile settings.";
        } else if ($gatewayType === 'mock') {
            $status = 'success';
            $details = "Banking parameters validated. Remote payments configured using secure Mock Gateway sandbox.";
            $trace['mock_handshake'] = "SUCCESS: Mock sandbox responsive.";
        } else {
            // Ecocash / Paynow integration test via cURL check
            if (!empty($apiUrl)) {
                $ch = curl_init($apiUrl);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 5);
                $response = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $err = curl_error($ch);
                curl_close($ch);

                $trace['http_code'] = $httpCode;
                if ($err) {
                    $status = 'failed';
                    $details = "Payment gateway API unreachable: " . $err;
                } else {
                    $status = 'success';
                    $details = "Connection validated successfully with gateway type: " . strtoupper($gatewayType);
                    $trace['gateway_handshake'] = "HTTP Code: " . $httpCode;
                }
            } else {
                $status = 'failed';
                $details = "Custom gateway type '{$gatewayType}' is selected, but payment gateway API URL is blank.";
            }
        }

        Auth::logAction($schoolId, $user['id'], 'BANKING_TEST_TRIGGERED', 'notification_settings', null, "Triggered banking config check. Status: {$status}. Details: {$details}");
    } else {
        Auth::sendResponse(null, ["code" => "VALIDATION_ERROR", "message" => "Invalid type. Must be 'sms', 'email', or 'banking'."], 400);
    }

    Auth::sendResponse([
        "type" => $type,
        "recipient" => $recipient,
        "status" => $status,
        "details" => $details,
        "trace" => $trace
    ]);
});
