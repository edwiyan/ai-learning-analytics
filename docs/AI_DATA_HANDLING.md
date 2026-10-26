# AI data handling — what leaves the server

Evidence for the manuscript's §3.9.1 (panel comments 6 and 7). Every LLM call goes through
`backend/services/ai/llm_client.py`; prompts are built only in `backend/services/ai/prompts.py`.

## What each AI call sends

| Purpose (`purpose=`) | Built by | Sends | Student data? |
|---|---|---|---|
| `syllabus_parse` | `build_syllabus_prompt` | Syllabus text, emails and phone numbers removed (`redact_contact`) | No |
| `topic_mapping` | `build_mapping_prompt` | One question's text + the course competency list | No |
| `syllabus_alignment` | `build_syllabus_alignment_prompt` | Course learning outcomes + program outcomes | No |
| `resource_suggestion` | `build_resource_suggestion_prompt` | One competency + candidate repository resource titles/tags | No |
| `encouragement` | `build_encouragement_prompt` | Up to 3 weak-topic names + one resource title | No identity, no scores |
| exam question drafts | `services/ai/question_generator.py` | Competency / learning-outcome text | No |

Never sent: student numbers, names, emails, scores, grades, mastery, risk levels, interventions,
attendance. All performance calculations run locally.

## Safeguards in code

- **Prompt guard** (`guard_prompt`): before any provider call, email addresses are replaced and
  the prompt is refused (`PromptBlocked`) if it contains a registered student number or a
  student's full name. Tested in `backend/tests/test_ai_privacy.py`, including an end-to-end CSV
  upload that captures every prompt and checks for student numbers, names and score values.
- **No storage request:** both OpenAI calls pass `store=False`.
- **Single provider by default:** the Gemini fallback runs only when `GEMINI_ENABLED=true` and
  `GEMINI_API_KEY` are set. Use a paid Gemini account if enabled (free-tier data may be used by
  Google to improve its products).
- **Local cache:** responses are cached in the local `llm_cache` table, so repeated prompts are
  not re-sent.
- **Admin visibility:** Admin dashboard → "AI Provider and Data Handling" shows the providers in
  use and what is sent (`/health` → `llm.data_handling`).

## Evidence to collect for the manuscript appendix

1. Which OpenAI organization/account the pilot uses (BTECH-owned or personal).
2. Screenshot of that organization's data-controls settings (training opt-out / retention) with the
   date it was taken.
3. The URL and access date of OpenAI's API data-usage policy, and the retention period it states.
4. Zero data retention: only if the organization has been approved for it — keep the approval.
   Otherwise the manuscript must not claim it.
5. Confirmation that `GEMINI_ENABLED` is `false` in the pilot deployment (or the paid account's terms).
