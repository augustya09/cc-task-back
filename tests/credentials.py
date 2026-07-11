"""
tests/credentials.py

Single source of truth for all Postman test user credentials.
These match the users defined in your Postman collection exactly.
Import this anywhere in your test code instead of hardcoding values.

Usage:
    from tests.credentials import ALICE, BOB, CARL
    response = client.post('/api/v1/auth/login/', ALICE.login_payload())
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class TestUser:
    username: str
    email: str
    password: str
    # UUIDs match what is in the database (and in tests/fixtures/users.json)
    pk: str

    def login_payload(self) -> dict:
        """Payload for POST /api/v1/auth/login/"""
        return {"email": self.email, "password": self.password}

    def signup_payload(self) -> dict:
        """Payload for POST /api/v1/auth/signup/"""
        return {
            "username": self.username,
            "email": self.email,
            "password": self.password,
        }


# ── Test users — match your Postman collection exactly ──────────────────────

ALICE = TestUser(
    username="alice",
    email="alice@test.com",
    password="TestPass123!",
    pk="9f7cc75e-322a-4687-8c38-f6982ccdfd4a",
)

BOB = TestUser(
    username="bob",
    email="bob@test.com",
    password="TestPass123!",
    pk="e12c1d08-82bc-484f-a51f-d3d0de8ef495",
)

CARL = TestUser(
    username="carl",
    email="carl@test.com",
    password="TestPass123!",
    pk="4eaeaa63-6124-4407-b4cb-1a2776c6005c",
)

# Convenience list — all test users
ALL_USERS = [ALICE, BOB, CARL]
