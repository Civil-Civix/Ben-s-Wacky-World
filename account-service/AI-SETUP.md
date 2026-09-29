# AI Chat setup

AI Chat uses the existing authenticated account Worker and D1 database. The public website remains on GitHub Pages.

1. Apply `ai-schema.sql` to the accounts database before deploying `worker.mjs` and `ai.mjs`.
2. In Cloudflare, open Workers & Pages > bens-wacky-accounts > Settings > Variables and Secrets. Add a **Secret** named `MISTRAL_API_KEY` containing the Mistral API key. Save/deploy it. Never add the key to GitHub or frontend files.
3. Optional plain variable `MISTRAL_MODEL` overrides `mistral-small-latest`.
4. Publish the frontend through the usual GitHub workflow.

The API is disabled until the secret exists. One conversation per profile. Each message and answer expires 24 hours after the message was submitted; expired rows are excluded immediately and physically removed by the hourly cleanup. This controls our live database, not provider retention or database recovery backups. Only that account can retrieve its history. Only its latest six unexpired exchanges are sent to Mistral, without profile IDs, usernames, or browser identifiers.

15 user messages per account AND browser per Arizona calendar day. The browser has a signed Secure HttpOnly SameSite=None Partitioned cookie that survives logout. Clearing cookies or using a different browser bypasses the browser layer but not the same account's allowance. Shared browsers share an allowance. Atomic reservations include pending calls. Failed calls release the allowance; request IDs avoid duplicate billing on retries. One in-flight call per account. 1,000 input characters and 800 output tokens per message; 35-second provider timeout. No browser fingerprinting, IP quotas, or global daily budget in this version.

Tests: `node account-service/ai-test.mjs` uses an in-memory database and a mocked Mistral response; it does not use the real key or send real conversations. `node account-service/test.mjs` checks existing account/chat behavior.
