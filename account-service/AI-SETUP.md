# AI Chat provider setup

Existing account Worker: bens-wacky-accounts. Frontend remains on GitHub Pages.

- Add Cloudflare secrets `GROQ_API_KEY` and `OPENROUTER_API_KEY`.
- Add Workers AI binding `AI`.
- For an existing AI database, apply `ai-providers.sql` once; fresh installations use `ai-schema.sql`.
- Deploy `ai.mjs` and `ai-providers.mjs` with the existing Worker modules and bindings preserved. Publish frontend changes through GitHub.

Order: Groq (openai/gpt-oss-20b), Cloudflare (llama-3.1-8b-instruct-fp8-fast), OpenRouter (openrouter/free, free models only). Missing providers are skipped; errors, empty answers, quota exhaustion and 15-second timeouts trigger fallback. Successful replies show provider with the model in the label tooltip. A Cloudflare inference that times out locally may still finish remotely; its late result is ignored. Paid plan changes are not made by the app.

One private conversation per profile, 24-hour message expiry. Queries immediately exclude expired messages; hourly cleanup removes expired rows from the live database, not provider retention or backups. Latest six unexpired exchanges accompany each request without usernames, account IDs, or browser identifiers. UI discloses all provider destinations.

15 messages per account AND signed browser cookie per Arizona day, shared across all providers. Logout does not reset browser usage; clearing cookies or changing browser can bypass the browser layer. Atomic reservations and request IDs prevent concurrent overuse or duplicate retries. A successful fallback costs one allowance; all providers failing refunds it. No IP limits or global budget in this version.

Run `node account-service/ai-test.mjs`, `node account-service/ai-providers-test.mjs`, and `node account-service/test.mjs`. These use mock providers and in-memory databases without real credits.
