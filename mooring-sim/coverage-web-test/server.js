/**
 * Node.js HTTP server (fallback if Bun is not installed).
 * Same features: static files, WFS proxy, data/ serving.
 *
 * Usage: node server.js
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");
const url = require("url");

const PORT = 3000;
const PUBLIC_DIR = path.resolve(__dirname, "public");
const DATA_DIR = path.resolve(__dirname, "..", "data");
const ALLEN_WFS = "https://allencoralatlas.org/geoserver/ows";

const MIME = {
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

function serveFile(filePath, res) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime });
    fs.createReadStream(filePath).pipe(res);
  });
}

function proxyWfs(query, res) {
  const params = new URLSearchParams(query);
  params.delete("_");
  const wfsUrl = `${ALLEN_WFS}?${params.toString()}`;

  https.get(wfsUrl, { headers: { "User-Agent": "coral-reef-scope/1.0" } }, (proxyRes) => {
    const chunks = [];
    proxyRes.on("data", (chunk) => chunks.push(chunk));
    proxyRes.on("end", () => {
      const body = Buffer.concat(chunks);
      res.writeHead(proxyRes.statusCode || 200, {
        "Content-Type": proxyRes.headers["content-type"] || "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(body);
    });
  }).on("error", (err) => {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // WFS proxy
  if (pathname === "/api/wfs") {
    const qs = parsed.search ? parsed.search.slice(1) : "";
    proxyWfs(qs, res);
    return;
  }

  // Data files
  if (pathname.startsWith("/data/")) {
    const filePath = path.join(DATA_DIR, pathname.slice(6));
    // Prevent path traversal
    if (!filePath.startsWith(DATA_DIR)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    serveFile(filePath, res);
    return;
  }

  // Static files
  const filePath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  serveFile(filePath, res);
});

server.listen(PORT, () => {
  console.log(`Coral Reef Scope → http://localhost:${PORT}`);
});
