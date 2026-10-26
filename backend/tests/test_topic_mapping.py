"""
Topic Mapping Accuracy Test — ISO/IEC 25010 Quality Target: ≥ 85%

Runs map_question_to_competency() against a faculty-validated ground truth
of 21 question→competency pairs drawn from GEC 103, CS 201, and IT 101.

Live run  : requires a valid OPENAI_API_KEY in .env (skipped otherwise)
Mock run  : always runs; proves test structure and 100% mock accuracy
"""

import os
import json
import pytest
from unittest.mock import patch

# ── Ground truth dataset (faculty-validated) ─────────────────────────────────
# Each tuple: (question_text, expected_competency_code, competency_set_key)

GROUND_TRUTH = [
    # GEC 103 — Math in the Modern World
    ("Convert the binary number 1101 to its decimal equivalent.",            "MMW-01", "gec103"),
    ("Perform binary addition: 1011 + 0110.",                               "MMW-01", "gec103"),
    ("Determine if the argument 'If P then Q; P is true; therefore Q' is valid.", "MMW-02", "gec103"),
    ("Identify whether the following statement uses inductive or deductive reasoning.", "MMW-02", "gec103"),
    ("Compute the mean, median, and mode of the dataset: 72, 85, 90, 68, 77.", "MMW-03", "gec103"),
    ("A fair die is rolled. What is the probability of getting a number greater than 4?", "MMW-03", "gec103"),
    ("Calculate compound interest on PHP 50,000 at 6% annual rate for 3 years.", "MMW-04", "gec103"),
    ("A loan of PHP 200,000 is amortized over 5 years at 8% per annum. Compute monthly payment.", "MMW-04", "gec103"),
    ("Find the area of a trapezoid with parallel sides 8 cm and 12 cm and height 5 cm.", "MMW-05", "gec103"),
    ("A cylindrical tank has radius 3 m and height 10 m. Compute its volume.",  "MMW-05", "gec103"),

    # CS 201 — Data Structures and Algorithms
    ("Write a function to reverse a singly linked list in O(n) time.",       "DS-01", "cs201"),
    ("Simulate a queue using two stacks and analyze the amortized time complexity.", "DS-02", "cs201"),
    ("Insert the values 5, 3, 7, 1, 4 into a BST and perform in-order traversal.", "DS-03", "cs201"),
    ("Trace merge sort on the array [38, 27, 43, 3] and compare its complexity to bubble sort.", "DS-04", "cs201"),
    ("Perform BFS on an undirected graph with 6 vertices starting from vertex 0.", "DS-05", "cs201"),
    ("Given an adjacency matrix, implement DFS and list the visit order.",    "DS-05", "cs201"),

    # IT 101 — Introduction to Computing
    ("Describe the role of the ALU and control unit within the CPU.",         "IT-01", "it101"),
    ("Explain the difference between RAM and ROM in terms of volatility.",    "IT-01", "it101"),
    ("Explain the difference between a process and a thread in an OS.",       "IT-02", "it101"),
    ("Describe the difference between a LAN and WAN with a real-world example.", "IT-03", "it101"),
    ("Write a Python function that accepts a list of integers and returns its maximum value.", "IT-04", "it101"),
]

# ── Competency definitions (mirrors seed_demo.py) ────────────────────────────

COMPETENCIES = {
    "gec103": [
        {"competency_code": "MMW-01", "topic_name": "Number Systems and Operations",
         "learning_outcomes": ["Perform operations on different number systems", "Convert between number bases"]},
        {"competency_code": "MMW-02", "topic_name": "Mathematical Reasoning and Logic",
         "learning_outcomes": ["Apply deductive and inductive reasoning", "Construct valid logical arguments"]},
        {"competency_code": "MMW-03", "topic_name": "Statistics and Probability",
         "learning_outcomes": ["Compute measures of central tendency", "Interpret probability distributions"]},
        {"competency_code": "MMW-04", "topic_name": "Mathematical Finance",
         "learning_outcomes": ["Solve problems on simple and compound interest", "Apply annuity and amortization formulas"]},
        {"competency_code": "MMW-05", "topic_name": "Geometry and Measurement",
         "learning_outcomes": ["Apply geometric concepts to real-world problems", "Calculate areas, volumes, and perimeters"]},
    ],
    "cs201": [
        {"competency_code": "DS-01", "topic_name": "Arrays and Linked Lists",
         "learning_outcomes": ["Implement array-based data structures", "Traverse and manipulate linked lists"]},
        {"competency_code": "DS-02", "topic_name": "Stacks and Queues",
         "learning_outcomes": ["Implement stack and queue operations", "Apply stack/queue in problem solving"]},
        {"competency_code": "DS-03", "topic_name": "Trees and Binary Search Trees",
         "learning_outcomes": ["Construct and traverse binary trees", "Implement BST insertion and search"]},
        {"competency_code": "DS-04", "topic_name": "Sorting Algorithms",
         "learning_outcomes": ["Implement and compare sorting algorithms", "Analyze time and space complexity"]},
        {"competency_code": "DS-05", "topic_name": "Graph Theory Basics",
         "learning_outcomes": ["Represent graphs using adjacency matrix and list", "Apply BFS and DFS traversal"]},
    ],
    "it101": [
        {"competency_code": "IT-01", "topic_name": "Computer Hardware Fundamentals",
         "learning_outcomes": ["Identify and explain computer components", "Describe the function of CPU, RAM, and storage"]},
        {"competency_code": "IT-02", "topic_name": "Operating Systems Basics",
         "learning_outcomes": ["Explain OS functions and types", "Navigate file systems and basic OS commands"]},
        {"competency_code": "IT-03", "topic_name": "Network Concepts",
         "learning_outcomes": ["Describe types of networks and topologies", "Explain the OSI model and TCP/IP"]},
        {"competency_code": "IT-04", "topic_name": "Introduction to Programming",
         "learning_outcomes": ["Write basic programs using variables and control flow", "Apply functions and simple algorithms"]},
    ],
}

THRESHOLD = 0.85
TOTAL = len(GROUND_TRUTH)


def _is_real_key() -> bool:
    key = os.getenv("OPENAI_API_KEY", "")
    return bool(key) and not key.startswith("placeholder")


# ── Live API test ─────────────────────────────────────────────────────────────

@pytest.mark.skipif(not _is_real_key(), reason="OPENAI_API_KEY not configured — skipping live accuracy test")
def test_topic_mapping_accuracy_live():
    """Calls the real OpenAI API and asserts accuracy ≥ 85%."""
    from backend.services.ai.topic_mapper import map_question_to_competency

    correct = 0
    failures = []

    for question, expected_code, course_key in GROUND_TRUTH:
        result = map_question_to_competency(question, COMPETENCIES[course_key])
        predicted = result.get("competency_code")
        confidence = result.get("confidence_score", 0.0)

        if predicted == expected_code:
            correct += 1
        else:
            failures.append({
                "question": question[:60] + "...",
                "expected": expected_code,
                "predicted": predicted,
                "confidence": confidence,
            })

    accuracy = correct / TOTAL
    print(f"\n=== Topic Mapping Accuracy ===")
    print(f"Correct : {correct}/{TOTAL}")
    print(f"Accuracy: {accuracy:.1%}  (target: {THRESHOLD:.0%})")
    if failures:
        print(f"\nMismatches ({len(failures)}):")
        for f in failures:
            print(f"  [{f['expected']} → {f['predicted']} conf={f['confidence']:.2f}] {f['question']}")

    assert accuracy >= THRESHOLD, (
        f"Topic mapping accuracy {accuracy:.1%} is below the required {THRESHOLD:.0%}. "
        f"Mismatches: {json.dumps(failures, indent=2)}"
    )


# ── Mock-based structural test (always runs) ─────────────────────────────────

def _mock_mapper(question_text: str, competencies: list[dict]) -> dict:
    """Simulates a perfect mapper: finds the expected code from ground truth."""
    for q, code, _ in GROUND_TRUTH:
        if q == question_text:
            return {"competency_code": code, "confidence_score": 0.95}
    return {"competency_code": None, "confidence_score": 0.0}


@patch("backend.services.ai.topic_mapper.complete_json")
def test_topic_mapping_accuracy_mock(mock_complete):
    """Verifies test harness correctness with a perfect mock mapper."""
    from backend.services.ai.topic_mapper import map_question_to_competency

    correct = 0

    for question, expected_code, course_key in GROUND_TRUTH:
        # The LLM client returns the correct competency
        mock_complete.return_value = {"competency_code": expected_code, "confidence_score": 0.95}

        result = map_question_to_competency(question, COMPETENCIES[course_key])
        if result.get("competency_code") == expected_code:
            correct += 1

    accuracy = correct / TOTAL
    print(f"\n=== Mock Accuracy (structural test) ===")
    print(f"Correct : {correct}/{TOTAL}")
    print(f"Accuracy: {accuracy:.1%}")
    assert accuracy >= THRESHOLD
    assert mock_complete.call_args.kwargs["purpose"] == "topic_mapping"


# ── Confidence threshold test ─────────────────────────────────────────────────

@patch("backend.services.ai.topic_mapper.complete_json")
def test_low_confidence_returns_null_competency(mock_complete):
    """Items below 0.30 confidence must return competency_code=None."""
    from backend.services.ai.topic_mapper import map_question_to_competency

    mock_complete.return_value = {"competency_code": None, "confidence_score": 0.15}

    result = map_question_to_competency("An unrelated question about cooking.", COMPETENCIES["gec103"])
    assert result["competency_code"] is None
    assert result["confidence_score"] < 0.30


@patch("backend.services.ai.topic_mapper.complete_json")
def test_result_keys_present(mock_complete):
    """Response always contains competency_code and confidence_score keys."""
    from backend.services.ai.topic_mapper import map_question_to_competency

    mock_complete.return_value = {"competency_code": "MMW-01", "confidence_score": 0.92}

    result = map_question_to_competency("Convert 1101 binary to decimal.", COMPETENCIES["gec103"])
    assert "competency_code" in result
    assert "confidence_score" in result
    assert isinstance(result["confidence_score"], float)
