"""Re-key stored student hashes after changing STUDENT_ID_SALT.

Usage (stop the backend first, then update STUDENT_ID_SALT in .env):
    python -m backend.scripts.rehash_student_ids --old-salt "<previous salt>"
The new salt is read from settings (.env).
"""
import argparse

from backend.core.config import settings
from backend.core.database import engine
from backend.core.rehash import rehash_student_ids


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--old-salt", required=True, help="Salt the stored hashes were created with ('' for unsalted)")
    args = parser.parse_args()
    with engine.begin() as conn:
        counts = rehash_student_ids(conn, args.old_salt, settings.student_id_salt)
    print(counts)


if __name__ == "__main__":
    main()
