import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.db import normalize_database_url
from app.main import app


@pytest.mark.parametrize(
    "url, expected",
    [
        ("postgresql://u:p@db.supabase.co:5432/postgres", "postgresql+psycopg://u:p@db.supabase.co:5432/postgres"),
        ("postgres://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
        ("postgresql+psycopg://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
        ("sqlite:///khetniti.db", "sqlite:///khetniti.db"),
    ],
)
def test_supabase_urls_use_the_installed_psycopg_driver(url, expected):
    assert normalize_database_url(url) == expected


def test_cron_refresh_is_closed_when_no_secret_is_configured(monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", None)
    assert TestClient(app).get("/api/cron/refresh-prices").status_code == 503


def test_cron_refresh_rejects_a_wrong_secret(monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", "s3cret")
    r = TestClient(app).get("/api/cron/refresh-prices", headers={"Authorization": "Bearer nope"})
    assert r.status_code == 401


def test_cron_refresh_runs_every_crop_with_the_right_secret(monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", "s3cret")
    r = TestClient(app).get("/api/cron/refresh-prices", headers={"Authorization": "Bearer s3cret"})
    assert r.status_code == 200
    assert set(r.json()) == {"tomato", "onion", "potato"}  # no API key in tests, so each reports not_configured
