# Backend Tests

Pytest suite. `conftest.py` provides a `client` fixture (`TestClient`, instantiated
without a `with` block so the FastAPI startup lifespan — DB pool init, migrations —
never runs; tests don't need a live database).

Run:
    pip install -r requirements.txt
    pytest
