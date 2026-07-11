"""
Management command: seed_test_users

Reads a Postman environment JSON file and creates the test users
defined in it so that your Postman collection runs work immediately
against your local Django database.

Usage:
    python manage.py seed_test_users
    python manage.py seed_test_users --env tests/postman/environment.json
    python manage.py seed_test_users --env tests/postman/environment.json --reset
"""

import json
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()

# Default location of the Postman environment file
DEFAULT_ENV_PATH = Path("tests/postman/environment.json")


def _get_value(variables: list[dict], key: str) -> str | None:
    """Extract a variable value from a Postman environment variables list."""
    for v in variables:
        if v.get("key") == key and v.get("enabled", True):
            return v.get("value") or None
    return None


class Command(BaseCommand):
    help = "Seed test users from a Postman environment file."

    def add_arguments(self, parser):
        parser.add_argument(
            "--env",
            type=str,
            default=str(DEFAULT_ENV_PATH),
            help="Path to the Postman environment JSON file.",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete and re-create the user if they already exist.",
        )

    def handle(self, *args, **options):
        env_path = Path(options["env"])

        if not env_path.exists():
            raise CommandError(
                f"Environment file not found: {env_path}\n"
                f"Export your Postman environment and save it at that path,\n"
                f"or copy tests/postman/environment.example.json as a starting point."
            )

        try:
            data = json.loads(env_path.read_text())
        except json.JSONDecodeError as exc:
            raise CommandError(f"Invalid JSON in environment file: {exc}")

        variables = data.get("values", [])

        # --- Primary test user ---
        email    = _get_value(variables, "test_email")
        password = _get_value(variables, "test_password")

        if not email or not password:
            raise CommandError(
                "The environment file must have 'test_email' and 'test_password' variables."
            )

        self._upsert_user(email, password, options["reset"])

        # --- Extra users: test_email_2, test_email_3, … ---
        for suffix in range(2, 10):
            extra_email    = _get_value(variables, f"test_email_{suffix}")
            extra_password = _get_value(variables, f"test_password_{suffix}") or password
            if extra_email:
                self._upsert_user(extra_email, extra_password, options["reset"])

        self.stdout.write(self.style.SUCCESS("✓ Test users seeded successfully."))

    def _upsert_user(self, email: str, password: str, reset: bool):
        username = email.split("@")[0]
        existing = User.objects.filter(email=email).first()

        if existing:
            if reset:
                existing.delete()
                self.stdout.write(f"  ↺ Deleted existing user: {email}")
            else:
                self.stdout.write(f"  · User already exists (skipped): {email}")
                return

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
        )
        self.stdout.write(self.style.SUCCESS(f"  ✓ Created user: {user.email}"))
