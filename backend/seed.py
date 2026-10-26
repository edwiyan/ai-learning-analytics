"""
Run once to seed initial data.
Usage: python -m backend.seed
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from backend.core.database import SessionLocal
from backend.core.security import hash_password
from backend.models.user import User, UserRole
from backend.models.resource import Resource, ResourceType


SAMPLE_RESOURCES = [
    {"title": "Introduction to Algorithms - MIT OpenCourseWare", "type": ResourceType.reading, "url": "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/", "competency_tags": ["algorithms", "data structures", "sorting", "searching"]},
    {"title": "Khan Academy - Algebra Fundamentals", "type": ResourceType.video, "url": "https://www.khanacademy.org/math/algebra", "competency_tags": ["algebra", "equations", "functions", "mathematics"]},
    {"title": "Python Programming Exercises - HackerRank", "type": ResourceType.exercise, "url": "https://www.hackerrank.com/domains/python", "competency_tags": ["python", "programming", "functions", "loops", "data types"]},
    {"title": "Database Design Fundamentals", "type": ResourceType.reading, "url": "https://www.ibm.com/topics/database", "competency_tags": ["database", "SQL", "normalization", "relational model"]},
    {"title": "Object-Oriented Programming Concepts", "type": ResourceType.video, "url": "https://www.coursera.org/learn/object-oriented-java", "competency_tags": ["OOP", "classes", "inheritance", "polymorphism", "encapsulation"]},
    {"title": "Data Structures Practice Problems", "type": ResourceType.exercise, "url": "https://leetcode.com/explore/learn/card/data-structure-tree/", "competency_tags": ["data structures", "trees", "linked lists", "stacks", "queues"]},
    {"title": "Network Fundamentals - Cisco", "type": ResourceType.reading, "url": "https://www.cisco.com/c/en/us/solutions/enterprise-networks/what-is-network.html", "competency_tags": ["networking", "TCP/IP", "protocols", "OSI model"]},
    {"title": "Statistics and Probability - Khan Academy", "type": ResourceType.video, "url": "https://www.khanacademy.org/math/statistics-probability", "competency_tags": ["statistics", "probability", "mean", "variance", "distributions"]},
    {"title": "Web Development Basics - MDN", "type": ResourceType.reading, "url": "https://developer.mozilla.org/en-US/docs/Learn", "competency_tags": ["HTML", "CSS", "JavaScript", "web development", "DOM"]},
    {"title": "Software Engineering Principles", "type": ResourceType.reading, "url": "https://www.geeksforgeeks.org/software-engineering/", "competency_tags": ["software engineering", "SDLC", "design patterns", "testing", "agile"]},
    {"title": "Discrete Mathematics Practice", "type": ResourceType.exercise, "url": "https://brilliant.org/courses/discrete-math/", "competency_tags": ["discrete math", "logic", "sets", "graph theory", "combinatorics"]},
    {"title": "Operating Systems Concepts", "type": ResourceType.video, "url": "https://www.coursera.org/learn/os-power-user", "competency_tags": ["operating systems", "processes", "memory management", "file systems", "scheduling"]},
]


def seed():
    db = SessionLocal()
    try:
        # Admin user
        existing = db.query(User).filter(User.email == "admin@ailas.edu").first()
        if not existing:
            admin = User(
                email="admin@ailas.edu",
                password_hash=hash_password("Admin@1234"),
                full_name="System Administrator",
                role=UserRole.admin,
            )
            db.add(admin)
            db.commit()
            print("Admin user created: admin@ailas.edu / Admin@1234")
        else:
            print("Admin user already exists.")

        # Resources
        existing_count = db.query(Resource).count()
        if existing_count == 0:
            for r in SAMPLE_RESOURCES:
                db.add(Resource(**r))
            db.commit()
            print(f"{len(SAMPLE_RESOURCES)} sample resources seeded.")
        else:
            print(f"Resources already seeded ({existing_count} records).")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
