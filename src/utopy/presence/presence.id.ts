export function makePresenceId(prefix = "presence") {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}