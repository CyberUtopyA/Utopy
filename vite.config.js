import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { readFile } from "node:fs/promises";
import { frontendPrivacyGuard } from "./frontendPrivacyGuard.js";

function liveNodeDevProxy() {
  return {
    name: "utopy-live-node-dev-proxy",
    configureServer(server) {
      server.middlewares.use("/api/node-live.php", async (request, response) => {
        try {
          const requestUrl = new URL(request.url || "", "http://localhost");
          const node = requestUrl.searchParams.get("node") || "";
          const resource = requestUrl.searchParams.get("resource") || "";
          if (!node || !["manifest", "catalog", "profile"].includes(resource)) {
            response.statusCode = 400;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify({ ok: false, error: "invalid_request" }));
            return;
          }

          const registry = JSON.parse(
            await readFile(new URL("./public/utopy-bootstrap-nodes.json", import.meta.url), "utf8"),
          );
          const source = (registry.sources || []).find(
            (entry) => entry.enabled !== false && String(entry.id) === node,
          );
          const key = `remote${resource[0].toUpperCase()}${resource.slice(1)}Url`;
          const remoteUrl = source?.[key];
          if (!remoteUrl || !String(remoteUrl).startsWith("https://")) {
            response.statusCode = 404;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify({ ok: false, error: "node_not_registered" }));
            return;
          }

          const upstream = await fetch(remoteUrl, {
            headers: { Accept: "application/json" },
            redirect: "error",
            signal: AbortSignal.timeout(12_000),
          });
          const body = await upstream.text();
          JSON.parse(body);
          response.statusCode = upstream.status;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.end(body);
        } catch {
          response.statusCode = 502;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ ok: false, error: "upstream_unavailable" }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    frontendPrivacyGuard(),
    liveNodeDevProxy(),
    react(),
    tailwindcss(),

    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      registerType: "autoUpdate",

      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
      ],

      manifest: {
        name: "UTOPY MT · Territorios y Comunidades Vivas",
        short_name: "UTOPY MT",
        description: "Personas, comunidades y capacidades conectadas. MS Market como motor comercial.",
        start_url: "/mt",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#000000",
        background_color: "#000000",

        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globIgnores: ["**/lua-node.json"],

        globPatterns: [
          "**/*.{js,css,html,ico,png,jpg,jpeg,svg,webp,mp3,json,gif}",
        ],
      },
    }),
  ],
});
