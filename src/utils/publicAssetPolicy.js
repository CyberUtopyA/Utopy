// Only build artifacts and explicit shell files belong in the shared cache.
// Public-looking JSON, uploads and API responses are NOT an asset contract.
export function isPublicShellAsset(path) {
  const normalized = String(path).replace(/^\/?/, "");
  if (/[?#]/.test(normalized) || normalized.includes("..")) return false;
  return /^(?:index\.html|registerSW\.js|manifest\.webmanifest|favicon\.ico|apple-touch-icon\.png)$/.test(normalized)
    || /^icons\/[a-zA-Z0-9_-]+\.(?:png|svg|webp|ico)$/.test(normalized)
    || /^assets\/[a-zA-Z0-9_.-]+-[a-zA-Z0-9_-]{8,}\.(?:js|css|svg|png|jpe?g|webp|gif|woff2?)$/.test(normalized);
}

export function selectShellAssets(entries, optionalPattern, maxEntries = 220) {
  return entries.filter(entry => isPublicShellAsset(entry.url) && !optionalPattern.test(entry.url)).slice(0, maxEntries);
}
