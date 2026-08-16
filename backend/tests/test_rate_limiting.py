import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.rate_limiting import RateLimitMiddleware


class RateLimitingTests(unittest.TestCase):
    @staticmethod
    def _client() -> TestClient:
        app = FastAPI()
        app.add_middleware(RateLimitMiddleware)

        @app.get("/api/users")
        def users():
            return {"ok": True}

        @app.post("/api/auth/login")
        def login():
            return {"ok": True}

        @app.get("/api/health")
        def health():
            return {"status": "ok"}

        return TestClient(app)

    def test_sensitive_endpoint_returns_429_and_retry_headers(self):
        with self._client() as client:
            for _ in range(5):
                self.assertEqual(client.post("/api/auth/login").status_code, 200)
            response = client.post("/api/auth/login")

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers["x-ratelimit-limit"], "5")
        self.assertGreaterEqual(int(response.headers["retry-after"]), 1)

    def test_service_buckets_are_independent(self):
        with self._client() as client:
            for _ in range(5):
                client.post("/api/auth/login")
            response = client.get("/api/users")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["x-ratelimit-limit"], "120")

    def test_health_check_is_exempt(self):
        with self._client() as client:
            for _ in range(130):
                response = client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("x-ratelimit-limit", response.headers)


if __name__ == "__main__":
    unittest.main()
