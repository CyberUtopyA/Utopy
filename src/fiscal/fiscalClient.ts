import { getOrCreateOwnerIdentity } from "../utopy/ownership";
import { canonicalCommercial, commercialDocumentHash, type CommercialDocument } from "../commercial/commercialDocument";
import { mtLiveSnapshot } from "../mt/mt.liveStore";
import { publishAuthorizedDV } from "../utopy/authorizedPublish";

export function fiscalClientConfigured() {
  return Boolean(import.meta.env.VITE_SIFEN_SIDECAR_URL && import.meta.env.VITE_SIFEN_ADAPTER_PUBLIC_JWK);
}
function decode(value: string) {
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}
/** Direct, private, authenticated adapter request. No catalog, Seed or replication of fiscal payloads. */
export async function fiscalRequest(action: string, issuerNodeId: string, document?: CommercialDocument) {
  if (!fiscalClientConfigured()) throw new Error("Facturación electrónica no configurada.");
  const url = new URL(import.meta.env.VITE_SIFEN_SIDECAR_URL);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("La conexión fiscal debe ser segura.");
  const identity = await getOrCreateOwnerIdentity();
  const payload = {
    protocol: "utopy.fiscal.request/1", scope: "private:fiscal", action, issuerNodeId,
    nonce: crypto.randomUUID(), timestamp: Date.now(),
    ...(document ? { commercialDocumentId: document.documentId, revision: document.revision,
      documentHash: await commercialDocumentHash(document), ...(action === "document.save" ? { document } : {}) } : {}),
  };
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, identity.privateKey,
    new TextEncoder().encode(canonicalCommercial(payload)));
  const encoded = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const response = await fetch(new URL("/v1/request", url), { method: "POST", cache: "no-store", credentials: "omit",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payload, keyId: identity.keyId, signature: encoded }),
    signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!result.signature) throw new Error("No se pudo verificar la conexión fiscal o tu autorización.");
  const { signature: proof, ...attestation } = result;
  const publicKey = await crypto.subtle.importKey("jwk", JSON.parse(import.meta.env.VITE_SIFEN_ADAPTER_PUBLIC_JWK),
    { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  if (attestation.requestNonce !== payload.nonce || Math.abs(Date.now() - attestation.issuedAt) > 120000
    || !(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, decode(proof),
      new TextEncoder().encode(canonicalCommercial(attestation))))) throw new Error("La respuesta fiscal no es verificable.");
  if (!response.ok) {
    const fields = result.payload?.missingFields;
    throw new Error(fields?.length ? `Falta completar: ${fields.join(", ")}` : "El servicio fiscal todavía no está disponible para esta acción.");
  }
  if (document && (result.payload.commercialDocumentId !== document.documentId || result.payload.revision !== document.revision
    || result.payload.documentHash !== payload.documentHash || result.payload.issuerNodeId !== issuerNodeId)) throw new Error("La respuesta corresponde a otro documento.");
  if (document && ["document.status", "document.submit"].includes(action)
    && ["ACCEPTED", "REJECTED"].includes(result.payload.state) && result.payload.responseRef) {
    const id = `fiscal:attestation:${encodeURIComponent(issuerNodeId)}:${encodeURIComponent(document.documentId)}:${document.revision}:${result.payload.state.toLowerCase()}`;
    const allLive = mtLiveSnapshot();
    if (!allLive.some((dv: any) => dv.id === id && dv.attrs?.documentHash === payload.documentHash)) {
      try {
        // The actor archives the adapter's signed observation privately; it does not impersonate DNIT or the adapter.
        await publishAuthorizedDV({ allLive, localOnly: true, sensitivity: "sensitive",
          action: "fiscal.attestation.archive", dv: { id, kind: `fiscal.document.${result.payload.state.toLowerCase()}`,
            attrs: { ...result.payload, adapterAttestation: result, visibility: "private", nonTradable: true },
            traits: ["private", "fiscal:attestation"], meta: { ns: "mt:market", scopes: ["private:fiscal"] } } });
      } catch {
        return { ...result.payload, archiveWarning: "El resultado está guardado en el servicio fiscal; no se pudo actualizar la proyección privada local." };
      }
    }
  }
  return result.payload;
}
