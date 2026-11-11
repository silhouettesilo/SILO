# SILO 3.0 Recovery Build

SILO is an intelligent business workspace for tasks, customers, documents, automations,
analytics, AI assistance and approval-based AI Employee workflows. This recovered build
combines the preserved SILO 2.0 commercial foundation, the 2.1 email-verification upgrade,
and verified source-level recovery additions. It is still a development build, not a
public-sale release.

## Requirements
- Node.js 20 or newer
- npm
- SQLite native build support for `better-sqlite3`
- Optional local Ollama for local AI

## Public website and pricing
- Marketing website: `/` (also available at `/website.html`)
- Pricing: `/pricing.html` (Starter $19/month, Pro $49/month, Business custom; one subscription per business workspace, no per-employee billing).
- The registration links open the account creation form. Paid checkout remains unavailable until the operator configures and tests Stripe. The agreed 14-day trial is implemented in Stripe checkout, but must be tested with configured Stripe and Resend accounts before it is advertised as live.

## Local setup
1. Back up the existing SILO project and stop its server before replacing source files.
2. Preserve your existing `.env` and the entire `server/data/` directory.
3. Install dependencies with `npm install`.
4. Create `.env` from `.env.example` only if you do not already have one.
5. Set a long random `SESSION_SECRET`. For production, set `NODE_ENV=production`, an HTTPS
   `APP_URL`, Resend credentials and a verified sender domain. Never commit `.env`.
6. Set `MFA_ENCRYPTION_KEY` to a separate random value of at least 32 characters before production. Keep it stable; changing it makes existing encrypted authenticator secrets unreadable.
7. Start with `npm start` and open `http://localhost:3000` for the public website. Use `http://localhost:3000/?register=1` to create an account or `/?login=1` to sign in.
8. The initial setup key is printed in the server terminal if no users exist.

## Recovery features
- Email verification, password recovery and verified email changes via Resend.
- Workspace creation with plan caps, workspace switching, ownership transfer, invitations, member management and account deletion safeguards.
- Optional authenticator-app MFA with encrypted TOTP secrets, replay protection, and single-use recovery codes.
- CSV import/export for tasks, customers and documents.
- Calendar events with recurring schedules and email reminders; reusable templates and reviewed email drafts/sent history.
- Industry starter packs and support-ticket storage.
- Workspace-specific Business Memory for goals, decisions, customer context, preferences, lessons and processes; owners/admins can add, edit and delete entries, and AI context can reference them.
- AI token usage ledger, proposal approval/rejection history and guarded proposal undo.
- Stripe webhook idempotency protections.

## Calendar and customer email
Calendar events support daily, weekly and monthly recurrence. Optional email reminders are delivered to the event creator using Resend, with per-account notification preferences. Failed or development-only reminders remain visible and can be retried. Email templates are workspace-scoped; customer emails are saved as drafts, and only owners/admins can explicitly send them. Configure Resend before sending real customer communications.

## AI
The AI provider can be `ollama` or `openai` using the server-side Responses API integration. The AI Employee can prepare calendar events and customer email drafts for review; it cannot send emails or perform external actions. Safe undo refuses to reverse drafts that have changed or been sent, and calendar events that have already triggered reminders or recurring occurrences.
Ollama on your Mac is local to that machine; it does not provide hosted AI for remote customers.
For hosted AI, configure `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL`. An optional
`AI_FALLBACK_PROVIDER=ollama` enables fallback only when explicitly configured. Workspace
monthly request limits and token usage tracking are enforced. To estimate hosted costs, set
`AI_INPUT_COST_PER_MILLION_USD` and `AI_OUTPUT_COST_PER_MILLION_USD` to the current provider
rates for the selected model; otherwise the usage ledger records tokens but no reliable cost
estimate. Owners/admins can configure a monthly budget alert; alerts do not automatically
block usage. Automatic per-model price synchronization is not implemented.

## Container deployment

A Dockerfile and Compose template are included. Configure a production `.env` first with a
strong `SESSION_SECRET` and separate `MFA_ENCRYPTION_KEY` (both 32+ characters), HTTPS `APP_URL`, `RESEND_API_KEY`, and `EMAIL_FROM`. If enabling Stripe, configure the secret key, webhook secret and both Starter/Pro Price IDs before starting production.
Then run `docker compose up -d --build`. SQLite data persists in the named `silo_data` volume.
Back up that volume regularly and test restoring it before launch. Compose binds the app to loopback (`127.0.0.1`) so it can sit behind a TLS reverse proxy; do not expose an unencrypted public HTTP endpoint.

## Pricing and billing
The public plan overview is available at `/pricing.html`: Starter $19/month and Pro $49/month, with Business custom pricing. Stripe Price IDs must be configured by the operator and verified to match these monthly prices before checkout is enabled. Checkout creates a 14-day trial and requires payment-method collection; Stripe emits the trial-ending event and SILO attempts a reminder email through Resend. Test the complete flow in Stripe test mode before launch.

## Billing and email
Stripe and Resend require your own provider accounts and credentials. Test checkout,
webhook signatures, duplicate deliveries, cancellation and failed-payment flows in Stripe
test mode before enabling billing. Verify Resend delivery with a domain you control.

## Validation
A GitHub Actions workflow runs the verification suite on Node.js 22 and 24 for pushes and pull requests to `main` and `silo-2.0`.

Run `npm test` (MFA security checks, Stripe ordering checks, schema compatibility checks, and native SQLite verification) and `npm audit` after installing dependencies. Full HTTP integration
tests, native SQLite runtime tests, provider tests, security review, browser/mobile QA,
accessibility, load testing, deployment hardening and legal review remain required.

Workspace backups use format v4 and include workspace records, calendar events, email templates/messages, support tickets, AI usage/history and Business Memory. Restore also accepts older v2 and v3 backups. Restore is restricted to owners/admins and preserves account security and billing state.

Read `BUILD_STATUS.txt`, `docs/PRODUCT_SCOPE.md`, `docs/ROADMAP.md`, `docs/PRODUCTION_SETUP.md` and `legal/RELEASE_CHECKLIST.md` before deploying. Do not delete or overwrite existing database files.
