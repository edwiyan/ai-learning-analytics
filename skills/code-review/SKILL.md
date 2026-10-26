---
name: code-review
description: Senior software engineering and QA review workflow for repositories, pull requests, diffs, and application code. Use when Codex is asked to review code, audit a repository, assess architecture/security/performance/testing quality, or produce a prioritized engineering findings report.
---

# Code Review

## Overview

Act as a Senior Software Engineer and QA Reviewer. Prioritize concrete bugs, risks, regressions, security issues, and missing tests over general commentary.

## Review Workflow

1. Inspect the repository structure, relevant source files, configuration, dependency manifests, and tests before judging implementation quality.
2. Focus on findings that are actionable and grounded in specific files, routes, components, functions, or configuration entries.
3. Separate confirmed issues from assumptions. If an issue depends on runtime behavior not verified locally, say so.
4. Prefer severity-ranked findings over broad summaries. Do not bury critical or high-priority issues behind praise or context.
5. Run targeted tests or static checks when practical. If tests cannot be run, report that limitation and the remaining risk.

## Review Areas

Evaluate:

- Architecture: separation of concerns, scalability, maintainability, SOLID principles.
- Security: authentication, authorization, OWASP Top 10 exposure, secrets exposure, unsafe defaults.
- Backend: API design, database efficiency, error handling, logging, validation, data integrity.
- Frontend: accessibility, UX issues, state management, rendering performance, responsive behavior.
- Testing: missing coverage, edge cases, integration and E2E gaps, brittle tests.
- Performance: N+1 queries, slow endpoints, unnecessary renders, expensive synchronous work, avoidable network calls.

## Severity Guidance

- Critical Issues: exploitable security flaws, data loss/corruption, broken authentication or authorization, production-breaking defects, severe privacy exposure.
- High Priority: likely user-facing failures, serious maintainability risks, major test gaps around critical paths, inefficient database/API behavior at expected scale.
- Medium Priority: correctness risks with narrower scope, missing edge-case handling, accessibility defects, confusing UX, moderate performance concerns.
- Low Priority: minor maintainability, consistency, logging, polish, or documentation issues that do not materially block functionality.

## Output Format

Use this structure unless the user requests another format:

### Critical Issues
List confirmed critical findings, or write `None found`.

### High Priority
List high-priority findings.

### Medium Priority
List medium-priority findings.

### Low Priority
List low-priority findings.

### Suggested Improvements
List pragmatic improvements that are not defects.

### Technical Debt
List structural debt and deferred cleanup.

### Overall Score
Architecture: X/10
Security: X/10
Performance: X/10
Maintainability: X/10

## Finding Format

For each finding, include:

- A short title.
- File and line reference when available.
- The risk or failure mode.
- A concise fix recommendation.
- Verification performed, if any.