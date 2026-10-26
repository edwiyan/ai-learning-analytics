# -*- coding: utf-8 -*-
"""Generate the AILAS QA Word report onto the Desktop."""
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
import os, datetime

NAVY = RGBColor(0x1F, 0x33, 0x66)
GREEN = RGBColor(0x1B, 0x7F, 0x3B)
RED = RGBColor(0xB0, 0x20, 0x20)
AMBER = RGBColor(0xB8, 0x6A, 0x00)
GREY = RGBColor(0x55, 0x55, 0x55)

doc = Document()

# Base style
st = doc.styles['Normal']
st.font.name = 'Calibri'
st.font.size = Pt(10.5)

def h(text, level=1, color=NAVY):
    p = doc.add_heading(text, level=level)
    for r in p.runs:
        r.font.color.rgb = color
    return p

def para(text, bold=False, italic=False, color=None, size=None, space_after=6):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.bold = bold; r.italic = italic
    if color: r.font.color.rgb = color
    if size: r.font.size = Pt(size)
    p.paragraph_format.space_after = Pt(space_after)
    return p

def bullet(text, bold_prefix=None):
    p = doc.add_paragraph(style='List Bullet')
    if bold_prefix:
        r = p.add_run(bold_prefix); r.bold = True
        p.add_run(text)
    else:
        p.add_run(text)
    return p

def table(headers, rows, widths=None, status_col=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = 'Light Grid Accent 1'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = t.rows[0].cells
    for i, hd in enumerate(headers):
        hdr[i].text = ''
        rr = hdr[i].paragraphs[0].add_run(hd)
        rr.bold = True; rr.font.size = Pt(9.5); rr.font.color.rgb = RGBColor(0xFF,0xFF,0xFF)
    # shade header
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    for c in hdr:
        tcPr = c._tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd'); shd.set(qn('w:fill'), '1F3366'); tcPr.append(shd)
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = ''
            p = cells[i].paragraphs[0]
            rr = p.add_run(str(val)); rr.font.size = Pt(9.5)
            if status_col is not None and i == status_col:
                v = str(val)
                if v.startswith('PASS') or v.startswith('✅') or 'Resolved' in v:
                    rr.font.color.rgb = GREEN; rr.bold = True
                elif 'FAIL' in v or '❌' in v:
                    rr.font.color.rgb = RED; rr.bold = True
                elif 'Open' in v or 'action' in v:
                    rr.font.color.rgb = AMBER; rr.bold = True
    if widths:
        for i, w in enumerate(widths):
            for row in t.rows:
                row.cells[i].width = Inches(w)
    return t

# ---------- Title ----------
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = title.add_run('AILAS — Quality Assurance Report')
r.bold = True; r.font.size = Pt(22); r.font.color.rgb = NAVY
sub = doc.add_paragraph(); sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = sub.add_run('AI-Assisted Learning Analytics System')
r.font.size = Pt(13); r.font.color.rgb = GREY
sub2 = doc.add_paragraph(); sub2.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = sub2.add_run('Dalubhasaang Politekniko ng Lungsod ng Baliwag (BTECH) — Capstone')
r.font.size = Pt(11); r.italic = True; r.font.color.rgb = GREY

meta = doc.add_paragraph(); meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
meta.paragraph_format.space_before = Pt(14)
for line in ['QA Engineer: Alex (Senior QA, Claude Code)',
             'Date: 3 June 2026',
             'Environment: Docker Compose — FastAPI + React/Vite + PostgreSQL 16 + Redis',
             'Method: API-first verification + full Playwright UI walkthrough (all 6 roles)']:
    rr = meta.add_run(line + '\n'); rr.font.size = Pt(10); rr.font.color.rgb = GREY

# Verdict banner
vb = doc.add_paragraph(); vb.alignment = WD_ALIGN_PARAGRAPH.CENTER
vb.paragraph_format.space_before = Pt(10)
rr = vb.add_run('OVERALL VERDICT:  PASS — DEFENSE-READY')
rr.bold = True; rr.font.size = Pt(14); rr.font.color.rgb = GREEN

doc.add_paragraph()

# ---------- Executive Summary ----------
h('Executive Summary', 1)
para('A full enterprise-grade QA engagement was performed on AILAS across ten test phases plus '
     'an exhaustive Playwright UI walkthrough of every page for all six roles. Every '
     'capstone-critical business rule was verified both at the source and behaviourally: the '
     'deterministic at-risk engine, the 0.75 AI-confidence / human-in-the-loop threshold, the '
     'mastery bands, the SUS scoring formula, the multi-stage approval chain with bypass '
     'protection, role-based access control across six roles, and RA 10173 data-privacy '
     'pseudonymisation (SHA-256 hashing and consent gating).')
para('All findings that can be fixed in code (BUG-001 through BUG-007) were fixed and '
     're-verified during the engagement. The single remaining open item is the rotation of the '
     'SMTP and OpenAI secrets stored in the local .env file — a proponent action that cannot be '
     'performed from code.', space_after=4)

h('Findings at a glance', 2)
table(['Severity', 'Count', 'Status'],
      [['Critical', '0', '—'],
       ['High', '0', '—'],
       ['Medium', '3 (BUG-001, BUG-002, BUG-007)', '✅ All resolved'],
       ['Low', '4 (BUG-003..006)', '✅ All resolved'],
       ['Info / proponent action', '2 (OBS-1, OBS-2)', 'OBS-2 open (rotate secrets)']],
      status_col=2)
para('Project automated test suite after fixes: 40 passed, 1 skipped. UI screenshots captured: 66.',
     italic=True, color=GREY, size=9.5)

# ---------- Phase Results ----------
doc.add_page_break()
h('Test Phase Results', 1)
table(['Phase', 'Area', 'Status', 'Issues'],
      [['0','Environment validation','PASS','BUG-001 (env, fixed)'],
       ['1','Sessions & auth (6 roles)','PASS','—'],
       ['2','Smoke testing (API + UI)','PASS','BUG-002 lead'],
       ['3','Functional (rules/workflow/SUS)','PASS','BUG-002 (fixed)'],
       ['4','Security & RBAC','PASS','2 Low (fixed)'],
       ['5','Performance (SLAs)','PASS','—'],
       ['6','Compatibility (Chromium/FF/WebKit/mobile)','PASS','—'],
       ['7','Regression','PASS','1 Low (fixed)'],
       ['8','Exploratory','PASS','1 Low (fixed)'],
       ['9','Compliance & privacy (RA 10173)','PASS','1 Low (fixed)'],
       ['UI','Full Playwright walkthrough (6 roles)','PASS','BUG-007 (fixed)']],
      status_col=2)

# ---------- Capstone Compliance ----------
h('Capstone Compliance Matrix', 1)
table(['Requirement', 'Result', 'Evidence'],
      [['BTECH branding (not BASC)','PASS','rendered dashboards'],
       ['At-Risk rule: >=3 gaps OR >15% decline','PASS','engine boundary tests'],
       ['Mastery bands (>=85 / 75-84 / <75)','PASS','student dashboard'],
       ['AI confidence >=0.75 auto-accept, else HITL','PASS','threshold verified'],
       ['SHA-256 hashed_identifier (10/10 students)','PASS','DB validation'],
       ['Performance data keyed by hash, not raw ID','PASS','schema audit'],
       ['GPT-4o-mini only (no TF-IDF / sklearn)','PASS','source scan'],
       ['Dashboard load < 3s','PASS','~284 ms'],
       ['API response < 5s','PASS','<=0.12 s'],
       ['SUS survey functional + correct math','PASS','score 82.5'],
       ['3-phase approval chain + bypass-proof','PASS','self-approve 403'],
       ['AI outputs advisory + faculty override','PASS','intervention alerts'],
       ['RBAC blocks unauthorized access','PASS','all cross-role 403'],
       ['RA 10173 consent + no raw IDs (student)','PASS','451 gate; scan clean'],
       ['Migration head n4j5k6l7m8n9','PASS','alembic current'],
       ['Attendance NOT in risk flag','PASS','engine + UI copy fixed']],
      status_col=1)

# ---------- Bug register ----------
doc.add_page_break()
h('Bug Register (all code findings resolved)', 1)
bugs = [
 ('BUG-001','Medium','Stale backend Docker image (built before migration n4j5k6l7m8n9) crashed on boot against an already-migrated DB volume.','Rebuilt the backend image; documented that backend changes need a rebuild (no code volume mount).','Resolved'),
 ('BUG-002','Medium','Instructor dashboard wrongly stated absence >30% flags At-Risk, contradicting the engine and Delimitation #2.','Rewrote the Attendance card copy: attendance is context-only and does not drive the flag; states the real rule.','Resolved'),
 ('BUG-003','Low','API JSON exposed legacy field names while DB/ERD use mapping_confidence / requires_review / llm_structured_output.','Added ERD-named fields additively to the assessment-item & syllabus responses (legacy keys retained for the frontend).','Resolved'),
 ('BUG-004','Low','Wrong-role authenticated user was redirected to /login instead of a 403 page.','Added an /unauthorized 403 page; ProtectedRoute now routes wrong-role users there. Verified on every protected route.','Resolved'),
 ('BUG-005','Low','GET /auth/me returned the student’s own raw student_number.','/auth/me now nulls student_number for the student role; other roles unaffected.','Resolved'),
 ('BUG-006','Low','Admin could create a student without a student_number, leaving hashed_identifier NULL.','POST /users now returns 400 if a student account has no student_number.','Resolved'),
 ('BUG-007','Medium','/analytics-page (and latently /consent) returned raw backend JSON on direct load / refresh — the Vite proxy key /analytics caught the SPA route.','Tightened the proxy keys to /analytics/ and /consent/ in vite.config.js. Direct load + hard refresh now render; APIs still proxy.','Resolved'),
 ('OBS-1','Info','DELETE /users/{id} is a soft-delete (deactivate) — by design; name is misleading.','No change required.','Info'),
 ('OBS-2','Low','Live SMTP app-password and OpenAI key sit in plaintext in .env (gitignored, not committed).','Proponent action: rotate both credentials. Cannot be done from code.','Open'),
]
table(['ID','Sev','Description','Resolution','Status'],
      [[b[0],b[1],b[2],b[3],b[4]] for b in bugs],
      widths=[0.7,0.6,2.6,2.6,0.8], status_col=4)

# ---------- UI walkthrough ----------
h('UI Walkthrough Coverage (Playwright)', 1)
para('Every real page for all six roles was loaded and screenshotted; an error-boundary/crash '
     'scan returned no matches on any rendered page.', space_after=4)
table(['Role','Pages captured','Render'],
      [['Instructor / Faculty','14','OK'],
       ['Student','6','OK'],
       ['Program Director','4','OK'],
       ['Dean','3','OK'],
       ['VPAA','3','OK'],
       ['Admin','12','OK'],
       ['Edge cases','7 (RBAC barriers + logout)','Correct behaviour']],
      status_col=2)
bullet(' Student attempts to reach instructor / approval / admin routes all redirect to /unauthorized (403).', 'RBAC: ')
bullet(' "Sign out" clears the access token and returns to /login.', 'Logout: ')
bullet(' Student data pages require accepting the RA 10173 consent prompt (HTTP 451 until consent).', 'Consent gate: ')

# ---------- Security & privacy ----------
h('Security & Privacy Highlights', 1)
bullet('All cross-role API access attempts return 403; tampered/expired JWT return 401.')
bullet('SQL injection rejected (Pydantic email validation + parameterised ORM); no string-built SQL.')
bullet('XSS: no dangerouslySetInnerHTML; HTML tags are stripped server-side on user input.')
bullet('RA 10173: student numbers SHA-256 hashed; all performance tables keyed by student_id_hash; versioned consent capture with IP logging.')
bullet('AI is advisory only: low-confidence mappings go to human review; interventions are faculty-created; no autonomous grade or standing decisions.')

# ---------- Performance ----------
h('Performance vs SLA', 1)
table(['Metric','Measured','SLA','Result'],
      [['Dashboard load','~284 ms','< 3 s','PASS'],
       ['API response (typical)','11-115 ms','< 5 s','PASS'],
       ['5x concurrent at-risk query','0.51-0.58 s','< 5 s','PASS']],
      status_col=3)
para('Measured against the Vite dev server on the seeded demo dataset; production build and a '
     'larger dataset will change absolute numbers, but the headroom is large.',
     italic=True, color=GREY, size=9.5)

# ---------- Defense readiness ----------
doc.add_page_break()
h('Defense Readiness', 1)
para('The system is ready for capstone defense. All four objectives demonstrably work, every '
     'ISO/IEC 25010 and capstone metric checked passes, and the AI is correctly positioned as '
     'advisory with a human in the loop. All code-level findings have been fixed and verified.',
     space_after=4)
h('Remaining actions for the proponent', 2)
bullet('Rotate the SMTP app-password and OpenAI API key in .env (OBS-2).')
bullet('Confirm the production nginx config has an SPA fallback (try_files ... /index.html) so /analytics-page and /consent also work on refresh in production, not only in the dev proxy.')
bullet('Note: backend code/schema changes require "docker compose build backend" (the backend service has no code volume mount), unlike the frontend.')

# Footer note
doc.add_paragraph()
fn = doc.add_paragraph()
r = fn.add_run('Full evidence — phase summaries, 66 screenshots, API responses, and logs — is in the '
               'project at qa-output/. This document summarises qa-output/reports/MASTER-QA-REPORT.md '
               'and UI-WALKTHROUGH-SUMMARY.md.')
r.italic = True; r.font.size = Pt(9); r.font.color.rgb = GREY

out = r'C:\Users\edria\Desktop\AILAS_QA_Report.docx'
doc.save(out)
print('SAVED:', out)
print('paragraphs:', len(doc.paragraphs), '| tables:', len(doc.tables))
