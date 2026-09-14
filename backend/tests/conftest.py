import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """
    Plain TestClient instantiation (no `with` block), so FastAPI's
    startup lifespan (DB pool init, migrations) never runs. Keeps
    tests independent of a live database.
    """
    return TestClient(app)
