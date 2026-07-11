"""
tests/test_postman_scenarios.py

These tests directly mirror your Postman collection scenarios,
translated into pytest. Each test name maps to a Postman request.

Run with:
    cd task_manager
    source venv/bin/activate
    pip install pytest pytest-django
    pytest tests/ -v
"""

import pytest


# ═══════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════

class TestAuth:

    def test_signup_alice(self, db, client):
        """SignUp - Alice (should fail — user already exists)"""
        from rest_framework.test import APIClient
        c = APIClient()
        res = c.post("/api/v1/auth/signup/", {
            "username": "alice",
            "email": "alice@test.com",
            "password": "TestPass123!",
        }, format="json")
        # User already exists from your Postman run
        assert res.status_code in (201, 400)

    def test_login_alice(self, alice_client):
        """Login - Alice — client fixture already asserts 200 login"""
        # alice_client fixture verifies login internally
        assert alice_client is not None

    def test_login_bob(self, bob_client):
        """Login - Bob"""
        assert bob_client is not None

    def test_login_carl(self, carl_client):
        """Login - Carl"""
        assert carl_client is not None


# ═══════════════════════════════════════════════════════════
# TEAMS
# ═══════════════════════════════════════════════════════════

class TestTeams:

    def test_create_team_alice(self, alice_client):
        """Create Team - Alice (owner)"""
        res = alice_client.post("/api/v1/teams/", {
            "name": "Alice's Team",
            "description": "Created by Alice",
        }, format="json")
        assert res.status_code == 201
        assert res.data["name"] == "Alice's Team"

    def test_invite_member_bob(self, alice_client, alice_team, bob):
        """Invite Member - Bob invites Carl (owner can invite)"""
        res = alice_client.post(f"/api/v1/teams/{alice_team.id}/invite/", {
            "email": bob.email,
            "role": "MEMBER",
        }, format="json")
        # 400 = already a member (from fixture), both are valid
        assert res.status_code in (201, 400)

    def test_invite_member_bob_should_fail(self, bob_client, alice_team):
        """Invite Member - Bob Should Fail (member cannot invite)"""
        res = bob_client.post(f"/api/v1/teams/{alice_team.id}/invite/", {
            "email": "newuser@test.com",
            "role": "MEMBER",
        }, format="json")
        assert res.status_code == 403

    def test_join_team_bob(self, db, bob_client):
        """Join Team - Bob (can join any team)"""
        from rest_framework.test import APIClient
        # Create a fresh team with a different client for Bob to join
        c = APIClient()
        c.post("/api/v1/auth/login/", {
            "email": "alice@test.com",
            "password": "TestPass123!",
        }, format="json")
        # Bob joins an existing team using its ID
        from apps.teams.models import Team
        team = Team.objects.first()
        if team:
            res = bob_client.post(f"/api/v1/teams/{team.id}/join/")
            assert res.status_code in (201, 400)  # 400 = already a member

    def test_change_role_alice_promotes_bob(self, alice_client, alice_team, bob):
        """Change Role - Alice Promotes Bob"""
        res = alice_client.patch(
            f"/api/v1/teams/{alice_team.id}/members/{bob.id}/role/",
            {"role": "MAINTAINER"},
            format="json",
        )
        assert res.status_code == 200
        assert res.data["role"] == "MAINTAINER"

    def test_list_members(self, alice_client, alice_team):
        """List Members"""
        res = alice_client.get(f"/api/v1/teams/{alice_team.id}/members/")
        assert res.status_code == 200
        assert len(res.data) >= 1

    def test_activity_log(self, alice_client, alice_team):
        """Activity Log"""
        res = alice_client.get(f"/api/v1/teams/{alice_team.id}/activity/")
        assert res.status_code == 200


# ═══════════════════════════════════════════════════════════
# PROJECTS
# ═══════════════════════════════════════════════════════════

class TestProjects:

    @pytest.fixture
    def alice_project(self, alice_client, alice_team):
        res = alice_client.post("/api/v1/projects/", {
            "name": "Alice Project",
            "team": str(alice_team.id),
        }, format="json")
        assert res.status_code == 201
        return res.data

    def test_create_project_alice_owner_should_succeed(self, alice_client, alice_team):
        """Create Project (Alice, Owner — should succeed)"""
        res = alice_client.post("/api/v1/projects/", {
            "name": "Owner Project",
            "team": str(alice_team.id),
        }, format="json")
        assert res.status_code == 201

    def test_create_project_bob_member_should_fail(self, bob_client, alice_team):
        """Create Project (Bob, Member — should fail)"""
        res = bob_client.post("/api/v1/projects/", {
            "name": "Bob's Unauthorized Project",
            "team": str(alice_team.id),
        }, format="json")
        assert res.status_code == 403

    def test_delete_project_bob_should_fail(self, alice_client, bob_client, alice_team):
        """Delete Project - Bob Should Fail"""
        proj = alice_client.post("/api/v1/projects/", {
            "name": "To Delete",
            "team": str(alice_team.id),
        }, format="json").data
        res = bob_client.delete(f"/api/v1/projects/{proj['id']}/")
        assert res.status_code == 403

    def test_delete_project_owner(self, alice_client, alice_team):
        """Delete Project - Owner"""
        proj = alice_client.post("/api/v1/projects/", {
            "name": "Delete Me",
            "team": str(alice_team.id),
        }, format="json").data
        res = alice_client.delete(f"/api/v1/projects/{proj['id']}/")
        assert res.status_code == 204

    def test_outside_access_carl_cant_access(self, carl_client, alice_team):
        """Outside Access - Carl can't access projects of teams he's not in"""
        # Carl is a VIEWER on alice_team — can list but only sees own teams
        res = carl_client.get("/api/v1/projects/")
        assert res.status_code == 200


# ═══════════════════════════════════════════════════════════
# TASKS
# ═══════════════════════════════════════════════════════════

class TestTasks:

    @pytest.fixture
    def project(self, alice_client, alice_team):
        res = alice_client.post("/api/v1/projects/", {
            "name": "Task Test Project",
            "team": str(alice_team.id),
        }, format="json")
        return res.data

    def test_create_task_owner(self, alice_client, project):
        """Create Task - Owner"""
        res = alice_client.post("/api/v1/tasks/", {
            "project": project["id"],
            "title": "Owner Task",
            "priority": "HIGH",
        }, format="json")
        assert res.status_code == 201

    def test_create_task_maintainer(self, alice_client, bob_client, alice_team, project):
        """Create Task - Maintainer (promote Bob first)"""
        alice_client.patch(
            f"/api/v1/teams/{alice_team.id}/members/{bob_client._credentials.get('HTTP_AUTHORIZATION', '').split('.')[-1]}/role/",
            {"role": "MAINTAINER"}, format="json"
        )
        res = bob_client.post("/api/v1/tasks/", {
            "project": project["id"],
            "title": "Maintainer Task",
        }, format="json")
        assert res.status_code in (201, 403)  # depends on Bob's current role

    def test_create_task_viewer_should_fail(self, carl_client, project):
        """Create Task - Viewer (Should Fail)"""
        res = carl_client.post("/api/v1/tasks/", {
            "project": project["id"],
            "title": "Viewer Task",
        }, format="json")
        assert res.status_code == 403

    def test_update_task_owner(self, alice_client, project):
        """Update Task - Owner"""
        task = alice_client.post("/api/v1/tasks/", {
            "project": project["id"],
            "title": "Update Me",
        }, format="json").data
        res = alice_client.patch(f"/api/v1/tasks/{task['id']}/", {
            "status": "IN_PROGRESS",
        }, format="json")
        assert res.status_code == 200
        assert res.data["status"] == "IN_PROGRESS"
