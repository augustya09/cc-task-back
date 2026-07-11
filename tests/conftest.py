"""
tests/conftest.py

Pytest fixtures that mirror your Postman test collection:
  - alice_client   → authenticated as alice@test.com  (OWNER in tests)
  - bob_client     → authenticated as bob@test.com    (MEMBER in tests)
  - carl_client    → authenticated as carl@test.com   (VIEWER in tests)

Each fixture returns a DRF APIClient with the correct JWT already set.

Usage in a test file:
    def test_owner_can_create_project(alice_client):
        response = alice_client.post('/api/v1/projects/', {...})
        assert response.status_code == 201
"""

import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

from tests.credentials import ALICE, BOB, CARL, TestUser

User = get_user_model()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_or_create(creds: TestUser) -> User:
    """Return the user if they exist, create them if not."""
    user, created = User.objects.get_or_create(
        email=creds.email,
        defaults={
            "username": creds.username,
        },
    )
    if created:
        user.set_password(creds.password)
        user.save()
    return user


def _authenticated_client(creds: TestUser) -> APIClient:
    """Return an APIClient with a valid JWT for the given credentials."""
    client = APIClient()
    response = client.post(
        "/api/v1/auth/login/",
        creds.login_payload(),
        format="json",
    )
    assert response.status_code == 200, (
        f"Login failed for {creds.email}: {response.data}"
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    return client


# ── User fixtures ─────────────────────────────────────────────────────────────

@pytest.fixture
def alice(db) -> User:
    """Alice — acts as OWNER in Postman team tests."""
    return _get_or_create(ALICE)


@pytest.fixture
def bob(db) -> User:
    """Bob — acts as MEMBER in Postman team tests."""
    return _get_or_create(BOB)


@pytest.fixture
def carl(db) -> User:
    """Carl — acts as VIEWER in Postman team tests."""
    return _get_or_create(CARL)


# ── Authenticated API client fixtures ─────────────────────────────────────────

@pytest.fixture
def alice_client(alice) -> APIClient:
    """APIClient pre-authenticated as Alice (OWNER)."""
    return _authenticated_client(ALICE)


@pytest.fixture
def bob_client(bob) -> APIClient:
    """APIClient pre-authenticated as Bob (MEMBER)."""
    return _authenticated_client(BOB)


@pytest.fixture
def carl_client(carl) -> APIClient:
    """APIClient pre-authenticated as Carl (VIEWER)."""
    return _authenticated_client(CARL)


# ── Shared team fixture ───────────────────────────────────────────────────────

@pytest.fixture
def alice_team(alice_client, bob, carl):
    """
    A team created by Alice, with Bob as MEMBER and Carl as VIEWER.
    Mirrors the Postman flow:
      Create Team - Alice → Invite Bob → Invite Carl → Join Team - Bob
    """
    from apps.teams.models import Team, Membership

    team_res = alice_client.post(
        "/api/v1/teams/",
        {"name": "Test Team", "description": "Auto-created by conftest"},
        format="json",
    )
    assert team_res.status_code == 201
    team = Team.objects.get(pk=team_res.data["id"])

    # Add Bob as MEMBER, Carl as VIEWER
    Membership.objects.get_or_create(team=team, user=bob,  defaults={"role": "MEMBER"})
    Membership.objects.get_or_create(team=team, user=carl, defaults={"role": "VIEWER"})

    return team
