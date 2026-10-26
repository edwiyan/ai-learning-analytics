def test_list_users_as_admin(client, admin_token):
    resp = client.get("/users/", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_list_users_as_instructor_forbidden(client, instructor_token):
    resp = client.get("/users/", headers={"Authorization": f"Bearer {instructor_token}"})
    assert resp.status_code == 403


def test_create_user_as_admin(client, admin_token):
    payload = {
        "email": "newstudent@test.com",
        "password": "Student@1234",
        "full_name": "New Student",
        "role": "student",
        "student_number": "2023-99999",
    }
    resp = client.post("/users/", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "newstudent@test.com"
    assert data["role"] == "student"


def test_create_user_duplicate_email(client, admin_token, admin_user):
    payload = {
        "email": "admin@test.com",
        "password": "Admin@1234",
        "full_name": "Dup Admin",
        "role": "admin",
    }
    resp = client.post("/users/", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 400


def test_deactivate_user(client, admin_token, db):
    from backend.models.user import User, UserRole
    from backend.core.security import hash_password

    target = User(
        email="todeactivate@test.com",
        password_hash=hash_password("Pass@1234"),
        full_name="Target User",
        role=UserRole.instructor,
        is_active=True,
    )
    db.add(target)
    db.commit()
    db.refresh(target)

    resp = client.delete(f"/users/{target.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 204

    db.refresh(target)
    assert target.is_active is False


def test_create_user_unauthenticated(client):
    resp = client.post("/users/", json={"email": "x@x.com", "password": "p", "full_name": "X", "role": "student"})
    assert resp.status_code == 403
