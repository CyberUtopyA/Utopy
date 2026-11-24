const DB_NAME = "utopy.pay.keys.v1";
const STORE_NAME = "device-keys";

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function utf8(value: string) {
  return new TextEncoder().encode(value);
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function canonicalJson(value: any): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

export function secureId(prefix: string) {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    throw new Error("UTOPY Pay necesita un navegador con criptografía segura.");
  }
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return `${prefix}:${toBase64Url(bytes)}`;
}

export async function sha256(value: unknown) {
  if (!crypto?.subtle) {
    throw new Error("Web Crypto no está disponible.");
  }
  const digest = await crypto.subtle.digest("SHA-256", utf8(canonicalJson(value)));
  return toBase64Url(new Uint8Array(digest));
}

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readKeyPair(keyId: string): Promise<CryptoKeyPair | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(keyId);
    request.onsuccess = () => resolve((request.result as CryptoKeyPair) || null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function writeKeyPair(keyId: string, pair: CryptoKeyPair) {
  const db = await openKeyDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(pair, keyId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getOrCreateKeyPair(actorId: string) {
  if (!crypto?.subtle || typeof indexedDB === "undefined") {
    throw new Error("Este dispositivo no admite firma segura UTOPY.");
  }
  const keyId = `actor:${actorId}`;
  const stored = await readKeyPair(keyId);
  if (stored?.privateKey && stored?.publicKey) return stored;

  const pair = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  await writeKeyPair(keyId, pair);
  return pair;
}

export async function signUtopyPayload(actorId: string, payload: unknown) {
  const pair = await getOrCreateKeyPair(actorId);
  const canonical = canonicalJson(payload);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    pair.privateKey,
    utf8(canonical),
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const keyFingerprint = await sha256(publicJwk);
  return {
    algorithm: "ECDSA_P256_SHA256",
    signature: toBase64Url(new Uint8Array(signature)),
    publicJwk,
    keyFingerprint,
    payloadDigest: await sha256(payload),
  };
}

export async function verifyUtopySignature(
  payload: unknown,
  envelope: {
    algorithm?: string;
    signature?: string;
    publicJwk?: JsonWebKey;
    payloadDigest?: string;
    keyFingerprint?: string;
  },
) {
  if (
    envelope?.algorithm !== "ECDSA_P256_SHA256" ||
    !envelope.signature ||
    !envelope.publicJwk
  ) {
    return false;
  }
  const payloadDigest = await sha256(payload);
  if (payloadDigest !== envelope.payloadDigest) return false;
  if ((await sha256(envelope.publicJwk)) !== envelope.keyFingerprint) return false;
  const key = await crypto.subtle.importKey(
    "jwk",
    envelope.publicJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    fromBase64Url(envelope.signature),
    utf8(canonicalJson(payload)),
  );
}
