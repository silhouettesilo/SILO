# SILO Production Setup Checklist

This document is an operator checklist, not a substitute for professional legal, security or tax advice.

## Required before public customer accounts
- Register and confirm the business identity when ready; use accurate legal entity, address and support contact details.
- Obtain appropriate tax advice and separate business banking/bookkeeping before collecting business revenue.
- Choose a domain and deploy behind HTTPS with a TLS reverse proxy.
- Set `NODE_ENV=production`, a stable random `SESSION_SECRET` and a separate stable random `MFA_ENCRYPTION_KEY` (32+ characters). Store secrets outside source control.
- Configure `APP_URL` to the final HTTPS origin.
- Configure a verified Resend sender domain and `RESEND_API_KEY` / `EMAIL_FROM`; test verification, reset, email change, invitations, reminders and customer email sending.
- Configure Stripe products/prices: $19 Starter and $49 Pro monthly, webhook endpoint `/api/billing/webhook`, webhook signing secret and customer portal. Confirm the price IDs match the intended recurring intervals and currency.
- Run Stripe test-mode checkout, duplicate webhook, upgrade/downgrade, cancellation, failed-payment and recovery tests before switching to live keys.
- Configure hosted AI only if remote customers need hosted inference. Keep API keys server-side, set monthly request limits and current token cost estimates, and verify budget behavior. Local Ollama on the owner's Mac is not hosted AI for remote users.
- Configure database volume persistence, encrypted offsite backups, backup retention and a successful restore drill. Stop the app before copying SQLite database plus WAL/SHM files.
- Configure monitoring, error reporting, log retention and an incident-response contact.
- Complete independent security review, dependency audit, accessibility review, browser/mobile QA and load testing.

## Legal/customer disclosures
- Have qualified counsel review Terms of Service, Privacy Policy, Acceptable Use Policy, cancellation/refund policy and any DPA.
- Explain the data processed by hosting, Stripe, Resend and any hosted AI provider.
- Disclose subscription price, renewal frequency, taxes, cancellation process and effective date clearly before payment.
- The app configures a 14-day Stripe trial with payment-method collection and attempts a reminder email on Stripe’s trial-will-end event. Test card collection, reminder delivery, automatic first charge, cancellation and data retention end to end before advertising the trial.
- Do not publish placeholder policies or invented contact details.

## Smoke tests after deployment
1. `GET /api/health` returns online and the expected release version.
2. Create a new account, verify email, sign in, sign out and sign back in.
3. Confirm a user cannot access another workspace's records.
4. Create/edit/delete a task, customer and document; refresh and verify persistence.
5. Test AI provider status, assistant response and proposal approve/reject/undo.
6. Test calendar event creation and email draft; send only to a controlled test inbox.
7. Test workspace backup export and restore on a disposable test workspace.
8. Complete Stripe test checkout and verify subscription state only changes after a valid signed webhook.
9. Check logs for secrets, customer data leakage, errors and failed jobs.
