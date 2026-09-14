def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200


def test_app_has_routes(client):
    paths = {route.path for route in client.app.routes if hasattr(route, "path")}
    assert "/health" in paths
