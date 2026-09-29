# AI Chat provider setup

Existing account Worker: bens-wacky-accounts. Frontend remains on GitHub Pages.

- Add Cloudflare secrets `GROQ_API_KEY` and `OPENROUTER_API_KEY`.
- Add Workers AI binding `AI`.
- For an existing AI database, apply `ai-providers.sql` once; fresh installations use `ai-schema.sql`.
- Deploy `ai.mjs` and `ai-providers.mjs` with the existing Worker modules and bindings preserved. Publish frontend changes through GitHub.

Order: Groq (openai/gpt-oss-20b), Cloudflare (llama-3.1-8b-instruct-fp8-fast), OpenRouter (openrouter/free, free models only). Missing providers are skipped; errors, empty answers, quota exhaustion and 15-second timeouts trigger fallback. Successful replies show provider with the model in the label tooltip. A Cloudflare inference that times out locally may still finish remotely; its late result is ignored. Paid plan changes are not made by the app.

One private conversation per profile, 24-hour message expiry. Queries immediately exclude expired messages; hourly cleanup removes expired rows from the live database, not provider retention or backups. Latest six unexpired exchanges accompany each request without usernames, account IDs, or browser identifiers. UI discloses all provider destinations.

10 successful responses per account AND signed browser cookie per Arizona day, shared across all providers. Logout does not reset browser usage; clearing cookies or changing browser can bypass the browser layer. Atomic reservations and request IDs prevent concurrent overuse or duplicate retries. A successful fallback costs one allowance; all providers failing refunds it. No IP limits or global budget in this version.

Run `node account-service/ai-test.mjs`, `node account-service/ai-providers-test.mjs`, and `node account-service/test.mjs`. These use mock providers and in-memory databases without real credits.

## Attachments
Apply `ai-attachments.sql` once to existing databases. One attachment per message: PNG/JPEG/WebP input (resized to JPEG, at most 400,000 data URL characters), text/code up to 12,000 characters, or PDF up to 20 pages and 12,000 extracted characters. Browser input file cap is 8 MB (text 100 KB). Scanned PDFs require screenshots; encrypted/unreadable documents report an error. PDF.js is vendored with its license. Server independently validates attachment shape, length and image signatures, and accepts no remote image URLs. AI JSON bodies are capped at 500,000 bytes; other account routes retain their 4 KB cap. Attachments live in the authenticated conversation rows, expire after 24 hours, and are not publicly served. History API exposes only file name/type. Recent attachments are included in follow-ups. Image conversations skip text-only Groq and use Cloudflare Llama 4 Scout, then OpenRouter free vision routing. Attachments consume the same single response allowance, though they use more provider capacity.
