<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Catalog-Key");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit;
}

$dataDir = __DIR__ . "/data";
$dataFile = $dataDir . "/catalog-live.json";

if (!is_dir($dataDir)) {
  mkdir($dataDir, 0775, true);
}

if (!file_exists($dataFile)) {
  file_put_contents($dataFile, json_encode([
    "items" => [],
    "updatedAt" => time()
  ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

function read_store($file) {
  $raw = file_get_contents($file);
  $json = json_decode($raw, true);
  if (!is_array($json)) {
    return ["items" => [], "updatedAt" => time()];
  }
  if (!isset($json["items"]) || !is_array($json["items"])) {
    $json["items"] = [];
  }
  return $json;
}

function write_store($file, $data) {
  $data["updatedAt"] = time();
  file_put_contents(
    $file,
    json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT),
    LOCK_EX
  );
}

if ($_SERVER["REQUEST_METHOD"] === "GET") {
  $store = read_store($dataFile);
  $items = $store["items"];

  $storeId = isset($_GET["storeId"]) ? trim($_GET["storeId"]) : "";

  if ($storeId !== "") {
    $items = array_values(array_filter($items, function ($item) use ($storeId) {
      $metaStore = $item["meta"]["storeId"] ?? "";
      $attrStore = $item["attrs"]["storeId"] ?? "";
      return $metaStore === $storeId || $attrStore === $storeId;
    }));
  }

  echo json_encode([
    "ok" => true,
    "count" => count($items),
    "items" => $items
  ], JSON_UNESCAPED_UNICODE);

  exit;
}

if ($_SERVER["REQUEST_METHOD"] === "POST") {
  $raw = file_get_contents("php://input");
  $body = json_decode($raw, true);

  if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "JSON inválido"]);
    exit;
  }

  $incoming = [];

  if (isset($body["items"]) && is_array($body["items"])) {
    $incoming = $body["items"];
  } elseif (isset($body["products"]) && is_array($body["products"])) {
    $incoming = $body["products"];
  } elseif (isset($body["item"]) && is_array($body["item"])) {
    $incoming = [$body["item"]];
  }

  if (!count($incoming)) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "No hay items"]);
    exit;
  }

  $store = read_store($dataFile);
  $items = $store["items"];

  $map = [];

  foreach ($items as $item) {
    if (isset($item["id"])) {
      $map[$item["id"]] = $item;
    }
  }

  foreach ($incoming as $item) {
    if (!is_array($item)) continue;

    $id = $item["id"] ?? null;

    if (!$id) {
      $id = "catalog:" . time() . ":" . bin2hex(random_bytes(4));
      $item["id"] = $id;
    }

    $map[$id] = $item;
  }

  $store["items"] = array_values($map);

  write_store($dataFile, $store);

  echo json_encode([
    "ok" => true,
    "saved" => count($incoming),
    "total" => count($store["items"])
  ], JSON_UNESCAPED_UNICODE);

  exit;
}

http_response_code(405);
echo json_encode(["ok" => false, "error" => "Método no permitido"]);