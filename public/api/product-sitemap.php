<?php
header("Content-Type: application/xml; charset=utf-8");

$dataFile = __DIR__ . "/data/catalog-live.json";
$baseUrl = "https://market.utopy.live";

function xml_escape($str) {
  return htmlspecialchars((string)$str, ENT_XML1 | ENT_QUOTES, "UTF-8");
}

function get_item_id($item) {
  return $item["id"] ?? "";
}

function get_lastmod($item) {
  $ts =
    $item["meta"]["ts"] ??
    $item["attrs"]["ts"] ??
    $item["meta"]["updatedAt"] ??
    null;

  if (!$ts) {
    return date("Y-m-d");
  }

  if (is_numeric($ts)) {
    return date("Y-m-d", intval($ts));
  }

  $time = strtotime($ts);
  if (!$time) return date("Y-m-d");

  return date("Y-m-d", $time);
}

function is_visible_product($item) {
  if (!is_array($item)) return false;

  $kind = strtolower((string)($item["kind"] ?? ""));
  $traits = $item["traits"] ?? [];
  if (!is_array($traits)) $traits = [];

  $traitsText = strtolower(implode(" ", array_map("strval", $traits)));

  $isProduct =
    str_contains($kind, "producto") ||
    str_contains($kind, "product") ||
    str_contains($traitsText, "mt:producto") ||
    str_contains($traitsText, "mt:catalog") ||
    str_contains($traitsText, "mt:vendible");

  if (!$isProduct) return false;

  $hidden =
    ($item["meta"]["hidden"] ?? false) === true ||
    ($item["attrs"]["hidden"] ?? false) === true;

  if ($hidden) return false;

  $status = strtolower((string)(
    $item["meta"]["status"] ??
    $item["attrs"]["status"] ??
    "active"
  ));

  if (in_array($status, ["out_of_stock", "closed", "completed", "cancelled"])) {
    return false;
  }

  return true;
}

$items = [];

if (file_exists($dataFile)) {
  $raw = file_get_contents($dataFile);
  $json = json_decode($raw, true);

  if (isset($json["items"]) && is_array($json["items"])) {
    $items = $json["items"];
  }
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

foreach ($items as $item) {
  if (!is_visible_product($item)) continue;

  $id = get_item_id($item);
  if (!$id) continue;

  $loc = $baseUrl . "/producto/" . rawurlencode($id);
  $lastmod = get_lastmod($item);

  echo "  <url>\n";
  echo "    <loc>" . xml_escape($loc) . "</loc>\n";
  echo "    <lastmod>" . xml_escape($lastmod) . "</lastmod>\n";
  echo "    <changefreq>weekly</changefreq>\n";
  echo "    <priority>0.8</priority>\n";
  echo "  </url>\n";
}

echo "</urlset>\n";