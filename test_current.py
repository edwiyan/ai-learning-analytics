import sys, urllib.request, json
sys.path.insert(0, ".")
from collections import defaultdict

def call(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request("http://localhost:8000" + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

body  = call("POST", "/auth/login", {"email": "admin@ailas.edu", "password": "Admin@1234"})
token = body["access_token"]
enrollments = call("GET", "/enrollments/", token=token)

groups = defaultdict(list)
for e in enrollments:
    groups[e["student_id_hash"]].append(e)

multi = {h: es for h, es in groups.items() if len(es) > 1}
print(f"Total enrollments  : {len(enrollments)}")
print(f"Unique students    : {len(groups)}")
print(f"Multi-curriculum   : {len(multi)}")
print()

# Simulate the useMemo
latest = {}
for e in enrollments:
    if not e.get("enrollment_date"):
        print(f"  SKIP (null date): id={e['id'][:8]}")
        continue
    prev = latest.get(e["student_id_hash"])
    if not prev or e["enrollment_date"] > prev["enrollment_date"]:
        latest[e["student_id_hash"]] = e

current_ids = {e["id"] for e in latest.values()}
print(f"currentEnrollmentIds size: {len(current_ids)}")
print(f"Sample IDs in set: {list(current_ids)[:3]}")
print()

# Check if any row's id is in the set
matches = [e for e in enrollments if e["id"] in current_ids]
print(f"Enrollments that would show badge: {len(matches)}")
