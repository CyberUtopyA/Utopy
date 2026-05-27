// src/utils/64.ts
// Encoder/decoder URL-safe para cualquier objeto, sin usar Buffer (compatible browser/Workers)

export function b64urlEncodeAny(obj: unknown): string {
  const json = JSON.stringify(obj ?? {});
  // UTF-8 -> binario -> base64
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  // URL-safe
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function b64urlDecodeAny<T = unknown>(b64url: string): T {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  // rellenar padding si hace falta
  const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0;
  const b64p = b64 + "=".repeat(pad);
  const bin = atob(b64p);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as T;
}
