<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método no permitido'], JSON_UNESCAPED_UNICODE);
    exit;
}

$configPath = dirname(__DIR__) . '/utopy-bootstrap-nodes.json';
$config = json_decode((string) @file_get_contents($configPath), true);
$nodeKey = trim((string) ($_GET['node'] ?? ''));
$resource = trim((string) ($_GET['resource'] ?? ''));
$urlField = [
    'manifest' => 'remoteManifestUrl',
    'catalog' => 'remoteCatalogUrl',
    'profile' => 'remoteProfileUrl',
][$resource] ?? null;

if (!$urlField || !$nodeKey || !is_array($config)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Fuente inválida'], JSON_UNESCAPED_UNICODE);
    exit;
}

$source = null;
foreach (($config['sources'] ?? []) as $candidate) {
    if (!is_array($candidate) || ($candidate['enabled'] ?? true) === false) continue;
    if (($candidate['id'] ?? '') === $nodeKey || ($candidate['nodeId'] ?? '') === $nodeKey) {
        $source = $candidate;
        break;
    }
}

$target = is_array($source) ? trim((string) ($source[$urlField] ?? '')) : '';
$parts = $target ? parse_url($target) : false;
if (!$parts || strtolower((string) ($parts['scheme'] ?? '')) !== 'https' || empty($parts['host'])) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Nodo no registrado'], JSON_UNESCAPED_UNICODE);
    exit;
}

$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'timeout' => 12,
        'ignore_errors' => true,
        'follow_location' => 0,
        'header' => "Accept: application/json\r\nUser-Agent: UTOPY-Node-Discovery/1.0\r\n",
    ],
    'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
]);

$body = @file_get_contents($target, false, $context);
$status = 502;
foreach (($http_response_header ?? []) as $header) {
    if (preg_match('/^HTTP\/\S+\s+(\d{3})/', $header, $match)) {
        $status = (int) $match[1];
        break;
    }
}

if ($body === false || $status < 200 || $status >= 300 || json_decode($body, true) === null) {
    http_response_code($status >= 400 && $status < 600 ? $status : 502);
    echo json_encode(['ok' => false, 'error' => 'El nodo no respondió con JSON válido'], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(200);
echo $body;
