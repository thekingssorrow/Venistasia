<?php
// api/load.php

// --- CONFIG ---
$db_host = "localhost";
$db_user = "user25";
$db_pass = "25loom";
$db_name = "db25";
// ------------- 

header("Content-Type: application/json");

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

if (!$data || !isset($data["playerId"])) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid payload"]);
    exit;
}

$playerId = $data["playerId"];

$mysqli = new mysqli($db_host, $db_user, $db_pass, $db_name);

if ($mysqli->connect_errno) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "DB connect failed"]);
    exit;
}

$sql = "SELECT state_json FROM venistasia_saves WHERE player_id = ?";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "DB prepare failed"]);
    exit;
}
$stmt->bind_param("s", $playerId);
$stmt->execute();
$stmt->bind_result($stateJson);
$found = $stmt->fetch();
$stmt->close();
$mysqli->close();

if (!$found) {
    // No save yet – return success but no state
    echo json_encode(["success" => true, "state" => null]);
    exit;
}

$state = json_decode($stateJson, true);
echo json_encode(["success" => true, "state" => $state]);
