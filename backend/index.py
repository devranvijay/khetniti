"""Vercel entrypoint. Importing via the `app` package keeps app/main.py's relative imports working."""

from app.main import app  # noqa: F401
