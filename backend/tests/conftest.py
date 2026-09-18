"""Test environment defaults loaded before application imports."""

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://localhost/forhire_test")
os.environ.setdefault("SESSION_SECRET", "test-only-session-secret-at-least-32-characters")