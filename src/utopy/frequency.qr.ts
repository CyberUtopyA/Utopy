export function frequencyQrReference(frequencyId: string): string {
  const safeId = String(frequencyId || "").trim();
  // utopy@2.0.0-beta.1 todavía no exporta frequency.qr(); este es el
  // contrato de referencia segura compatible para sustituirlo al aparecer.
  return `/r/${encodeURIComponent(safeId)}`;
}

export function frequencyShareUrl(frequencyId: string): string {
  const reference = frequencyQrReference(frequencyId);
  return typeof location === "undefined" ? reference : new URL(reference, location.origin).href;
}
