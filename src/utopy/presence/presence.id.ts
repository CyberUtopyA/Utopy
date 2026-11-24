export function makePresenceId(prefix = "presence") {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}:${uuid}`;
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 12)}`;
}
