def test_login_success(client, admin_user):
    resp = client.post("/auth/login", json={"email": "admin@test.com", "password": "Admin@1234"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client, admin_user):
    resp = client.post("/auth/login", json={"email": "admin@test.com", "password": "WrongPass"})
    assert resp.status_code == 401


def test_login_unknown_email(client):
    resp = client.post("/auth/login", json={"email": "nobody@test.com", "password": "pass"})
    assert resp.status_code == 401


def test_get_me_authenticated(client, admin_token):
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "admin@test.com"
    assert data["role"] == "admin"


def test_get_me_unauthenticated(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 403


def test_get_me_invalid_token(client):
    resp = client.get("/auth/me", headers={"Authorization": "Bearer totally.fake.token"})
    assert resp.status_code == 401
