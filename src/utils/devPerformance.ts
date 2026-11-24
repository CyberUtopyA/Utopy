export function measureDev<T>(name: string, work: () => T): T {
  if (!import.meta.env.DEV || typeof performance === "undefined") return work();

  const start = `${name}:start`;
  const end = `${name}:end`;
  performance.clearMarks(start);
  performance.clearMarks(end);
  performance.clearMeasures(name);
  performance.mark(start);

  try {
    return work();
  } finally {
    performance.mark(end);
    performance.measure(name, start, end);
    performance.clearMarks(start);
    performance.clearMarks(end);
  }
}
