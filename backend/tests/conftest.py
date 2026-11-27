import os
import tempfile
from pathlib import Path

# Point the app at a throwaway SQLite DB before any app module is imported.
_tmp = Path(tempfile.mkdtemp()) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}"
os.environ["DATA_GOV_IN_API_KEY"] = ""

from datetime import date  # noqa: E402

import pytest  # noqa: E402

from app.db import engine, init_db, mandi_prices  # noqa: E402
from scripts.generate_demo_data import generate  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def demo_db():
    init_db()
    rows = generate(date(2024, 1, 1), date(2025, 12, 31))
    with engine.begin() as conn:
        conn.execute(mandi_prices.insert(), rows)
    yield
