# Phase 0 — Pre-flight Report

**Date:** 2026-05-22  
**Auditor:** Claude Code (QA Lead)  
**Project:** AILAS — AI-Assisted Learning Analytics System

---

## Stack Summary

| Layer | Technology | Dev Command | Port |
|---|---|---|---|
| Frontend | React.js + Vite + Tailwind CSS | `npm run dev` | 5173 |
| Backend | Python + FastAPI + Uvicorn | `uvicorn backend.main:app --reload` | 8000 |
| Database | PostgreSQL | Docker Compose | 5432 |
| Cache | Redis | Docker Compose | 6379 |
| AI/ML | OpenAI GPT-4o-mini, Random Forest | — | — |
| Auth | JWT (HS256, 30-min expiry), SHA-256 hashed student IDs | — | — |

---

## Server Status

| Service | Status | Evidence |
|---|---|---|
| Backend (FastAPI) | RUNNING | GET /health → {"status":"ok","service":"ailas-backend"} (HTTP 200) |
| Frontend (Vite) | RUNNING | GET http://localhost:5173 → HTTP 200 |
| OpenAPI docs | AVAILABLE | GET http://localhost:8000/docs → HTTP 200 |

---

## API Inventory

- Total endpoints: 110
- Auth: 3 | Users: 10 | Courses: 4 | Syllabi: 11
- Assessments: 10+ | Analytics: 30+ | Grade Submissions: 7
- Attendance: 4 | Grade Consultations: 5 | Academic Standing: 5 | SUS: 3

---

## User Roles

Admin, Instructor, Student, Program Director, Dean, VP for Academic Affairs

---

## Testing Tools Status

- @playwright/test 1.60.0 — INSTALLED
- @axe-core/playwright 4.11.3 — INSTALLED
- Playwright Chromium 148.0.7778.96 — INSTALLED
- lighthouse 13.3.0 — INSTALLED (just added)

---

## Pre-flight Status: READY (pending credentials)
