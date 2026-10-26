"""
Live QA test runner — executes against http://localhost:8000
Run: python backend/tests/live_qa.py

Uses a persistent httpx.Client (keep-alive) so requests after the first reuse
the TCP connection — avoids 2.7s per-connection overhead on Windows loopback.
"""
import io
import sys
import httpx

BASE = "http://localhost:8000"
results = []

def ok(id_, msg):    results.append(f"[PASS]    {id_}: {msg}")
def fail(id_, msg):  results.append(f"[FAIL]    {id_}: {msg}")
def block(id_, msg): results.append(f"[BLOCKED] {id_}: {msg}")
def note(id_, msg):  results.append(f"[NOTE]    {id_}: {msg}")

with httpx.Client(timeout=10) as c:

    # ── 1. Smoke / Health ─────────────────────────────────────────────────────────
    try:
        r = c.get(f"{BASE}/health")
        if r.status_code == 200 and r.json().get("status") == "ok":
            ok("QA-SMK-001/API-006a", f"/health -> 200 {r.json()}")
        else:
            fail("QA-SMK-001", f"Unexpected: {r.status_code} {r.text}")
        h = r.json()
        if "db" in h and h["db"] == "connected":
            ok("QA-SMK-003/API-006b", f"/health db field: {h['db']}")
        elif "db" in h:
            fail("QA-SMK-003/API-006b", f"/health db field: {h['db']} (expected 'connected')")
        else:
            fail("QA-SMK-003/API-006b", "/health missing 'db' field — BUG-004")
        if "llm_api" in h:
            ok("QA-SMK-003/API-006c", f"/health llm_api field: {h['llm_api']}")
        else:
            fail("QA-SMK-003/API-006c", "/health missing 'llm_api' field — BUG-004")
    except Exception as e:
        fail("QA-SMK-001", str(e))

    # ── 2. Auth — Valid login (admin) ─────────────────────────────────────────────
    admin_token = None
    try:
        r = c.post(f"{BASE}/auth/login",
                   json={"email": "admin@ailas.edu", "password": "Admin@1234"})
        if r.status_code == 200 and "access_token" in r.json():
            admin_token = r.json()["access_token"]
            ok("QA-IT-001/API-001a", f"POST /auth/login valid -> 200 + JWT")
        else:
            fail("QA-IT-001", f"{r.status_code} {r.text[:100]}")
    except Exception as e:
        fail("QA-IT-001", str(e))

    # ── 3. Auth — Wrong password ──────────────────────────────────────────────────
    try:
        r = c.post(f"{BASE}/auth/login",
                   json={"email": "admin@ailas.edu", "password": "wrongpassword"})
        if r.status_code == 401:
            ok("QA-IT-002/API-001b", "Wrong password -> 401 Unauthorized")
        else:
            fail("QA-IT-002", f"Expected 401, got {r.status_code}")
    except Exception as e:
        fail("QA-IT-002", str(e))

    # ── 4. Auth — Missing body ────────────────────────────────────────────────────
    try:
        r = c.post(f"{BASE}/auth/login", json={})
        if r.status_code in (400, 422):
            ok("QA-API-001c", f"Empty body -> {r.status_code} validation error")
        else:
            fail("QA-API-001c", f"Expected 400/422, got {r.status_code}")
    except Exception as e:
        fail("QA-API-001c", str(e))

    # ── 5. Tampered JWT ───────────────────────────────────────────────────────────
    try:
        r = c.get(f"{BASE}/auth/me",
                  headers={"Authorization": "Bearer fake.token.here"})
        if r.status_code == 401:
            ok("QA-SEC-002/IAM-002", "Tampered JWT -> 401")
        else:
            fail("QA-SEC-002", f"Expected 401, got {r.status_code}")
    except Exception as e:
        fail("QA-SEC-002", str(e))

    # ── 6. Unauthenticated access to protected endpoint ───────────────────────────
    try:
        r = c.get(f"{BASE}/analytics/me/courses")
        if r.status_code in (401, 403):
            ok("QA-SEC-001", f"No JWT on /analytics/me/courses -> {r.status_code}")
        else:
            fail("QA-SEC-001", f"Expected 401/403, got {r.status_code}")
    except Exception as e:
        fail("QA-SEC-001", str(e))

    headers_admin = {"Authorization": f"Bearer {admin_token}"} if admin_token else {}

    # ── 7. Admin can list users ───────────────────────────────────────────────────
    if admin_token:
        try:
            r = c.get(f"{BASE}/users/", headers=headers_admin)
            if r.status_code == 200:
                ok("QA-IT-users", f"GET /users/ as admin -> 200 ({len(r.json())} users)")
            else:
                fail("QA-IT-users", f"{r.status_code} {r.text[:100]}")
        except Exception as e:
            fail("QA-IT-users", str(e))

    # ── 8. Instructor login + RBAC ────────────────────────────────────────────────
    instructor_token = None
    try:
        r = c.post(f"{BASE}/auth/login",
                   json={"email": "prof.ana.santos@btech.edu",
                         "password": "Demo@1234"})
        if r.status_code == 200:
            instructor_token = r.json()["access_token"]
            ok("QA-SEC-003-setup", "Instructor login OK")
        else:
            fail("QA-SEC-003-setup", f"{r.status_code} {r.text[:100]}")
    except Exception as e:
        fail("QA-SEC-003-setup", str(e))

    if instructor_token:
        try:
            r = c.get(f"{BASE}/analytics/me/courses",
                      headers={"Authorization": f"Bearer {instructor_token}"})
            if r.status_code == 403:
                ok("QA-SEC-003", "Instructor JWT on student-only /me/courses -> 403")
            else:
                fail("QA-SEC-003", f"Expected 403, got {r.status_code}: {r.text[:100]}")
        except Exception as e:
            fail("QA-SEC-003", str(e))

    # ── 9. Student login + consent gate ──────────────────────────────────────────
    student_token = None
    try:
        r = c.post(f"{BASE}/auth/login",
                   json={"email": "andrea.reyes@students.btech.edu",
                         "password": "Student@1234"})
        if r.status_code == 200:
            student_token = r.json()["access_token"]
            ok("QA-COMP-007-login", "Student login OK")
        else:
            fail("QA-COMP-007-login", f"{r.status_code} {r.text[:100]}")
    except Exception as e:
        fail("QA-COMP-007-login", str(e))

    if student_token:
        headers_student = {"Authorization": f"Bearer {student_token}"}
        try:
            r = c.get(f"{BASE}/consent/status", headers=headers_student)
            if r.status_code == 200:
                ok("QA-COMP-007a", f"GET /consent/status -> 200: {r.json()}")
                already_consented = r.json().get("accepted", False)
            else:
                fail("QA-COMP-007a", f"{r.status_code} {r.text}")
                already_consented = False
        except Exception as e:
            fail("QA-COMP-007a", str(e))
            already_consented = False

        try:
            r = c.get(f"{BASE}/analytics/me/courses", headers=headers_student)
            if r.status_code == 451:
                ok("QA-COMP-007b", "/analytics/me/courses without consent -> 451 gate WORKS")
            elif r.status_code == 200 and already_consented:
                ok("QA-COMP-007b", "/analytics/me/courses -> 200 (student already consented)")
            else:
                fail("QA-COMP-007b", f"Expected 451 or 200(consented), got {r.status_code}: {r.text[:120]}")
        except Exception as e:
            fail("QA-COMP-007b", str(e))

        if not already_consented:
            try:
                r = c.post(f"{BASE}/consent/accept", headers=headers_student)
                if r.status_code == 200:
                    ok("QA-COMP-007c", "POST /consent/accept -> 200: consent recorded")
                    r2 = c.get(f"{BASE}/analytics/me/courses", headers=headers_student)
                    if r2.status_code == 200:
                        ok("QA-COMP-007d", "After consent: /analytics/me/courses -> 200 (gate lifted)")
                    else:
                        fail("QA-COMP-007d", f"After consent still blocked: {r2.status_code}")
                else:
                    fail("QA-COMP-007c", f"POST /consent/accept {r.status_code}: {r.text}")
            except Exception as e:
                fail("QA-COMP-007c", str(e))

        try:
            dummy = io.BytesIO(b"%PDF-1.4 test")
            r = c.post(f"{BASE}/syllabi/upload", headers=headers_student,
                       files={"file": ("test.pdf", dummy, "application/pdf")},
                       data={"course_id": "00000000-0000-0000-0000-000000000000"})
            if r.status_code == 403:
                ok("QA-IT-004/API-002d", "Student JWT on /syllabi/upload -> 403")
            else:
                fail("QA-IT-004", f"Expected 403, got {r.status_code}: {r.text[:100]}")
        except Exception as e:
            fail("QA-IT-004", str(e))

    # ── 10. Non-PDF file upload rejected ─────────────────────────────────────────
    if admin_token:
        try:
            dummy = io.BytesIO(b"This is not a PDF")
            r = c.post(f"{BASE}/syllabi/upload", headers=headers_admin,
                       files={"file": ("evil.exe", dummy, "application/octet-stream")},
                       data={"course_id": "00000000-0000-0000-0000-000000000000"})
            if r.status_code in (400, 415, 422):
                ok("QA-API-002/SEC-006", f"Non-PDF upload -> {r.status_code} rejected")
            else:
                fail("QA-API-002", f"Expected 400/415, got {r.status_code}: {r.text[:120]}")
        except Exception as e:
            fail("QA-API-002", str(e))

    # ── 12. Security headers ──────────────────────────────────────────────────────
    try:
        r = c.get(f"{BASE}/health")
        h = r.headers
        for name, expected in [
            ("X-Frame-Options", "DENY"),
            ("X-Content-Type-Options", "nosniff"),
            ("X-XSS-Protection", "1; mode=block"),
            ("Referrer-Policy", "strict-origin-when-cross-origin"),
        ]:
            val = h.get(name)
            if val == expected:
                ok("QA-SEC-headers", f"{name}: {val}")
            else:
                fail("QA-SEC-headers", f"{name} = {val!r} (expected {expected!r})")
        if "strict-transport-security" not in [k.lower() for k in h.keys()]:
            fail("QA-SEC-009", "Strict-Transport-Security header MISSING (BUG-002)")
        else:
            ok("QA-SEC-009", f"HSTS present: {h.get('strict-transport-security', h.get('Strict-Transport-Security'))}")
    except Exception as e:
        fail("QA-SEC-headers", str(e))

    # ── 13. Content-Type ─────────────────────────────────────────────────────────
    try:
        r = c.get(f"{BASE}/health")
        ct = r.headers.get("content-type", "")
        if "application/json" in ct:
            ok("QA-API-009", f"Content-Type: {ct}")
        else:
            fail("QA-API-009", f"Content-Type: {ct}")
    except Exception as e:
        fail("QA-API-009", str(e))

    # ── 14. Logout invalidates token ─────────────────────────────────────────────
    if admin_token:
        try:
            r = c.post(f"{BASE}/auth/logout", headers=headers_admin)
            if r.status_code in (200, 204):
                r2 = c.get(f"{BASE}/auth/me", headers=headers_admin)
                if r2.status_code == 401:
                    ok("QA-IAM-004", f"Logout -> {r.status_code} -> JTI revoked -> 401 on reuse")
                else:
                    fail("QA-IAM-004", f"Token still valid after logout: /auth/me returned {r2.status_code}")
            else:
                fail("QA-IAM-004", f"Logout returned unexpected {r.status_code}")
            # Re-login for remaining tests
            r = c.post(f"{BASE}/auth/login",
                       json={"email": "admin@ailas.edu", "password": "Admin@1234"})
            if r.status_code == 200:
                admin_token = r.json()["access_token"]
                headers_admin = {"Authorization": f"Bearer {admin_token}"}
        except Exception as e:
            fail("QA-IAM-004", str(e))

    # ── 15. Audit log populated ───────────────────────────────────────────────────
    if admin_token:
        try:
            r = c.get(f"{BASE}/analytics/admin/audit-logs", headers=headers_admin)
            if r.status_code == 200 and len(r.json()) > 0:
                actions = [e.get("action") for e in r.json()[:5]]
                ok("QA-COMP-012", f"Audit log populated — sample actions: {actions}")
            elif r.status_code == 200:
                fail("QA-COMP-012", "Audit log endpoint OK but empty")
            else:
                fail("QA-COMP-012", f"{r.status_code}: {r.text[:100]}")
        except Exception as e:
            fail("QA-COMP-012", str(e))

    # ── 16. SQL injection attempt ────────────────────────────────────────────────
    try:
        r = c.post(f"{BASE}/auth/login",
                   json={"email": "admin@ailas.edu' OR '1'='1", "password": "x"})
        if r.status_code in (401, 422):
            ok("QA-SEC-004", f"SQL injection in email field -> {r.status_code} (ORM protected)")
        else:
            fail("QA-SEC-004", f"Unexpected {r.status_code}: {r.text[:100]}")
    except Exception as e:
        fail("QA-SEC-004", str(e))

    # ── 17. OpenAI key not exposed ───────────────────────────────────────────────
    if admin_token:
        try:
            r = c.get(f"{BASE}/auth/me", headers=headers_admin)
            body = r.text
            if "sk-" not in body and "openai" not in body.lower():
                ok("QA-SEC-008", "OpenAI API key not present in /auth/me response")
            else:
                fail("QA-SEC-008", "OpenAI key or reference found in response!")
        except Exception as e:
            fail("QA-SEC-008", str(e))

    # ── 18. Notifications endpoint ────────────────────────────────────────────────
    if instructor_token:
        try:
            r = c.get(f"{BASE}/notifications/",
                      headers={"Authorization": f"Bearer {instructor_token}"})
            if r.status_code == 200:
                ok("QA-IT-notifications", f"GET /notifications/ -> 200 ({len(r.json())} items)")
            else:
                fail("QA-IT-notifications", f"{r.status_code}: {r.text[:100]}")
        except Exception as e:
            fail("QA-IT-notifications", str(e))

    # ── 19. Programs/curricula endpoints ─────────────────────────────────────────
    if admin_token:
        try:
            r = c.get(f"{BASE}/programs/", headers=headers_admin)
            if r.status_code == 200:
                ok("QA-IT-programs", f"GET /programs/ -> 200 ({len(r.json())} programs)")
            else:
                fail("QA-IT-programs", f"{r.status_code}: {r.text[:100]}")
            r = c.get(f"{BASE}/curricula/", headers=headers_admin)
            if r.status_code == 200:
                ok("QA-IT-curricula", f"GET /curricula/ -> 200 ({len(r.json())} curricula)")
            else:
                fail("QA-IT-curricula", f"{r.status_code}: {r.text[:100]}")
        except Exception as e:
            fail("QA-IT-programs/curricula", str(e))

    # ── 20. Resources endpoint ────────────────────────────────────────────────────
    if admin_token:
        try:
            r = c.get(f"{BASE}/analytics/resources", headers=headers_admin)
            if r.status_code == 200:
                ok("QA-IT-010/AI-008", f"GET /analytics/resources -> 200 ({len(r.json())} resources)")
            else:
                fail("QA-IT-010", f"{r.status_code}: {r.text[:100]}")
        except Exception as e:
            fail("QA-IT-010", str(e))

# ── 20b. Rate limiting — run LAST so it doesn't exhaust the limit for other tests ──
# Uses a fresh dedicated Client so the burst is contained within its own session.
try:
    rate_hit = False
    rate_codes: set[int] = set()
    with httpx.Client(timeout=5) as rc:
        for i in range(35):
            r = rc.post(f"{BASE}/auth/login",
                        json={"email": "ratelimit_test@x.com", "password": "bad"})
            rate_codes.add(r.status_code)
            if r.status_code == 429:
                rate_hit = True
                ok("QA-API-008/IAM-006", f"Rate limit 429 triggered after {i+1} requests")
                break
    if not rate_hit:
        fail("QA-API-008", f"No 429 after 35 rapid requests (codes: {rate_codes})")
except Exception as e:
    fail("QA-API-008", str(e))

# ── Print results ─────────────────────────────────────────────────────────────
print()
print("=" * 72)
print("  AILAS LIVE QA RESULTS")
print("=" * 72)
for line in results:
    print(line)

pass_count  = sum(1 for r in results if r.startswith("[PASS]"))
fail_count  = sum(1 for r in results if r.startswith("[FAIL]"))
block_count = sum(1 for r in results if r.startswith("[BLOCKED]"))

print()
print("=" * 72)
print(f"  TOTAL: {pass_count} PASS  |  {fail_count} FAIL  |  {block_count} BLOCKED")
print("=" * 72)
sys.exit(1 if fail_count > 0 else 0)
