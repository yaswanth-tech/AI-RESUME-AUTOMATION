# AI integration and data handling

## Provider and model

All active resume-analysis, JD parsing and improvement calls go through `backend/services/aiService.js` and `aiProviderService.js`. The OpenAI adapter uses the existing `openai` package and Responses API. Configure `AI_PROVIDER=openai`, `AI_MODEL` and `OPENAI_API_KEY`; `AI_ENABLED` must explicitly be `true`. Unsupported providers, missing credentials, provider errors and invalid output fall back to deterministic rule logic. The retired Gemini SDK/model is not used by the active resume path.

The configured default is `gpt-6-luna`, an available structured-output model selected for low-cost focused tasks. Current listed standard rates are $0.10 per million input tokens and $0.50 per million output tokens; provider prices can change. A single request's actual cost depends on input/output size and retries. Check [the official model page](https://developers.openai.com/api/docs/models/gpt-6-luna) and [pricing](https://developers.openai.com/api/docs/pricing) before deployment.

## Prompt and output safety

- Versioned prompt text is in `backend/prompts/v1/`.
- Responses request strict JSON Schema output and are parsed with Zod. One retry is made for provider or validation errors.
- Resume analysis evidence quotes must match the redacted supplied sections. Rewrites are filtered for unsupported original bullets, unsupported skills, and likely new numeric, technology or credential claims. Summary rewrites require evidence.
- Rule-based parser, evaluator and conservative improvements remain the fallback. The fallback preserves source language rather than inventing an AI rewrite.
- Accepted improvements apply only the exact suggestion persisted for that user's resume; rejection leaves candidate fields unchanged.

These checks reduce risk; they are not a formal guarantee that every generated phrase is factually correct. Candidates must review output.

## PII sent to the provider

Before AI calls, the service excludes `name`, `email`, `phone`, `rawText`, and list aliases. It sends selected section text (`summary`, `education`, `experience`, `skills`, `tools`, `certifications`, `projects`, `achievements`), a target role, and for JD parsing the supplied job-description text. Email addresses, phone-like strings, URLs and detected street addresses are redacted. Text is capped by `AI_MAX_INPUT_CHARS` (maximum 20,000 characters). JD text is also sent when AI parsing is enabled. Resume and JD file bytes are never sent.

Requests set `store: false`. Provider processing and abuse-monitoring retention remain subject to the provider's current terms and account controls; this is not zero-retention. AI is disabled in the sample configuration.

## Operations

- `AI_TIMEOUT_MS`: request timeout; default 20 seconds.
- `AI_MAX_INPUT_CHARS`: request text cap; defaults to 12,000.
- `AI_CACHE_TTL_SECONDS`: in-memory cache TTL; defaults to one day. Cache keys include user, task, model, prompt version and content hash. Cache is bounded to 1,000 entries and is lost at restart.
- `AI_INPUT_COST_PER_MILLION` / `AI_OUTPUT_COST_PER_MILLION`: optional rates used for estimated-cost structured logs. Token counts are logged when returned; no resume text, identifiers or content hashes are logged.
- Per-user AI route rate limits apply. Provider rate limits still depend on account tier.
- OCR is local. Configure `TESSDATA_DIR` for offline trained data; otherwise Tesseract.js may fetch language data. Resume images/text are processed locally by the OCR worker.

## Prompt files

- `resume_analysis.txt`: strengths, weaknesses, missing information and suggestions with explanations/evidence.
- `job_description.txt`: structured requirements extraction.
- `resume_improvements.txt`: evidence-grounded rewrite instructions.
