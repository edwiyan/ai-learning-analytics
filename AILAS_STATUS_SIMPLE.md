# AILAS — Simple Status Report

**In plain words: does the system match the capstone document?**
Report date: June 2, 2026

---

## The short answer

**Yes — the system matches the document very well.** Everything the paper promises as the core idea is already built and working. A few small extras are still on the to-do list, but none of them are deal-breakers. The only real mismatches are a handful of sentences in the Word document that need light editing — the *system* is fine.

Think of it like building a house from a blueprint: the foundation, walls, rooms, and wiring all match the plan. What's left is a few light fixtures and some typos on the blueprint itself.

---

## What the document asked for (in plain terms)

The capstone describes a website that helps teachers spot struggling students early. The idea is:

1. A teacher uploads a **syllabus** (PDF/Word) and **student grades** (a spreadsheet/CSV).
2. **AI (ChatGPT-style)** reads the questions and matches each one to a topic in the syllabus — automatically, so the teacher doesn't have to tag them by hand.
3. The system then shows **dashboards**: which students are at risk, which topics the class is struggling with, and what help to recommend.
4. Finally, the project is **tested with real users** to see if it's easy to use.

It must run for **BTECH** (the school in Baliwag that will use it), keep student identities **private**, and use **simple AI** (no complicated custom-built AI models).

---

## What's already done and matches ✅

| Promise in the document | In the system? |
|---|---|
| Built for BTECH (Baliwag) | ✅ Yes — every screen and label says BTECH |
| Upload syllabus + grades | ✅ Yes |
| AI matches questions to topics automatically | ✅ Yes (uses ChatGPT/GPT-4o-mini) |
| Flag "at-risk" students with a clear rule | ✅ Yes — exactly the rule in the paper (3+ weak topics, or grades dropping more than 15%) |
| Rate each topic: Strong / Okay / Weak | ✅ Yes — same cut-offs as the paper (85%+, 75–84%, below 75%) |
| Teacher can review and fix the AI's guesses | ✅ Yes |
| Keep student IDs private (scrambled/hashed) | ✅ Yes |
| Dashboards for students, teachers, admins | ✅ Yes |
| Survey to measure how easy the system is to use | ✅ Yes |
| Use simple AI only — no custom-built AI model | ✅ Yes — confirmed, none of that is in the system |

**The system even does *more* than the paper requires:** it has the full school approval flow (teacher → program director → dean → VP), attendance tracking, and grade management. That's a bonus, not a problem — just be ready to explain it as "we built the whole workflow, not just the pilot piece."

---

## What's still left to do (all small)

| Item | What it means | How important |
|---|---|---|
| Reading scanned PDFs | The system can read normal PDFs and Word files. Reading *scanned/photographed* syllabi (OCR) is now built in, but it only switches on once a small free tool ("Tesseract") is installed on the school's server. | Low — only matters if teachers upload scanned images |
| Email/text alerts | The system shows alerts inside the website (a notification bell), and sends welcome emails. Text-message (SMS) and pop-up phone alerts aren't built yet. | Low — the document lists these as "nice to have" |
| "Please wait" progress bar | When the AI is matching questions, there's no loading bar — it just works in the background. | Low — cosmetic |
| A few optional extras | Things like special grade types and extra advising templates. | Low — meant for after the defense |
| One final test run | Do a full start-to-finish run on the real database before the defense, just to be safe. | Do this before defense |

**None of these block the thesis defense.** They're polish items.

---

## The things that actually need fixing are in the WORD DOCUMENT, not the system

These are small wording fixes in the capstone paper so it matches the working system:

1. **One sentence mentions "TF-IDF and Cosine Similarity"** (an old AI method). The system doesn't use that anymore — it uses ChatGPT-style AI. → Just reword that one sentence.
2. **The paper says "Flask" in one place.** The system actually uses "FastAPI" (a close cousin). → Make it say FastAPI.
3. **One line mentions a "Random Forest" (a custom AI model).** The project doesn't build one of those. → Remove that leftover line.
4. **A typo:** one program is listed twice ("Bachelor of Science in Information Technology"). → Fix the duplicate.
5. **The "List of Tables" says "none,"** but Chapter 3 has several tables. → List them.

**Important:** The cover page saying **"Bulacan Agricultural State College (BASC)"** is **correct and intentional** — that's the school you submit the thesis to. **BTECH** is the school that will *use* the system. Both belong in the paper. This is not a mistake.

---

## What to do next (in order)

1. **Fix the 5 small wording items** in the Word document above. (Quick, and it prevents panel questions.)
2. **Install the free "Tesseract" tool** on the school's server so scanned PDFs can be read.
3. **During the pilot,** have a few teachers confirm the AI's topic matches — that's the "accuracy" evidence the paper needs.
4. **Run one full test** on the real database before the defense.

---

## Bottom line

The system is **faithful to the capstone document** — the important parts are all built and working exactly as described. The leftover tasks are minor polish, and the only true corrections needed are a few sentences in the paper itself. You are **not far off** the document at all. ✅
