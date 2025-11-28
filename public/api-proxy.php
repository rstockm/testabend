<?php
/**
 * OpenRouter API Proxy
 * 
 * Dieser Proxy leitet API-Requests an OpenRouter weiter und fügt den API-Key
 * aus der .htaccess Umgebungsvariable hinzu.
 * 
 * Sicherheit:
 * - API-Key wird nie an den Client gesendet
 * - CORS-Headers werden korrekt gesetzt
 * - Rate-Limiting möglich (später erweiterbar)
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Nur POST erlauben
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// API-Key aus Umgebungsvariable lesen (wird von .htaccess gesetzt)
$apiKey = getenv('OPENROUTER_API_KEY');

if (!$apiKey) {
    http_response_code(500);
    echo json_encode(['error' => 'API Key nicht konfiguriert']);
    exit;
}

// Request Body lesen
$requestBody = file_get_contents('php://input');
$data = json_decode($requestBody, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

// Endpoint bestimmen: Embeddings oder Chat Completions
// Prüfe ob 'input' vorhanden ist (Embeddings) oder 'messages' (Chat)
$endpoint = isset($data['input']) ? '/embeddings' : '/chat/completions';
$openRouterURL = 'https://openrouter.ai/api/v1' . $endpoint;

// cURL Request vorbereiten
$ch = curl_init($openRouterURL);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
        'HTTP-Referer: ' . (isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : $_SERVER['HTTP_HOST']),
        'X-Title: Testabend'
    ],
    CURLOPT_POSTFIELDS => $requestBody,
    CURLOPT_TIMEOUT => 120, // 2 Minuten Timeout für LLM-Requests
    CURLOPT_CONNECTTIMEOUT => 10
]);

// Request ausführen
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

// Fehlerbehandlung
if ($curlError) {
    http_response_code(500);
    echo json_encode(['error' => 'Network error: ' . $curlError]);
    exit;
}

// HTTP Status Code weiterleiten
http_response_code($httpCode);

// Response weiterleiten
echo $response;
