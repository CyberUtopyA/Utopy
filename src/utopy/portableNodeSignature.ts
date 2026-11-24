type PortableNodeTrust = {
  nodeId: string;
  aliases: string[];
  publicKey: string;
  keyId: string;
  manifestUrl: string;
};

const TRUST_CONFIG_URL = "/utopy-bootstrap-nodes.json";
let trustCache: Promise<PortableNodeTrust[]> | null = null;

function text(...values: unknown[]): string {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function base64Bytes(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function unsignedNodeDV(dv: any) {
  const ownership = dv?.meta?.ownership || {};
  const { signature: _signature, ...unsignedOwnership } = ownership;
  return {
    ...dv,
    meta: {
      ...(dv?.meta || {}),
      ownership: unsignedOwnership,
    },
  };
}

function unsignedManifest(manifest: any) {
  const { proof: _proof, ...unsigned } = manifest || {};
  return unsigned;
}

async function verifyEd25519(
  publicKey: string,
  signature: string,
  payload: unknown,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      base64Bytes(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      base64Bytes(signature),
      new TextEncoder().encode(JSON.stringify(payload)),
    );
  } catch {
    return false;
  }
}

function normalizeEntry(raw: any): PortableNodeTrust | null {
  const verification = raw?.verification || {};
  const nodeId = text(raw?.nodeId);
  const publicKey = text(verification.publicKey);
  const manifestUrl = text(raw?.manifestUrl);
  if (
    raw?.enabled === false ||
    !nodeId ||
    !publicKey ||
    !manifestUrl ||
    text(verification.type) !== "Ed25519Signature2020"
  ) {
    return null;
  }
  return {
    nodeId,
    aliases: Array.from(
      new Set([raw?.id, raw?.storeId, ...(raw?.aliases || [])].map(text).filter(Boolean)),
    ),
    publicKey,
    keyId: text(verification.keyId),
    manifestUrl,
  };
}

async function manifestConfirmsTrust(anchor: PortableNodeTrust): Promise<boolean> {
  try {
    const response = await fetch(anchor.manifestUrl, {
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return false;
    const manifest = await response.json();
    const proof = manifest?.proof || {};
    return (
      text(manifest?.nodeId) === anchor.nodeId &&
      text(manifest?.authority) === anchor.nodeId &&
      text(proof?.type) === "Ed25519Signature2020" &&
      text(proof?.publicKey) === anchor.publicKey &&
      (await verifyEd25519(
        anchor.publicKey,
        text(proof?.signature),
        unsignedManifest(manifest),
      ))
    );
  } catch {
    return false;
  }
}

async function loadPortableNodeTrust(): Promise<PortableNodeTrust[]> {
  if (trustCache) return trustCache;
  trustCache = (async () => {
    try {
      const response = await fetch(TRUST_CONFIG_URL, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return [];
      const payload = await response.json();
      const entries = (Array.isArray(payload) ? payload : payload?.sources) || [];
      const candidates = entries
        .map(normalizeEntry)
        .filter((entry: PortableNodeTrust | null): entry is PortableNodeTrust => Boolean(entry));
      const verified = await Promise.all(
        candidates.map(async (entry: PortableNodeTrust) =>
          (await manifestConfirmsTrust(entry)) ? entry : null,
        ),
      );
      return verified.filter(
        (entry: PortableNodeTrust | null): entry is PortableNodeTrust => Boolean(entry),
      );
    } catch {
      return [];
    }
  })();
  return trustCache;
}

export function resetPortableNodeTrustCacheForTests() {
  trustCache = null;
}

export async function verifyPortableNodeDV(
  dv: any,
  providedTrust?: PortableNodeTrust[],
): Promise<boolean> {
  const ownership = dv?.meta?.ownership || {};
  const signature = ownership?.signature || {};
  const authority = text(dv?.authority, dv?.meta?.authority, dv?.attrs?.authority);
  const sourceNodeId = text(
    dv?.sourceNodeId,
    dv?.attrs?.sourceNodeId,
    dv?.meta?.originNode,
  );
  const ownerNodeId = text(ownership?.ownerNodeId, ownership?.controllerNodeId);
  if (
    text(ownership?.protocol) !== "utopy.node.signature/1" ||
    !/^ed25519$/i.test(text(signature?.alg)) ||
    !authority ||
    authority !== sourceNodeId ||
    authority !== ownerNodeId
  ) {
    return false;
  }
  const anchors = providedTrust || (await loadPortableNodeTrust());
  const anchor = anchors.find((candidate) => candidate.nodeId === authority);
  if (!anchor) return false;
  if (anchor.keyId && text(ownership?.keyId) !== anchor.keyId) return false;
  if (text(ownership?.publicKey) && text(ownership?.publicKey) !== anchor.publicKey) {
    return false;
  }
  return verifyEd25519(
    anchor.publicKey,
    text(signature?.value),
    unsignedNodeDV(dv),
  );
}
