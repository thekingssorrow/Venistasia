<?php
// api/save.php

// --- CONFIG ---
$db_host = "localhost";
$db_user = "user25";
$db_pass = "25loom";
$db_name = "db25";
// -------------

header("Content-Type: application/json");

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

if (!$data || !isset($data["playerId"]) || !isset($data["state"])) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid payload"]);
    exit;
}

$playerId = $data["playerId"];
$stateJson = json_encode($data["state"], JSON_UNESCAPED_UNICODE);

// Connect
$mysqli = new mysqli($db_host, $db_user, $db_pass, $db_name);

if ($mysqli->connect_errno) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "DB connect failed"]);
    exit;
}

// Upsert (insert or update)
$sql = "
    INSERT INTO venistasia_saves (player_id, state_json)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = CURRENT_TIMESTAMP
";

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "DB prepare failed"]);
    exit;
}

$stmt->bind_param("ss", $playerId, $stateJson);
$ok = $stmt->execute();
$stmt->close();
$mysqli->close();

if (!$ok) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "DB execute failed"]);
    exit;
}

echo json_encode(["success" => true]);
