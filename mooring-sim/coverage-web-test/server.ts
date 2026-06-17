/**
 * Bun HTTP server:
 *  - Serves static files from public/
 *  - Proxies /api/wfs to Allen Coral Atlas WFS (CORS workaround)
 *  - Serves existing .glb files from ../data/
 */

import { resolve, join, extname } from "path";

const PORT = 3000;
const PUBLIC_DIR = resolve(import.meta.dir, "public");
const DATA_DIR = resolve(import.meta.dir, "..", "data");
const ALLEN_WFS = "https://allencoralatlas.org/geoserver/ows";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);

    // --- WFS proxy ---
    if (url.pathname === "/api/wfs") {
      const params = new URLSearchParams(url.search);
      params.delete("_"); // strip cache-busters
      const wfsUrl = `${ALLEN_WFS}?${params.toString()}`;
      try {
        const resp = await fetch(wfsUrl, {
          headers: { "User-Agent": "coral-reef-scope/1.0" },
        });
        const body = await resp.arrayBuffer();
        return new Response(body, {
          status: resp.status,
          headers: {
            "Content-Type": resp.headers.get("Content-Type") || "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // --- Serve data/*.glb ---
    if (url.pathname.startsWith("/data/")) {
      const filePath = join(DATA_DIR, url.pathname.slice(6));
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const ext = extname(filePath);
        return new Response(file, {
          headers: { "Content-Type": MIME[ext] || "application/octet-stream" },
        });
      }
      return new Response("Not found", { status: 404 });
    }

    // --- Static files ---
    let filePath = join(PUBLIC_DIR, url.pathname === "/" ? "index.html" : url.pathname);
    let file = Bun.file(filePath);
    if (await file.exists()) {
      const ext = extname(filePath);
      return new Response(file, {
        headers: { "Content-Type": MIME[ext] || "application/octet-stream" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Coral Reef Scope → http://localhost:${PORT}`);
