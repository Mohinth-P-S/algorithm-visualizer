#!/usr/bin/env python3
"""
Algorithm Visualizer - Backend Server
Standard library only: http.server, sqlite3, json.
"""

import http.server
import json
import mimetypes
import os
import sqlite3
import sys
import urllib.parse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "runs.db")

MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
}

VALID_ALGORITHMS = {"bubble", "selection", "insertion", "merge", "quick", "linear", "binary"}


def get_db_connection(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path):
    conn = get_db_connection(db_path)
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                algorithm TEXT NOT NULL,
                size INTEGER NOT NULL,
                comparisons INTEGER NOT NULL,
                writes INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
    conn.close()


class VisualizerRequestHandler(http.server.BaseHTTPRequestHandler):
    server_version = "AlgorithmVisualizer/1.0"

    def log_message(self, format, *args):
        # Override to suppress standard console noise in tests
        if "TESTING" not in os.environ:
            super().log_message(format, *args)

    def send_json(self, status_code, data):
        response_bytes = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

    def serve_static(self, parsed_path):
        clean_path = parsed_path.lstrip("/")
        if clean_path == "" or clean_path == "index.html":
            clean_path = "index.html"
        elif clean_path.startswith("static/"):
            clean_path = clean_path[len("static/"):]

        # Normalize and ensure no directory traversal
        target_path = os.path.normpath(os.path.join(STATIC_DIR, clean_path))
        try:
            common = os.path.commonpath([STATIC_DIR, target_path])
            if common != STATIC_DIR:
                self.send_json(404, {"error": "Not found"})
                return
        except Exception:
            self.send_json(404, {"error": "Not found"})
            return

        if not os.path.isfile(target_path):
            self.send_json(404, {"error": "Not found"})
            return

        ext = os.path.splitext(target_path)[1].lower()
        content_type = MIME_TYPES.get(ext, mimetypes.guess_type(target_path)[0] or "application/octet-stream")

        try:
            with open(target_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(content)
        except Exception:
            self.send_json(500, {"error": "Internal server error"})

    def do_HEAD(self):
        parsed = urllib.parse.urlparse(self.path)
        path = urllib.parse.unquote(parsed.path)
        if path.startswith("/api/") or path == "/api":
            self.send_json(404, {"error": "Not found"})
        else:
            self.serve_static(path)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = urllib.parse.unquote(parsed.path)

        if path == "/api/runs":
            self.handle_get_runs()
        elif path == "/api/stats":
            self.handle_get_stats()
        elif path.startswith("/api/") or path == "/api":
            self.send_json(404, {"error": "Not found"})
        else:
            self.serve_static(path)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = urllib.parse.unquote(parsed.path)

        if path == "/api/runs":
            self.handle_post_run()
        elif path.startswith("/api/") or path == "/api":
            self.send_json(404, {"error": "Not found"})
        else:
            self.send_json(404, {"error": "Not found"})

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = urllib.parse.unquote(parsed.path)

        if path == "/api/runs":
            self.handle_delete_runs()
        elif path.startswith("/api/") or path == "/api":
            self.send_json(404, {"error": "Not found"})
        else:
            self.send_json(404, {"error": "Not found"})

    def do_PUT(self):
        self.send_json(404, {"error": "Not found"})

    def do_PATCH(self):
        self.send_json(404, {"error": "Not found"})

    def handle_get_runs(self):
        try:
            conn = get_db_connection(self.server.db_path)
            cursor = conn.cursor()
            rows = cursor.execute("""
                SELECT id, algorithm, size, comparisons, writes, created_at
                FROM runs
                ORDER BY id DESC
                LIMIT 10
            """).fetchall()
            conn.close()

            runs = [
                {
                    "id": r["id"],
                    "algorithm": r["algorithm"],
                    "size": r["size"],
                    "comparisons": r["comparisons"],
                    "writes": r["writes"],
                    "created_at": r["created_at"],
                }
                for r in rows
            ]
            self.send_json(200, runs)
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def handle_post_run(self):
        content_length_str = self.headers.get("Content-Length")
        if content_length_str is None:
            self.send_json(400, {"error": "Missing Content-Length"})
            return

        try:
            content_length = int(content_length_str)
        except ValueError:
            self.send_json(400, {"error": "Invalid Content-Length"})
            return

        if content_length > 1000:
            self.send_json(400, {"error": "Request body exceeds 1000 bytes"})
            return

        body_bytes = self.rfile.read(content_length)
        if len(body_bytes) > 1000:
            self.send_json(400, {"error": "Request body exceeds 1000 bytes"})
            return

        try:
            data = json.loads(body_bytes.decode("utf-8"))
        except Exception:
            self.send_json(400, {"error": "Invalid JSON format"})
            return

        if not isinstance(data, dict):
            self.send_json(400, {"error": "Request body must be a JSON object"})
            return

        for req_field in ("algorithm", "size", "comparisons", "writes"):
            if req_field not in data:
                self.send_json(400, {"error": f"Missing required field: {req_field}"})
                return

        algorithm = data["algorithm"]
        size = data["size"]
        comparisons = data["comparisons"]
        writes = data["writes"]

        if not isinstance(algorithm, str) or algorithm not in VALID_ALGORITHMS:
            self.send_json(400, {"error": f"Invalid algorithm. Must be one of: {', '.join(sorted(VALID_ALGORITHMS))}"})
            return

        if isinstance(size, bool) or not isinstance(size, int) or size < 2 or size > 200:
            self.send_json(400, {"error": "size must be an integer between 2 and 200"})
            return

        if isinstance(comparisons, bool) or not isinstance(comparisons, int) or comparisons < 0 or comparisons > 10_000_000:
            self.send_json(400, {"error": "comparisons must be an integer between 0 and 10,000,000"})
            return

        if isinstance(writes, bool) or not isinstance(writes, int) or writes < 0 or writes > 10_000_000:
            self.send_json(400, {"error": "writes must be an integer between 0 and 10,000,000"})
            return

        try:
            conn = get_db_connection(self.server.db_path)
            with conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO runs (algorithm, size, comparisons, writes) VALUES (?, ?, ?, ?)",
                    (algorithm, size, comparisons, writes)
                )
                new_id = cursor.lastrowid
                row = cursor.execute(
                    "SELECT id, algorithm, size, comparisons, writes, created_at FROM runs WHERE id = ?",
                    (new_id,)
                ).fetchone()
            conn.close()

            saved = {
                "id": row["id"],
                "algorithm": row["algorithm"],
                "size": row["size"],
                "comparisons": row["comparisons"],
                "writes": row["writes"],
                "created_at": row["created_at"],
            }
            self.send_json(201, saved)
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def handle_get_stats(self):
        try:
            conn = get_db_connection(self.server.db_path)
            cursor = conn.cursor()
            rows = cursor.execute("""
                SELECT algorithm,
                       COUNT(*) as runs,
                       AVG(size) as avg_size,
                       AVG(comparisons) as avg_comparisons,
                       AVG(writes) as avg_writes
                FROM runs
                GROUP BY algorithm
                ORDER BY algorithm
            """).fetchall()
            conn.close()

            stats = [
                {
                    "algorithm": r["algorithm"],
                    "runs": r["runs"],
                    "avg_size": round(float(r["avg_size"]), 1) if r["avg_size"] is not None else 0.0,
                    "avg_comparisons": round(float(r["avg_comparisons"]), 1) if r["avg_comparisons"] is not None else 0.0,
                    "avg_writes": round(float(r["avg_writes"]), 1) if r["avg_writes"] is not None else 0.0,
                }
                for r in rows
            ]
            self.send_json(200, stats)
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def handle_delete_runs(self):
        try:
            conn = get_db_connection(self.server.db_path)
            with conn:
                cursor = conn.cursor()
                count = cursor.execute("SELECT COUNT(*) FROM runs").fetchone()[0]
                cursor.execute("DELETE FROM runs")
            conn.close()
            self.send_json(200, {"deleted": count})
        except Exception as e:
            self.send_json(500, {"error": str(e)})


class VisualizerServer(http.server.ThreadingHTTPServer):
    def __init__(self, server_address, RequestHandlerClass, db_path=None):
        self.db_path = db_path or os.environ.get("DB_PATH", DEFAULT_DB_PATH)
        init_db(self.db_path)
        super().__init__(server_address, RequestHandlerClass)


def get_port():
    if len(sys.argv) > 1:
        try:
            return int(sys.argv[1])
        except ValueError:
            pass
    if "PORT" in os.environ:
        try:
            return int(os.environ["PORT"])
        except ValueError:
            pass
    return 8001


def run():
    port = get_port()
    host = "127.0.0.1"
    server = VisualizerServer((host, port), VisualizerRequestHandler)
    print(f"Algorithm Visualizer server running on http://{host}:{port}/ (database: {server.db_path})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    run()
