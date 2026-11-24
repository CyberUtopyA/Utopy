// A provider is unhealthy only when its entire visible batch fails.
export function createTileRecoveryHandlers({ backup, onReady, onFallback, onUnavailable }) {
  let loaded = 0;
  let errors = 0;
  return {
    loading() { loaded = 0; errors = 0; },
    tileload() { loaded += 1; onReady(); },
    tileerror() { errors += 1; },
    load() {
      if (loaded || !errors) return;
      if (backup) onUnavailable();
      else onFallback();
    },
  };
}
