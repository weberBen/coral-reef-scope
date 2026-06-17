#!/usr/bin/env python3
"""
Minimal HTTP server with WFS proxy.
Usage: python3 serve.py [port]

Serves public/ as static files, proxies /api/wfs to Allen Coral Atlas.
"""

import http.server
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
PUBLIC_DIR = Path(__file__).parent / "public"
DATA_DIR = Path(__file__).parent.parent / "data"
ALLEN_WFS = "https://allencoralatlas.org/geoserver/ows"

MIME = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
}


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Quieter logging
        pass

    def do_HEAD(self):
        self._head_only = True
        self.do_GET()
        self._head_only = False

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        pathname = parsed.path
        query = parsed.query

        # WFS proxy
        if pathname == "/api/wfs":
            self._proxy_wfs(query)
            return

        # Data files
        if pathname.startswith("/data/"):
            rel = pathname[6:]
            file_path = DATA_DIR / rel
            # Path traversal check
            try:
                file_path.resolve().relative_to(DATA_DIR.resolve())
            except ValueError:
                self.send_error(403)
                return
            self._serve_file(file_path)
            return

        # Static files
        if pathname == "/":
            pathname = "/index.html"
        file_path = PUBLIC_DIR / pathname.lstrip("/")
        try:
            file_path.resolve().relative_to(PUBLIC_DIR.resolve())
        except ValueError:
            self.send_error(403)
            return
        self._serve_file(file_path)

    _head_only = False

    def _serve_file(self, file_path: Path):
        if not file_path.is_file():
            self.send_error(404)
            return
        mime = MIME.get(file_path.suffix, "application/octet-stream")
        size = file_path.stat().st_size
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(size))
        self.end_headers()
        if not self._head_only:
            self.wfile.write(file_path.read_bytes())

    def _proxy_wfs(self, query_string):
        params = urllib.parse.parse_qs(query_string)
        # Remove cache busters
        params.pop("_", None)
        clean_qs = urllib.parse.urlencode(
            {k: v[0] if isinstance(v, list) else v for k, v in params.items()}
        )
        wfs_url = f"{ALLEN_WFS}?{clean_qs}"

        req = urllib.request.Request(
            wfs_url, headers={"User-Agent": "coral-reef-scope/1.0"}
        )
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                body = resp.read()
                content_type = resp.headers.get("Content-Type", "application/json")
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            body = json.dumps({"error": str(e)}).encode()
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)


if __name__ == "__main__":
    server = http.server.HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Coral Reef Scope → http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArret.")
