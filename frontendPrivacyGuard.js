import { readdirSync } from "node:fs";
import { join } from "node:path";

// Public assets bypass Vite fs.deny; guard dev/preview and fail before copying state.
export function frontendPrivacyGuard() {
  const block = (server, preview = false) => {
    server.middlewares.use((request, response, next) => {
      let pathname;
      try { pathname = decodeURIComponent((request.url || "/").split("?")[0]).replace(/\\/g, "/"); }
      catch { response.statusCode = 400; response.end(); return; }
      if (/(?:^|\/)(?:\.env(?:\.[^/]*)?|\.git|\.utopy-private|\.npmrc|\.yarnrc\.yml)(?:\/|$)/i.test(pathname)
        || /\.(?:pem|key|p12|pfx|crt|cer|der)(?:$|\/)/i.test(pathname)
        || /\/api\/(?:data(?:\/|$)|_)/i.test(pathname)
        || (preview && /\.php$/i.test(pathname))
        || (/\.php$/i.test(pathname) && pathname !== "/api/node-live.php")) {
        response.statusCode = 404; response.setHeader("Cache-Control", "no-store"); response.end(); return;
      }
      next();
    });
  };
  return {
    name: "utopy-frontend-privacy-guard",
    configureServer: server => block(server),
    configurePreviewServer: server => block(server, true),
    configResolved(config) {
      for (const [name, value] of Object.entries(config.env)) {
        if (value && /(?:SECRET|PASSWORD|PRIVATE_KEY|SERVICE_ROLE|ACCESS_TOKEN|AUTH_TOKEN|SYNC_TOKEN|CONSUMER_TOKEN)/i.test(name)) {
          throw new Error("Server credential cannot be exposed to the frontend: " + name);
        }
      }
      const walk = (directory) => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const path = join(directory, entry.name);
          if (entry.isSymbolicLink() || /^(?:\.env(?:\..*)?|\.git|\.utopy-private|\.npmrc|\.yarnrc\.yml)$/i.test(entry.name) || /\.(?:pem|key|p12|pfx|crt|cer|der)$/i.test(entry.name)
            || /[\\/]api[\\/]data[\\/].+\.json$/i.test(path)) {
            throw new Error("Private file in public assets: " + entry.name);
          }
          if (entry.isDirectory()) walk(path);
        }
      };
      if (config.publicDir) walk(config.publicDir);
    },
  };
}
