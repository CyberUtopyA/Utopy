/* UTOPY Node Heartbeat v2
 * Instalar en cualquier nodo público. No contiene claves bancarias.
 * Lee el manifiesto del propio nodo y lo anuncia en Seed como dv.upsert.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  var config = Object.assign(
    {
      manifestUrl: "/api/catalog-live.php",
      seedWs: "wss://seed.mterra.space/utopy?ns=mt",
      heartbeatMs: 30000,
      reconnectMs: 8000,
      auth: "utopy-resonancia",
    },
    window.UTOPY_NODE_HEARTBEAT || {},
    script
      ? {
          manifestUrl: script.dataset.manifestUrl || undefined,
          seedWs: script.dataset.seedWs || undefined,
          heartbeatMs: Number(script.dataset.heartbeatMs || 0) || undefined,
        }
      : {},
  );

  config.heartbeatMs = Math.max(15000, Number(config.heartbeatMs || 30000));
  config.reconnectMs = Math.max(2000, Number(config.reconnectMs || 8000));

  var stopped = false;
  var ws = null;
  var reconnectTimer = null;
  var cachedManifest = null;
  var cacheKey = "utopy.node.manifest.cache.v2:" + location.origin;
  var leaderKey = "utopy.node.heartbeat.leader.v2:" + location.origin;
  var owner = Math.random().toString(36).slice(2) + Date.now().toString(36);

  function nowIso() {
    return new Date().toISOString();
  }

  function loadCache() {
    try {
      var parsed = JSON.parse(localStorage.getItem(cacheKey) || "null");
      return parsed && parsed.kind === "utopy.node.manifest" ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function saveCache(manifest) {
    cachedManifest = manifest;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(manifest));
    } catch (_) {}
  }

  function claimLeader() {
    var now = Date.now();
    var current = {};
    try {
      current = JSON.parse(localStorage.getItem(leaderKey) || "{}") || {};
    } catch (_) {}
    if (current.owner && current.owner !== owner && Number(current.expiresAt) > now) {
      return false;
    }
    try {
      localStorage.setItem(
        leaderKey,
        JSON.stringify({ owner: owner, expiresAt: now + config.heartbeatMs * 2.5 }),
      );
      current = JSON.parse(localStorage.getItem(leaderKey) || "{}") || {};
      return current.owner === owner;
    } catch (_) {
      return true;
    }
  }

  function refreshManifest(manifest) {
    if (!manifest) return null;
    var now = Date.now();
    var heartbeat = Math.max(
      15000,
      Number(manifest.attrs && manifest.attrs.discovery && manifest.attrs.discovery.heartbeatMs) ||
        config.heartbeatMs,
    );
    var ttl = Math.max(heartbeat * 2, Number(manifest.meta && manifest.meta.ttl_ms) || heartbeat * 3);
    manifest = JSON.parse(JSON.stringify(manifest));
    manifest.meta = Object.assign({}, manifest.meta, {
      ns: (manifest.meta && manifest.meta.ns) || "utopy:nodes",
      ts: nowIso(),
      updatedAt: nowIso(),
      version: now,
      ttl_ms: ttl,
      scopes:
        manifest.meta && Array.isArray(manifest.meta.scopes)
          ? manifest.meta.scopes
          : ["public"],
      schema: "utopy.node.manifest@2",
    });
    manifest.attrs = Object.assign({}, manifest.attrs, {
      discovery: Object.assign({}, manifest.attrs && manifest.attrs.discovery, {
        protocol: "utopy.node.manifest@2",
        mode: "self-announced",
        heartbeatMs: heartbeat,
        expiresAt: new Date(now + ttl).toISOString(),
      }),
    });
    manifest.traits = Array.from(
      new Set(
        ([
          "sem.dv.read",
          "utopy:node:manifest",
          "utopy:node:self-announced",
          "mt:catalog.source",
          "resonance:capable",
        ]).concat(Array.isArray(manifest.traits) ? manifest.traits : []),
      ),
    );
    return manifest;
  }

  function extractManifest(payload) {
    if (payload && payload.kind === "utopy.node.manifest") return payload;
    var list = payload && Array.isArray(payload.nodeManifests) ? payload.nodeManifests : [];
    return list.find(function (item) {
      return item && item.kind === "utopy.node.manifest";
    }) || null;
  }

  async function readManifest() {
    try {
      var response = await fetch(config.manifestUrl, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      var payload = await response.json();
      var manifest = extractManifest(payload);
      if (!manifest) throw new Error("Sin utopy.node.manifest");
      manifest = refreshManifest(manifest);
      saveCache(manifest);
      return manifest;
    } catch (error) {
      var fallback = cachedManifest || loadCache();
      if (fallback) return refreshManifest(fallback);
      console.warn("[UTOPY Nodo] No se pudo leer el manifiesto:", error);
      return null;
    }
  }

  function envelope(manifest) {
    var nodeId =
      (manifest.attrs && manifest.attrs.node && manifest.attrs.node.id) ||
      (manifest.attrs && manifest.attrs.nodeId) ||
      (manifest.meta && manifest.meta.originNode) ||
      "utopy:node";
    return {
      kind: "dv.upsert",
      dv: manifest,
      meta: {
        nodeId: nodeId,
        ts: nowIso(),
        ns: (manifest.meta && manifest.meta.ns) || "utopy:nodes",
        source: nodeId,
        scopes: (manifest.meta && manifest.meta.scopes) || ["public"],
      },
      auth: config.auth,
      id: nodeId,
      ns: "mt",
    };
  }

  async function announce() {
    if (stopped || !claimLeader()) return;
    var manifest = await readManifest();
    if (!manifest) return;

    try {
      window.dispatchEvent(new CustomEvent("utopy.emit", { detail: envelope(manifest) }));
      window.dispatchEvent(new CustomEvent("utopy.node.manifest", { detail: manifest }));
    } catch (_) {}

    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(envelope(manifest)));
      } catch (_) {}
    }
  }

  function connect() {
    if (stopped || ws) return;
    try {
      ws = new WebSocket(config.seedWs);
      ws.onopen = announce;
      ws.onerror = function () {
        try { ws.close(); } catch (_) {}
      };
      ws.onclose = function () {
        ws = null;
        if (stopped || reconnectTimer) return;
        reconnectTimer = setTimeout(function () {
          reconnectTimer = null;
          connect();
        }, config.reconnectMs);
      };
    } catch (_) {
      ws = null;
    }
  }

  cachedManifest = loadCache();
  connect();
  announce();
  var timer = setInterval(announce, config.heartbeatMs);
  window.addEventListener("online", function () { connect(); announce(); });
  window.addEventListener("focus", announce);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") announce();
  });

  window.UTOPY_NODE_HEARTBEAT_STOP = function () {
    stopped = true;
    clearInterval(timer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    try { ws && ws.close(); } catch (_) {}
    try {
      var current = JSON.parse(localStorage.getItem(leaderKey) || "{}") || {};
      if (current.owner === owner) localStorage.removeItem(leaderKey);
    } catch (_) {}
  };
})();
