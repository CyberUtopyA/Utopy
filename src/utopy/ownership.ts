// src/utopy/ownership.ts
// Billetera UTOPY v2: DID estable, firma por dispositivo, recuperación cifrada,
// rotación y revocación. No administra dinero ni sustituye un escrow.

export type RecoveryEnvelope = {
  protocol: "utopy.wallet.recovery/2";
  ownerDid: string;
  createdAt: string;
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string };
  cipher: { name: "AES-GCM"; iv: string; data: string };
};

export type RootKeyRecord = {
  sequence: number;
  keyId: string;
  publicKeyJwk: JsonWebKey;
  activeFrom: string;
  previousKeyId?: string | null;
  transition?: {
    previousSignature: string;
    nextSignature: string;
  } | null;
};

export type DeviceCertificate = {
  protocol: "utopy.device.certificate/1";
  ownerDid: string;
  deviceId: string;
  deviceName: string;
  keyId: string;
  rootKeyId: string;
  publicKeyJwk: JsonWebKey;
  permissions: Array<"sign" | "replicate" | "export-data">;
  issuedAt: string;
  signature: string;
};

export type DeviceRevocation = {
  protocol: "utopy.device.revocation/1";
  ownerDid: string;
  deviceId: string;
  rootKeyId: string;
  reason: string;
  revokedAt: string;
  signature: string;
};

export type WalletManifest = {
  protocol: "utopy.wallet/2";
  ownerDid: string;
  createdAt: string;
  updatedAt: string;
  rootHistory: RootKeyRecord[];
  devices: DeviceCertificate[];
  revocations: DeviceRevocation[];
};

export type OwnerIdentity = {
  did: string;
  keyId: string;
  deviceId: string;
  deviceName: string;
  publicKeyJwk: JsonWebKey;
  createdAt: string;
  custody: "device" | "ephemeral";
  recovery: "not-configured" | "encrypted";
};

type StoredOwnerIdentity = OwnerIdentity & {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  manifest: WalletManifest;
  deviceCertificate: DeviceCertificate;
  encryptedRecovery: RecoveryEnvelope | null;
  bootstrapRootPrivateKey?: CryptoKey | null;
};

export type WalletStatus = {
  ownerDid: string;
  deviceId: string;
  deviceName: string;
  recoveryReady: boolean;
  rootSequence: number;
  activeDevices: DeviceCertificate[];
  revokedDevices: DeviceRevocation[];
  custody: OwnerIdentity["custody"];
};

const DB_NAME = "utopy.wallet.v2";
const STORE_NAME = "wallet";
const TRUST_STORE = "trust";
const RECORD_ID = "primary";
const KDF_ITERATIONS = 600_000;
let memoryIdentity: StoredOwnerIdentity | null = null;
let identityInitialization: Promise<StoredOwnerIdentity> | null = null;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((output: Record<string, any>, key) => {
    if (value[key] !== undefined) output[key] = stable(value[key]);
    return output;
  }, {});
}

function canonical(value: any): string {
  return JSON.stringify(stable(value));
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function randomId(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return `${prefix}:${bytesToBase64Url(bytes)}`;
}

function publicPart(jwk: JsonWebKey): JsonWebKey {
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, key_ops: ["verify"], ext: true };
}

async function importPublic(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", publicPart(jwk), { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
}

async function importPrivate(jwk: JsonWebKey, extractable = false): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, extractable, ["sign"]);
}

async function generatePair() {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  ) as CryptoKeyPair;
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return {
    privateJwk,
    publicJwk: publicPart(publicJwk),
    privateKey: await importPrivate(privateJwk, false),
    publicKey: await importPublic(publicJwk),
  };
}

async function signValue(key: CryptoKey, value: any): Promise<string> {
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(canonical(value))
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

async function verifyValue(key: CryptoKey, value: any, signature: string): Promise<boolean> {
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    asArrayBuffer(base64UrlToBytes(signature)),
    new TextEncoder().encode(canonical(value))
  );
}

function withoutField<T extends Record<string, any>>(value: T, field: string) {
  const { [field]: _removed, ...rest } = value;
  return rest;
}

function rootTransitionPayload(record: RootKeyRecord) {
  return {
    protocol: "utopy.root.rotation/1",
    sequence: record.sequence,
    keyId: record.keyId,
    publicKeyJwk: record.publicKeyJwk,
    activeFrom: record.activeFrom,
    previousKeyId: record.previousKeyId || null,
  };
}

function certificatePayload(certificate: DeviceCertificate) {
  return withoutField(certificate, "signature");
}

function revocationPayload(revocation: DeviceRevocation) {
  return withoutField(revocation, "signature");
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB no disponible"));
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
      if (!request.result.objectStoreNames.contains(TRUST_STORE)) {
        request.result.createObjectStore(TRUST_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir la billetera"));
  });
}

async function readStored(): Promise<StoredOwnerIdentity | null> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(RECORD_ID);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function persist(identity: StoredOwnerIdentity) {
  if (identity.custody === "ephemeral") { memoryIdentity = identity; return; }
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(identity, RECORD_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
  memoryIdentity = identity;
  const latestRoot = identity.manifest.rootHistory.at(-1);
  await rememberOwnershipState(identity.did, latestRoot?.sequence || 1, identity.manifest.revocations, latestRoot?.activeFrom);
  window.dispatchEvent(new CustomEvent("utopy.wallet.changed", { detail: { ownerDid: identity.did } }));
}

type TrustedOwnerState = {
  ownerDid: string;
  rootSequence: number;
  rootActiveFrom: string;
  revocations: DeviceRevocation[];
  updatedAt: string;
};

async function readOwnershipState(ownerDid: string): Promise<TrustedOwnerState | null> {
  try {
    const db = await openDB();
    const value = await new Promise<TrustedOwnerState | null>((resolve, reject) => {
      const request = db.transaction(TRUST_STORE, "readonly").objectStore(TRUST_STORE).get(ownerDid);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  } catch { return null; }
}

async function rememberOwnershipState(ownerDid: string, rootSequence: number, revocations: DeviceRevocation[], rootActiveFrom = new Date(0).toISOString()) {
  try {
    const current = await readOwnershipState(ownerDid);
    const byDevice = new Map<string, DeviceRevocation>();
    for (const item of [...(current?.revocations || []), ...revocations]) {
      const previous = byDevice.get(item.deviceId);
      if (!previous || Date.parse(item.revokedAt) >= Date.parse(previous.revokedAt)) byDevice.set(item.deviceId, item);
    }
    const state: TrustedOwnerState = {
      ownerDid,
      rootSequence: Math.max(current?.rootSequence || 0, rootSequence),
      rootActiveFrom: rootSequence >= (current?.rootSequence || 0) ? rootActiveFrom : current!.rootActiveFrom,
      revocations: Array.from(byDevice.values()),
      updatedAt: new Date().toISOString(),
    };
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(TRUST_STORE, "readwrite");
      tx.objectStore(TRUST_STORE).put(state, ownerDid);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* El modo efímero no tiene registro persistente. */ }
}

async function makeCertificate(
  ownerDid: string,
  rootKeyId: string,
  rootPrivateKey: CryptoKey,
  deviceId: string,
  deviceName: string,
  publicKeyJwk: JsonWebKey
): Promise<DeviceCertificate> {
  const unsigned = {
    protocol: "utopy.device.certificate/1" as const,
    ownerDid,
    deviceId,
    deviceName: deviceName.trim() || "Mi dispositivo",
    keyId: `${ownerDid}#${deviceId}`,
    rootKeyId,
    publicKeyJwk: publicPart(publicKeyJwk),
    permissions: ["sign", "replicate", "export-data"] as Array<"sign" | "replicate" | "export-data">,
    issuedAt: new Date().toISOString(),
  };
  return { ...unsigned, signature: await signValue(rootPrivateKey, unsigned) };
}

async function createLocalIdentity(custody: OwnerIdentity["custody"]): Promise<StoredOwnerIdentity> {
  const root = await generatePair();
  const fingerprint = bytesToBase64Url(await sha256(canonical(root.publicJwk))).slice(0, 40);
  const did = `did:utopy:${fingerprint}`;
  const rootKeyId = `${did}#root-1`;
  const device = await generatePair();
  const deviceId = randomId("device");
  const certificate = await makeCertificate(did, rootKeyId, root.privateKey, deviceId, "Este dispositivo", device.publicJwk);
  const now = new Date().toISOString();
  const manifest: WalletManifest = {
    protocol: "utopy.wallet/2",
    ownerDid: did,
    createdAt: now,
    updatedAt: now,
    rootHistory: [{ sequence: 1, keyId: rootKeyId, publicKeyJwk: root.publicJwk, activeFrom: now }],
    devices: [certificate],
    revocations: [],
  };
  return {
    did,
    keyId: certificate.keyId,
    deviceId,
    deviceName: certificate.deviceName,
    publicKeyJwk: device.publicJwk,
    createdAt: now,
    custody,
    recovery: "not-configured",
    privateKey: device.privateKey,
    publicKey: device.publicKey,
    manifest,
    deviceCertificate: certificate,
    encryptedRecovery: null,
    bootstrapRootPrivateKey: root.privateKey,
  };
}

export async function getOrCreateOwnerIdentity(): Promise<StoredOwnerIdentity> {
  if (memoryIdentity) return memoryIdentity;
  if (identityInitialization) return identityInitialization;
  const initialize=async():Promise<StoredOwnerIdentity>=>{
  try {
    const stored = await readStored();
    if (stored?.privateKey && stored?.manifest?.protocol === "utopy.wallet/2") {
      memoryIdentity = stored;
      return stored;
    }
    if(stored)throw new Error("El registro de identidad existente requiere recuperación; no se sobrescribirá.");
    const created = await createLocalIdentity("device");
    await persist(created);
    return created;
  } catch (error) {
    console.warn("[UTOPY Wallet] Persistencia no disponible; identidad temporal.", error);
    memoryIdentity = await createLocalIdentity("ephemeral");
    return memoryIdentity;
  }
  };
  // One wallet bootstrap for all concurrent consumers; same-origin tabs share
  // the browser lock where available, then re-read IndexedDB inside that lock.
  identityInitialization=(typeof navigator!=="undefined"&&navigator.locks?.request
    ? navigator.locks.request("utopy.wallet.primary.initialize",initialize)
    : initialize());
  try{return await identityInitialization;}finally{identityInitialization=null;}
}

async function deriveEncryptionKey(passphrase: string, salt: Uint8Array) {
  if (passphrase.length < 12) throw new Error("Usa una contraseña de al menos 12 caracteres.");
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: asArrayBuffer(salt), iterations: KDF_ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptRecovery(payload: any, passphrase: string, ownerDid: string): Promise<RecoveryEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(passphrase, salt);
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(ownerDid) },
    key,
    new TextEncoder().encode(canonical(payload))
  );
  return {
    protocol: "utopy.wallet.recovery/2",
    ownerDid,
    createdAt: new Date().toISOString(),
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: KDF_ITERATIONS, salt: bytesToBase64Url(salt) },
    cipher: { name: "AES-GCM", iv: bytesToBase64Url(iv), data: bytesToBase64Url(new Uint8Array(data)) },
  };
}

async function decryptRecovery(envelope: RecoveryEnvelope, passphrase: string): Promise<any> {
  if (envelope?.protocol !== "utopy.wallet.recovery/2") throw new Error("Respaldo UTOPY incompatible.");
  if (envelope.kdf.iterations < 300_000) throw new Error("El respaldo usa una protección insuficiente.");
  const key = await deriveEncryptionKey(passphrase, base64UrlToBytes(envelope.kdf.salt));
  try {
    const clear = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: asArrayBuffer(base64UrlToBytes(envelope.cipher.iv)),
        additionalData: new TextEncoder().encode(envelope.ownerDid),
      },
      key,
      asArrayBuffer(base64UrlToBytes(envelope.cipher.data))
    );
    return JSON.parse(new TextDecoder().decode(clear));
  } catch {
    throw new Error("Contraseña incorrecta o respaldo modificado.");
  }
}

async function verifyRootHistory(ownerDid: string, history: RootKeyRecord[]): Promise<boolean> {
  if (!history.length) return false;
  const firstFingerprint = bytesToBase64Url(await sha256(canonical(publicPart(history[0].publicKeyJwk)))).slice(0, 40);
  if (ownerDid !== `did:utopy:${firstFingerprint}`) return false;
  for (let index = 1; index < history.length; index += 1) {
    const previous = history[index - 1];
    const next = history[index];
    if (next.sequence !== previous.sequence + 1 || next.previousKeyId !== previous.keyId || !next.transition) return false;
    const payload = rootTransitionPayload(next);
    const previousOk = await verifyValue(await importPublic(previous.publicKeyJwk), payload, next.transition.previousSignature);
    const nextOk = await verifyValue(await importPublic(next.publicKeyJwk), payload, next.transition.nextSignature);
    if (!previousOk || !nextOk) return false;
  }
  return true;
}

async function rootFromRecovery(identity: StoredOwnerIdentity, passphrase: string) {
  if (!identity.encryptedRecovery) throw new Error("Primero activa la recuperación cifrada.");
  const clear = await decryptRecovery(identity.encryptedRecovery, passphrase);
  if (clear.ownerDid !== identity.did) throw new Error("El respaldo pertenece a otra identidad.");
  const latest = identity.manifest.rootHistory.at(-1);
  if (!latest || canonical(publicPart(clear.rootPrivateJwk)) !== canonical(publicPart(latest.publicKeyJwk))) {
    throw new Error("La clave maestra no coincide con el manifiesto actual.");
  }
  return { clear, privateKey: await importPrivate(clear.rootPrivateJwk, false), privateJwk: clear.rootPrivateJwk as JsonWebKey };
}

async function recoveryPayload(identity: StoredOwnerIdentity, rootPrivateJwk: JsonWebKey, dataDvs: any[] = []) {
  return {
    protocol: "utopy.wallet.recovery.payload/2",
    ownerDid: identity.did,
    rootPrivateJwk,
    manifest: identity.manifest,
    dataDvs: dataDvs.slice(-5000),
    createdAt: new Date().toISOString(),
  };
}

export async function createEncryptedRecovery(passphrase: string, dvs: any[] = []): Promise<Blob> {
  let identity = await getOrCreateOwnerIdentity();
  let rootPrivateJwk: JsonWebKey;
  let preservedDvs: any[] = [];

  if (!identity.encryptedRecovery) {
    if (!identity.bootstrapRootPrivateKey) throw new Error("No hay clave maestra para activar la recuperación.");
    const previous = identity.manifest.rootHistory.at(-1)!;
    const nextRoot = await generatePair();
    const sequence = previous.sequence + 1;
    const nextBase: RootKeyRecord = {
      sequence,
      keyId: `${identity.did}#root-${sequence}`,
      publicKeyJwk: nextRoot.publicJwk,
      activeFrom: new Date().toISOString(),
      previousKeyId: previous.keyId,
    };
    const payload = rootTransitionPayload(nextBase);
    const nextRecord: RootKeyRecord = {
      ...nextBase,
      transition: {
        previousSignature: await signValue(identity.bootstrapRootPrivateKey, payload),
        nextSignature: await signValue(nextRoot.privateKey, payload),
      },
    };
    const certificate = await makeCertificate(
      identity.did,
      nextRecord.keyId,
      nextRoot.privateKey,
      identity.deviceId,
      identity.deviceName,
      identity.publicKeyJwk
    );
    identity = {
      ...identity,
      keyId: certificate.keyId,
      recovery: "encrypted",
      deviceCertificate: certificate,
      bootstrapRootPrivateKey: null,
      manifest: {
        ...identity.manifest,
        updatedAt: new Date().toISOString(),
        rootHistory: [...identity.manifest.rootHistory, nextRecord],
        devices: [...identity.manifest.devices.filter((item) => item.deviceId !== identity.deviceId), certificate],
      },
    };
    rootPrivateJwk = nextRoot.privateJwk;
  } else {
    const opened = await rootFromRecovery(identity, passphrase);
    rootPrivateJwk = opened.privateJwk;
    preservedDvs = Array.isArray(opened.clear?.dataDvs) ? opened.clear.dataDvs : [];
  }

  const requestedDvs = Array.isArray(dvs) && dvs.length ? dvs : preservedDvs;
  const ownedDvs = requestedDvs
    .filter((dv) => dv?.meta?.ownership?.ownerDid === identity.did)
    .slice(-5000);
  const envelope = await encryptRecovery(await recoveryPayload(identity, rootPrivateJwk, ownedDvs), passphrase, identity.did);
  identity = { ...identity, encryptedRecovery: envelope, recovery: "encrypted" };
  await persist(identity);
  return new Blob([JSON.stringify(envelope, null, 2)], { type: "application/vnd.utopy.wallet+json" });
}

export async function restoreEncryptedRecovery(
  envelope: RecoveryEnvelope,
  passphrase: string,
  deviceName: string
): Promise<WalletStatus> {
  const clear = await decryptRecovery(envelope, passphrase);
  const manifest = clear.manifest as WalletManifest;
  if (clear.ownerDid !== envelope.ownerDid || manifest.ownerDid !== envelope.ownerDid) throw new Error("Respaldo inconsistente.");
  if (!(await verifyRootHistory(manifest.ownerDid, manifest.rootHistory))) throw new Error("La cadena de claves maestras no es válida.");
  const latestRoot = manifest.rootHistory.at(-1)!;
  if (canonical(publicPart(clear.rootPrivateJwk)) !== canonical(publicPart(latestRoot.publicKeyJwk))) throw new Error("La clave del respaldo no coincide.");

  const rootPrivateKey = await importPrivate(clear.rootPrivateJwk, false);
  const device = await generatePair();
  const deviceId = randomId("device");
  const certificate = await makeCertificate(manifest.ownerDid, latestRoot.keyId, rootPrivateKey, deviceId, deviceName, device.publicJwk);
  const nextManifest: WalletManifest = {
    ...manifest,
    updatedAt: new Date().toISOString(),
    devices: [...manifest.devices.filter((item) => item.deviceId !== deviceId), certificate],
  };
  const nextEnvelope = await encryptRecovery(
    { ...clear, manifest: nextManifest, createdAt: new Date().toISOString() },
    passphrase,
    manifest.ownerDid
  );
  const identity: StoredOwnerIdentity = {
    did: manifest.ownerDid,
    keyId: certificate.keyId,
    deviceId,
    deviceName: certificate.deviceName,
    publicKeyJwk: device.publicJwk,
    createdAt: new Date().toISOString(),
    custody: typeof indexedDB === "undefined" ? "ephemeral" : "device",
    recovery: "encrypted",
    privateKey: device.privateKey,
    publicKey: device.publicKey,
    manifest: nextManifest,
    deviceCertificate: certificate,
    encryptedRecovery: nextEnvelope,
    bootstrapRootPrivateKey: null,
  };
  await persist(identity);
  if (typeof window !== "undefined" && Array.isArray(clear.dataDvs)) {
    const replication = await import("./replication");
    for (const dv of clear.dataDvs.slice(-5000)) await replication.replicateOwnedDV(dv);
  }
  return getWalletStatus();
}

export async function rotateDeviceKey(passphrase: string, deviceName?: string): Promise<any> {
  const identity = await getOrCreateOwnerIdentity();
  const { privateKey: rootPrivateKey, privateJwk } = await rootFromRecovery(identity, passphrase);
  const device = await generatePair();
  const nextDeviceId = randomId("device");
  const latestRoot = identity.manifest.rootHistory.at(-1)!;
  const certificate = await makeCertificate(
    identity.did,
    latestRoot.keyId,
    rootPrivateKey,
    nextDeviceId,
    deviceName || identity.deviceName,
    device.publicJwk
  );
  const unsignedRevocation = {
    protocol: "utopy.device.revocation/1" as const,
    ownerDid: identity.did,
    deviceId: identity.deviceId,
    rootKeyId: latestRoot.keyId,
    reason: "Rotación de clave del dispositivo",
    revokedAt: new Date().toISOString(),
  };
  const revocation: DeviceRevocation = { ...unsignedRevocation, signature: await signValue(rootPrivateKey, unsignedRevocation) };
  let next: StoredOwnerIdentity = {
    ...identity,
    deviceId: nextDeviceId,
    deviceName: certificate.deviceName,
    keyId: certificate.keyId,
    publicKeyJwk: device.publicJwk,
    privateKey: device.privateKey,
    publicKey: device.publicKey,
    deviceCertificate: certificate,
    manifest: {
      ...identity.manifest,
      updatedAt: new Date().toISOString(),
      devices: [...identity.manifest.devices.filter((item) => item.deviceId !== nextDeviceId), certificate],
      revocations: [...identity.manifest.revocations.filter((item) => item.deviceId !== identity.deviceId), revocation],
    },
  };
  next = {
    ...next,
    encryptedRecovery: await encryptRecovery(await recoveryPayload(next, privateJwk), passphrase, next.did),
  };
  await persist(next);
  return sealOwnedDV({
    id: randomId("wallet.device.rotated"),
    kind: "wallet.device.rotated",
    attrs: { previousDeviceId: identity.deviceId, device: certificate, revocation },
    traits: ["utopy:wallet", "utopy:key-rotation"],
    meta: { ns: "utopy:identity", ts: new Date().toISOString(), scopes: [identity.did] },
  });
}

export async function revokeDevice(deviceId: string, passphrase: string, reason = "Revocado por el propietario"): Promise<any> {
  const identity = await getOrCreateOwnerIdentity();
  if (deviceId === identity.deviceId) throw new Error("Para revocar este dispositivo usa Rotar clave.");
  const { privateKey: rootPrivateKey, privateJwk } = await rootFromRecovery(identity, passphrase);
  const latestRoot = identity.manifest.rootHistory.at(-1)!;
  const unsigned = {
    protocol: "utopy.device.revocation/1" as const,
    ownerDid: identity.did,
    deviceId,
    rootKeyId: latestRoot.keyId,
    reason,
    revokedAt: new Date().toISOString(),
  };
  const revocation: DeviceRevocation = { ...unsigned, signature: await signValue(rootPrivateKey, unsigned) };
  let next: StoredOwnerIdentity = {
    ...identity,
    manifest: {
      ...identity.manifest,
      updatedAt: new Date().toISOString(),
      revocations: [...identity.manifest.revocations.filter((item) => item.deviceId !== deviceId), revocation],
    },
  };
  next = { ...next, encryptedRecovery: await encryptRecovery(await recoveryPayload(next, privateJwk), passphrase, next.did) };
  await persist(next);
  return sealOwnedDV({
    id: randomId("wallet.device.revoked"),
    kind: "wallet.device.revoked",
    attrs: { revocation },
    traits: ["utopy:wallet", "utopy:device-revocation"],
    meta: { ns: "utopy:identity", ts: new Date().toISOString(), scopes: [identity.did] },
  });
}

export async function rotateRootKey(passphrase: string, nextPassphrase = passphrase): Promise<any> {
  const identity = await getOrCreateOwnerIdentity();
  const oldRoot = await rootFromRecovery(identity, passphrase);
  const previous = identity.manifest.rootHistory.at(-1)!;
  const nextRoot = await generatePair();
  const sequence = previous.sequence + 1;
  const base: RootKeyRecord = {
    sequence,
    keyId: `${identity.did}#root-${sequence}`,
    publicKeyJwk: nextRoot.publicJwk,
    activeFrom: new Date().toISOString(),
    previousKeyId: previous.keyId,
  };
  const payload = rootTransitionPayload(base);
  const record: RootKeyRecord = {
    ...base,
    transition: {
      previousSignature: await signValue(oldRoot.privateKey, payload),
      nextSignature: await signValue(nextRoot.privateKey, payload),
    },
  };
  const certificate = await makeCertificate(identity.did, record.keyId, nextRoot.privateKey, identity.deviceId, identity.deviceName, identity.publicKeyJwk);
  let next: StoredOwnerIdentity = {
    ...identity,
    deviceCertificate: certificate,
    keyId: certificate.keyId,
    manifest: {
      ...identity.manifest,
      updatedAt: new Date().toISOString(),
      rootHistory: [...identity.manifest.rootHistory, record],
      devices: [...identity.manifest.devices.filter((item) => item.deviceId !== identity.deviceId), certificate],
    },
  };
  next = { ...next, encryptedRecovery: await encryptRecovery(await recoveryPayload(next, nextRoot.privateJwk), nextPassphrase, next.did) };
  await persist(next);
  return sealOwnedDV({
    id: randomId("wallet.root.rotated"),
    kind: "wallet.root.rotated",
    attrs: { rootRecord: record, device: certificate },
    traits: ["utopy:wallet", "utopy:root-rotation"],
    meta: { ns: "utopy:identity", ts: new Date().toISOString(), scopes: [identity.did] },
  });
}

function withoutSignature(dv: any) {
  const ownership = dv?.meta?.ownership || {};
  const { signature: _signature, ...unsignedOwnership } = ownership;
  return { ...dv, meta: { ...(dv?.meta || {}), ownership: unsignedOwnership } };
}

// Session proofs are private, ephemeral and must never enter replication/Seed.
export async function requireActiveSessionIdentity() {
  const identity = memoryIdentity || await readStored().catch(() => null);
  if (!identity || identity.custody !== "device") throw new Error("Primero abrí tu Identidad Viva en Market.");
  if (identity.manifest.revocations.some((item) => item.deviceId === identity.deviceId)) throw new Error("Este dispositivo ya no puede firmar.");
  memoryIdentity = identity;
  return { ownerDid: identity.did, deviceId: identity.deviceId };
}
export async function signIdentitySessionProof(payload: Record<string, unknown>) {
  await requireActiveSessionIdentity();
  const identity = memoryIdentity!;
  const proof = { ...payload, ownerDid: identity.did, keyId: identity.keyId, publicKey: identity.publicKeyJwk, deviceCertificate: identity.deviceCertificate };
  return { ...proof, signature: await signValue(identity.privateKey, proof) };
}

export async function sealOwnedDV(dv: any, controllerActorId?: string | null): Promise<any> {
  if (!dv || typeof dv !== "object") throw new Error("DV inválido para firmar");
  const identity = await getOrCreateOwnerIdentity();
  const unsigned = withoutSignature({
    ...dv,
    meta: {
      ...(dv.meta || {}),
      ownership: {
        protocol: "utopy.owner/2",
        ownerDid: identity.did,
        controllerDid: identity.did,
        controllerActorId: controllerActorId || dv?.attrs?.actorId || null,
        keyId: identity.keyId,
        deviceId: identity.deviceId,
        deviceCertificate: identity.deviceCertificate,
        rootHistory: identity.manifest.rootHistory,
        revocations: identity.manifest.revocations,
        custody: identity.custody,
        recovery: identity.recovery,
        portable: true,
        exportableData: true,
        privateKeyExportable: false,
        signedAt: new Date().toISOString(),
        publicKeyJwk: identity.publicKeyJwk,
      },
    },
  });
  const signature = await signValue(identity.privateKey, unsigned);
  const signed = {
    ...unsigned,
    meta: { ...unsigned.meta, ownership: { ...unsigned.meta.ownership, signature: { alg: "ES256", value: signature } } },
  };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("utopy.owned.signed", { detail: { dv: signed } }));
    void import("./replication").then((module) => module.replicateOwnedDV(signed)).catch(() => undefined);
  }
  return signed;
}

async function verifyV2(dv: any): Promise<boolean> {
  const ownership = dv?.meta?.ownership;
  const certificate = ownership?.deviceCertificate as DeviceCertificate;
  const rootHistory = ownership?.rootHistory as RootKeyRecord[];
  if (!certificate || !Array.isArray(rootHistory) || !(await verifyRootHistory(ownership.ownerDid, rootHistory))) return false;
  const root = rootHistory.find((item) => item.keyId === certificate.rootKeyId);
  if (!root || !(await verifyValue(await importPublic(root.publicKeyJwk), certificatePayload(certificate), certificate.signature))) return false;
  if (certificate.ownerDid !== ownership.ownerDid || certificate.deviceId !== ownership.deviceId) return false;
  const trusted = await readOwnershipState(ownership.ownerDid);
  const localIdentity = memoryIdentity;
  const hasLocalIdentity = Boolean(localIdentity && localIdentity.did === ownership.ownerDid);
  const signedAt = Date.parse(ownership.signedAt || "") || Date.now();
  const localRoot = hasLocalIdentity ? localIdentity!.manifest.rootHistory.at(-1) : null;
  const localSequence = hasLocalIdentity
    ? localRoot?.sequence || 0
    : 0;
  const presentedSequence = rootHistory.at(-1)?.sequence || 0;
  const trustedSequence = trusted?.rootSequence || 0;
  const knownSequence = Math.max(trustedSequence, localSequence);
  const knownActiveFrom = localSequence >= trustedSequence
    ? Date.parse(localRoot?.activeFrom || "") || 0
    : Date.parse(trusted?.rootActiveFrom || "") || 0;
  if (presentedSequence < knownSequence && signedAt >= knownActiveFrom) return false;
  const knownRevocations = [
    ...((ownership.revocations || []) as DeviceRevocation[]),
    ...(trusted?.revocations || []),
    ...(hasLocalIdentity ? localIdentity!.manifest.revocations : []),
  ];
  for (const revocation of knownRevocations) {
    const revocationRoot = rootHistory.find((item) => item.keyId === revocation.rootKeyId);
    if (!revocationRoot) continue;
    const valid = await verifyValue(await importPublic(revocationRoot.publicKeyJwk), revocationPayload(revocation), revocation.signature);
    if (valid && revocation.deviceId === certificate.deviceId && Date.parse(revocation.revokedAt) <= signedAt) return false;
  }
  return verifyValue(await importPublic(certificate.publicKeyJwk), withoutSignature(dv), ownership?.signature?.value || "");
}

export async function observeOwnershipProof(dv: any): Promise<boolean> {
  if (!(await verifyOwnedDV(dv))) return false;
  const ownership = dv?.meta?.ownership;
  if (ownership?.protocol !== "utopy.owner/2") return true;
  const rootHistory = ownership.rootHistory as RootKeyRecord[];
  const validRevocations: DeviceRevocation[] = [];
  for (const revocation of (ownership.revocations || []) as DeviceRevocation[]) {
    const root = rootHistory.find((item) => item.keyId === revocation.rootKeyId);
    if (root && await verifyValue(await importPublic(root.publicKeyJwk), revocationPayload(revocation), revocation.signature)) {
      validRevocations.push(revocation);
    }
  }
  const latestRoot = rootHistory.at(-1);
  await rememberOwnershipState(ownership.ownerDid, latestRoot?.sequence || 1, validRevocations, latestRoot?.activeFrom);
  return true;
}

export async function verifyOwnedDV(dv: any): Promise<boolean> {
  try {
    if (dv?.meta?.ownership?.protocol === "utopy.owner/2") return verifyV2(dv);
    const ownership = dv?.meta?.ownership;
    if (!ownership?.publicKeyJwk || !ownership?.signature?.value) return false;
    return verifyValue(await importPublic(ownership.publicKeyJwk), withoutSignature(dv), ownership.signature.value);
  } catch { return false; }
}

export async function getWalletStatus(): Promise<WalletStatus> {
  const identity = await getOrCreateOwnerIdentity();
  const revokedIds = new Set(identity.manifest.revocations.map((item) => item.deviceId));
  return {
    ownerDid: identity.did,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    recoveryReady: Boolean(identity.encryptedRecovery),
    rootSequence: identity.manifest.rootHistory.at(-1)?.sequence || 1,
    activeDevices: identity.manifest.devices.filter((item) => !revokedIds.has(item.deviceId)),
    revokedDevices: identity.manifest.revocations,
    custody: identity.custody,
  };
}

export async function exportOwnedData(dvs: any[]): Promise<Blob> {
  const identity = await getOrCreateOwnerIdentity();
  const owned = (Array.isArray(dvs) ? dvs : []).filter((dv) => dv?.meta?.ownership?.ownerDid === identity.did);
  return new Blob([JSON.stringify({
    protocol: "utopy.owner.export/2",
    ownerDid: identity.did,
    deviceId: identity.deviceId,
    exportedAt: new Date().toISOString(),
    warning: "Contiene datos firmados; no contiene claves privadas.",
    manifest: identity.manifest,
    dvs: owned,
  }, null, 2)], { type: "application/json" });
}
