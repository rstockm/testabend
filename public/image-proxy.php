<?php
/**
 * Image Proxy für Cover-Bilder
 * Stellt sicher, dass Bilder korrekt als image/jpeg serviert werden
 * und nicht von der SPA-Rewrite-Regel abgefangen werden
 */

// Pfad zum Bild relativ zum Document Root
$imagePath = $_GET['path'] ?? '';

// Sicherheitsprüfung: Nur Bilder aus dem covers-Verzeichnis erlauben
if (empty($imagePath) || strpos($imagePath, 'images/covers/') !== 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid image path']);
    exit();
}

// Vollständiger Pfad zum Bild
$fullPath = __DIR__ . '/' . $imagePath;

// Prüfe ob Datei existiert
if (!file_exists($fullPath)) {
    http_response_code(404);
    echo json_encode(['error' => 'Image not found']);
    exit();
}

// Prüfe ob es wirklich eine Datei ist (nicht ein Verzeichnis)
if (!is_file($fullPath)) {
    http_response_code(400);
    echo json_encode(['error' => 'Not a file']);
    exit();
}

// Bestimme Content-Type basierend auf Dateiendung
$extension = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
$contentTypes = [
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'gif' => 'image/gif',
    'webp' => 'image/webp'
];

$contentType = $contentTypes[$extension] ?? 'image/jpeg';

// Setze Header
header('Content-Type: ' . $contentType);
header('Cache-Control: public, max-age=31536000'); // 1 Jahr Cache
header('Expires: ' . gmdate('D, d M Y H:i:s', time() + 31536000) . ' GMT');

// Lese und sende Bild
readfile($fullPath);
?>

