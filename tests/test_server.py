#!/usr/bin/env python3
"""
Unit tests for the Algorithm Visualizer Backend Server.
Standard library only: unittest, urllib.request, http.client, json, tempfile, threading.
"""

import http.client
import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

# Ensure server module can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import server


class TestServer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ["TESTING"] = "1"
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.db_path = os.path.join(cls.temp_dir.name, "test_runs.db")

        # Start real server on random available port (0)
        cls.httpd = server.VisualizerServer(("127.0.0.1", 0), server.VisualizerRequestHandler, db_path=cls.db_path)
        cls.port = cls.httpd.server_address[1]
        cls.base_url = f"http://127.0.0.1:{cls.port}"

        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()

    @classmethod
    def tearDownClass(cls):
        try:
            cls.httpd.shutdown()
            cls.httpd.server_close()
        finally:
            cls.temp_dir.cleanup()

    def do_request(self, method, path, data=None, headers=None, raw_body=None):
        url = f"{self.base_url}{path}"
        req_headers = headers.copy() if headers else {}

        if raw_body is not None:
            body_bytes = raw_body
        elif data is not None:
            body_bytes = json.dumps(data).encode("utf-8")
            if "Content-Type" not in req_headers:
                req_headers["Content-Type"] = "application/json"
        else:
            body_bytes = None

        req = urllib.request.Request(url, data=body_bytes, headers=req_headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                status = resp.status
                content = resp.read()
                content_type = resp.headers.get("Content-Type", "")
                return status, content, content_type
        except urllib.error.HTTPError as e:
            content = e.read()
            content_type = e.headers.get("Content-Type", "")
            e.close()
            return e.code, content, content_type

    def test_serve_page(self):
        status, content, content_type = self.do_request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn("text/html", content_type)
        html_text = content.decode("utf-8")
        self.assertIn("Algorithm Visualizer", html_text)

    def test_serve_static_files(self):
        # CSS
        status, content, content_type = self.do_request("GET", "/style.css")
        self.assertEqual(status, 200)
        self.assertIn("text/css", content_type)

        # JS
        status, content, content_type = self.do_request("GET", "/algorithms.js")
        self.assertEqual(status, 200)
        self.assertIn("javascript", content_type)

        status, content, content_type = self.do_request("GET", "/app.js")
        self.assertEqual(status, 200)
        self.assertIn("javascript", content_type)

        # Direct /static/ prefix
        status, content, _ = self.do_request("GET", "/static/index.html")
        self.assertEqual(status, 200)

    def test_save_and_list_runs(self):
        # Clear database
        self.do_request("DELETE", "/api/runs")

        # Save run
        run_data = {
            "algorithm": "bubble",
            "size": 30,
            "comparisons": 150,
            "writes": 80
        }
        status, content, content_type = self.do_request("POST", "/api/runs", data=run_data)
        self.assertEqual(status, 201)
        self.assertIn("application/json", content_type)

        saved = json.loads(content.decode("utf-8"))
        self.assertIn("id", saved)
        self.assertEqual(saved["algorithm"], "bubble")
        self.assertEqual(saved["size"], 30)
        self.assertEqual(saved["comparisons"], 150)
        self.assertEqual(saved["writes"], 80)
        self.assertIn("created_at", saved)

        # List runs
        status, content, content_type = self.do_request("GET", "/api/runs")
        self.assertEqual(status, 200)
        runs = json.loads(content.decode("utf-8"))
        self.assertEqual(len(runs), 1)
        self.assertEqual(runs[0]["id"], saved["id"])

    def test_newest_first_limit_10(self):
        # Clear database
        self.do_request("DELETE", "/api/runs")

        # Insert 15 runs
        for i in range(15):
            self.do_request("POST", "/api/runs", data={
                "algorithm": "quick",
                "size": 10 + i,
                "comparisons": 50 + i,
                "writes": 20 + i
            })

        # List runs
        status, content, _ = self.do_request("GET", "/api/runs")
        self.assertEqual(status, 200)
        runs = json.loads(content.decode("utf-8"))

        self.assertEqual(len(runs), 10, "GET /api/runs must return exactly 10 runs")
        # Check newest first (strictly descending ID)
        ids = [r["id"] for r in runs]
        self.assertEqual(ids, sorted(ids, reverse=True), "Runs must be ordered newest first (descending ID)")

    def test_reject_bad_inputs(self):
        # 1. Body over 1000 bytes
        big_body = json.dumps({"algorithm": "bubble", "size": 30, "comparisons": 0, "writes": 0, "padding": "x" * 1200}).encode("utf-8")
        status, content, _ = self.do_request("POST", "/api/runs", raw_body=big_body, headers={"Content-Type": "application/json"})
        self.assertEqual(status, 400)
        err = json.loads(content.decode("utf-8"))
        self.assertIn("error", err)

        # 2. Invalid JSON
        bad_json = b"{algorithm: 'bubble'"
        status, content, _ = self.do_request("POST", "/api/runs", raw_body=bad_json, headers={"Content-Type": "application/json"})
        self.assertEqual(status, 400)
        err = json.loads(content.decode("utf-8"))
        self.assertIn("error", err)

        # 3. Non-object bodies
        for bad_body in [b"[1, 2, 3]", b'"a string"', b"123", b"true", b"null"]:
            status, content, _ = self.do_request("POST", "/api/runs", raw_body=bad_body, headers={"Content-Type": "application/json"})
            self.assertEqual(status, 400, f"Expected 400 for body {bad_body}")
            err = json.loads(content.decode("utf-8"))
            self.assertIn("error", err)

        # 4. Missing fields
        for field in ("algorithm", "size", "comparisons", "writes"):
            d = {"algorithm": "bubble", "size": 30, "comparisons": 10, "writes": 5}
            del d[field]
            status, content, _ = self.do_request("POST", "/api/runs", data=d)
            self.assertEqual(status, 400, f"Expected 400 for missing field {field}")
            err = json.loads(content.decode("utf-8"))
            self.assertIn("error", err)

        # 5. Invalid algorithm
        for bad_algo in ["bogosort", "bubblesort", 123, True, "", None]:
            status, content, _ = self.do_request("POST", "/api/runs", data={
                "algorithm": bad_algo, "size": 30, "comparisons": 10, "writes": 5
            })
            self.assertEqual(status, 400, f"Expected 400 for bad algorithm {bad_algo}")
            err = json.loads(content.decode("utf-8"))
            self.assertIn("error", err)

        # 6. Invalid size (must be whole number 2 to 200, reject bool, string, float, out of range)
        for bad_size in [True, False, "30", 1, 201, 30.5, -5, None]:
            status, content, _ = self.do_request("POST", "/api/runs", data={
                "algorithm": "bubble", "size": bad_size, "comparisons": 10, "writes": 5
            })
            self.assertEqual(status, 400, f"Expected 400 for bad size {bad_size}")
            err = json.loads(content.decode("utf-8"))
            self.assertIn("error", err)

        # 7. Invalid comparisons (must be whole number 0 to 10,000,000, reject bool, string, float, out of range)
        for bad_comp in [True, False, "10", -1, 10_000_001, 5.5, None]:
            status, content, _ = self.do_request("POST", "/api/runs", data={
                "algorithm": "bubble", "size": 30, "comparisons": bad_comp, "writes": 5
            })
            self.assertEqual(status, 400, f"Expected 400 for bad comparisons {bad_comp}")
            err = json.loads(content.decode("utf-8"))
            self.assertIn("error", err)

        # 8. Invalid writes (must be whole number 0 to 10,000,000, reject bool, string, float, out of range)
        for bad_wr in [True, False, "10", -1, 10_000_001, 5.5, None]:
            status, content, _ = self.do_request("POST", "/api/runs", data={
                "algorithm": "bubble", "size": 30, "comparisons": 10, "writes": bad_wr
            })
            self.assertEqual(status, 400, f"Expected 400 for bad writes {bad_wr}")
            err = json.loads(content.decode("utf-8"))
            self.assertIn("error", err)

    def test_stats_averages(self):
        # Clear database
        self.do_request("DELETE", "/api/runs")

        # Insert known runs
        self.do_request("POST", "/api/runs", data={"algorithm": "bubble", "size": 10, "comparisons": 20, "writes": 10})
        self.do_request("POST", "/api/runs", data={"algorithm": "bubble", "size": 20, "comparisons": 40, "writes": 30})
        self.do_request("POST", "/api/runs", data={"algorithm": "quick", "size": 30, "comparisons": 50, "writes": 10})

        status, content, content_type = self.do_request("GET", "/api/stats")
        self.assertEqual(status, 200)
        self.assertIn("application/json", content_type)

        stats = json.loads(content.decode("utf-8"))
        stats_by_algo = {s["algorithm"]: s for s in stats}

        self.assertIn("bubble", stats_by_algo)
        bubble = stats_by_algo["bubble"]
        self.assertEqual(bubble["runs"], 2)
        self.assertEqual(bubble["avg_size"], 15.0)
        self.assertEqual(bubble["avg_comparisons"], 30.0)
        self.assertEqual(bubble["avg_writes"], 20.0)

        self.assertIn("quick", stats_by_algo)
        quick = stats_by_algo["quick"]
        self.assertEqual(quick["runs"], 1)
        self.assertEqual(quick["avg_size"], 30.0)
        self.assertEqual(quick["avg_comparisons"], 50.0)
        self.assertEqual(quick["avg_writes"], 10.0)

    def test_clearing_runs(self):
        # Seed 3 runs
        for _ in range(3):
            self.do_request("POST", "/api/runs", data={"algorithm": "insertion", "size": 10, "comparisons": 5, "writes": 5})

        status, content, _ = self.do_request("DELETE", "/api/runs")
        self.assertEqual(status, 200)
        res = json.loads(content.decode("utf-8"))
        self.assertEqual(res["deleted"], 3)

        # Listing should now be empty
        status, content, _ = self.do_request("GET", "/api/runs")
        self.assertEqual(status, 200)
        runs = json.loads(content.decode("utf-8"))
        self.assertEqual(runs, [])

        # Deleting again returns count 0
        status, content, _ = self.do_request("DELETE", "/api/runs")
        self.assertEqual(status, 200)
        res = json.loads(content.decode("utf-8"))
        self.assertEqual(res["deleted"], 0)

    def test_unknown_api_path_404(self):
        for path in ["/api/unknown", "/api/runs/123", "/api"]:
            for method in ["GET", "POST", "DELETE", "PUT"]:
                status, content, content_type = self.do_request(method, path)
                self.assertEqual(status, 404, f"Expected 404 for {method} {path}")
                self.assertIn("application/json", content_type)
                err = json.loads(content.decode("utf-8"))
                self.assertIn("error", err)

    def test_path_traversal_404(self):
        # Test path traversal attempts using low-level HTTP client to preserve exact raw path
        conn = http.client.HTTPConnection("127.0.0.1", self.port)
        traversal_paths = [
            "/../server.py",
            "/static/../../server.py",
            "/%2e%2e/server.py",
            "/static/%2e%2e/%2e%2e/server.py",
            "/..%2fserver.py",
            "/nonexistent_file.txt",
        ]
        for path in traversal_paths:
            conn.request("GET", path)
            resp = conn.getresponse()
            body = resp.read()
            self.assertEqual(resp.status, 404, f"Expected 404 for traversal path {path}, got {resp.status}")
        conn.close()


if __name__ == "__main__":
    unittest.main()
