import { publishAuthorizedDV } from "../utopy/authorizedPublish";
import { resolveCurrentIdentityContext } from "../utopy/identityContext";
import { mtLiveSnapshot } from "./mt.liveStore";

export type ContractState = "draft" | "ready_to_sign" | "signed_by_landlord" | "signed_by_tenant" | "active" | "ended" | "cancelled";
export type PrivateContract = {
  contractId: string; opaqueRef: string; version: number; state: ContractState;
  ownerId: string; propertyId: string; roomId: string;
  landlordActorId: string; tenantActorId: string; authorizedAdminActorIds: string[];
  document: any; integrityHash: string; createdAt: string; updatedAt: string; frozenAt?: string;
};

const DB = "utopy.private.contracts.v1";
const CONTRACTS = "contracts";
const TOKENS = "capabilities";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CONTRACTS)) db.createObjectStore(CONTRACTS, { keyPath: "contractId" });
      if (!db.objectStoreNames.contains(TOKENS)) db.createObjectStore(TOKENS, { keyPath: "token" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest) {
  const db = await openDb();
  return new Promise<any>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

const randomRef = (bytes = 24) => {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(raw, (item) => item.toString(16).padStart(2, "0")).join("");
};
const canonicalValue = (value: any): any => Array.isArray(value)
  ? value.map(canonicalValue)
  : value && typeof value === "object"
    ? Object.keys(value).sort().reduce((output: any, key) => { output[key] = canonicalValue(value[key]); return output; }, {})
    : value;
const canonical = (value: any): string => JSON.stringify(canonicalValue(value));
export async function contractIntegrity(document: any) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(document)));
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, "0")).join("");
}
export function contractAllows(record: PrivateContract, actorId: string) {
  return actorId === record.landlordActorId || actorId === record.tenantActorId || record.authorizedAdminActorIds.includes(actorId);
}

async function audit(kind: string, record: PrivateContract, actorId: string) {
  const allLive = mtLiveSnapshot();
  await publishAuthorizedDV({ dv: { id: `${kind}:${record.contractId}:${Date.now()}:${randomRef(5)}`, kind, attrs: { contractId: record.contractId, version: record.version, propertyId: record.propertyId, roomId: record.roomId, actorId, participants: [record.landlordActorId, record.tenantActorId, ...record.authorizedAdminActorIds], occurredAt: new Date().toISOString() }, traits: ["rental:contract:event"], meta: { ns: "skylines:private", scopes: ["participants"] } }, allLive, action: kind, sensitivity: "sensitive" });
}

export async function createPrivateContract(input: Omit<PrivateContract, "contractId" | "opaqueRef" | "version" | "integrityHash" | "createdAt" | "updatedAt"> & { contractId?: string }) {
  const allLive = mtLiveSnapshot();
  const identity = await resolveCurrentIdentityContext({ allLive });
  const contractId = input.contractId || `contract:${crypto.randomUUID()}`;
  const existing = await transact(CONTRACTS, "readonly", (store) => store.get(contractId)) as PrivateContract | undefined;
  if (existing) {
    if (!contractAllows(existing, identity.actorId)) throw new Error("No tenés acceso a este contrato.");
    if (existing.frozenAt) return existing;
    const updated: PrivateContract = { ...existing, ...input, contractId, opaqueRef: existing.opaqueRef, version: existing.version + 1, integrityHash: await contractIntegrity(input.document), createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
    await transact(CONTRACTS, "readwrite", (store) => store.put(updated));
    await audit("contract.updated", updated, identity.actorId);
    return updated;
  }
  const now = new Date().toISOString();
  const record: PrivateContract = { ...input, contractId, opaqueRef: randomRef(), version: 1, integrityHash: await contractIntegrity(input.document), createdAt: now, updatedAt: now };
  if (!contractAllows(record, identity.actorId)) throw new Error("La identidad actual no participa de este contrato.");
  await transact(CONTRACTS, "readwrite", (store) => store.put(record));
  await audit("contract.created", record, identity.actorId);
  return record;
}

export async function freezePrivateContract(contractId: string, state: ContractState = "active") {
  const allLive = mtLiveSnapshot();
  const identity = await resolveCurrentIdentityContext({ allLive });
  const record = await transact(CONTRACTS, "readonly", (store) => store.get(contractId)) as PrivateContract;
  if (!record || !contractAllows(record, identity.actorId)) throw new Error("No tenés acceso a este contrato.");
  if (record.frozenAt) return record;
  const next = { ...record, state, frozenAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await transact(CONTRACTS, "readwrite", (store) => store.put(next));
  await audit("contract.signed", next, identity.actorId);
  await audit("contract.activated", next, identity.actorId);
  return next;
}

export async function readPrivateContractById(contractId: string) {
  const identity = await resolveCurrentIdentityContext({ allLive: mtLiveSnapshot() });
  const record = await transact(CONTRACTS, "readonly", (store) => store.get(contractId)) as PrivateContract;
  if (!record || !contractAllows(record, identity.actorId)) throw new Error("No tenés autorización para abrir este contrato.");
  if (await contractIntegrity(record.document) !== record.integrityHash) throw new Error("La integridad del contrato no es válida.");
  await audit("contract.viewed", record, identity.actorId);
  return record;
}

export async function listMyPrivateContracts() {
  const identity = await resolveCurrentIdentityContext({ allLive: mtLiveSnapshot() });
  const records = await transact(CONTRACTS, "readonly", (store) => store.getAll()) as PrivateContract[];
  return records.filter((record) => contractAllows(record, identity.actorId));
}

export async function createTemporaryContractCapability(contractId: string, ttlMinutes = 20) {
  const record = await readPrivateContractById(contractId);
  const token = randomRef(32);
  await transact(TOKENS, "readwrite", (store) => store.put({ token, contractId, scope: "contract:read", expiresAt: Date.now() + ttlMinutes * 60_000, revoked: false }));
  return { token, url: `${window.location.origin}/contratos/acceso/${token}`, expiresAt: Date.now() + ttlMinutes * 60_000, opaqueRef: record.opaqueRef };
}

export async function readPrivateContractByCapability(token: string) {
  const capability = await transact(TOKENS, "readonly", (store) => store.get(token));
  if (!capability || capability.revoked || capability.scope !== "contract:read" || capability.expiresAt <= Date.now()) throw new Error("Este acceso temporal venció o fue revocado.");
  const record = await transact(CONTRACTS, "readonly", (store) => store.get(capability.contractId)) as PrivateContract;
  if (!record || await contractIntegrity(record.document) !== record.integrityHash) throw new Error("El contrato no está disponible o perdió integridad.");
  return record;
}

export async function revokeTemporaryContractCapability(token: string) {
  const capability = await transact(TOKENS, "readonly", (store) => store.get(token));
  if (!capability) return false;
  await readPrivateContractById(capability.contractId);
  await transact(TOKENS, "readwrite", (store) => store.put({ ...capability, revoked: true, revokedAt: Date.now() }));
  return true;
}
