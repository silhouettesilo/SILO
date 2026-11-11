# SILO commercial release — legal and operator checklist

This checklist is intentionally not a substitute for legal advice. Do not publish placeholder legal text as final policy.

## Business identity and customer-facing policies
- [ ] Confirm the legal business/entity name, business address, and governing jurisdiction.
- [ ] Set the support and privacy contact email addresses.
- [ ] Have counsel review and finalize Terms of Service, Privacy Policy, Acceptable Use Policy, and Cancellation/Refund Policy.
- [ ] Decide and disclose subscription renewal, cancellation timing, refund handling, taxes, trials, and plan changes; configure Stripe to match those policies.
- [ ] Decide data retention periods for accounts, deleted workspaces, support tickets, sent email history, and backups.
- [ ] Review whether a Data Processing Agreement and regional privacy notices are required for intended customers.
- [ ] Disclose subprocessors and data flows, including hosting, Stripe, Resend, and the selected hosted AI provider.

## Operator configuration
- [ ] Configure HTTPS domain, reverse proxy, monitoring, backups, and restore testing.
- [ ] Configure Resend sender-domain authentication and test verification, password reset, email change, invitations, reminders, and customer email delivery.
- [ ] Configure Stripe products/prices, webhook endpoint, portal, tax settings, and test the complete subscription lifecycle.
- [ ] Configure hosted AI provider, model limits, current token rates, budget alerts, and fallback behavior.
- [ ] Generate unique production SESSION_SECRET and MFA_ENCRYPTION_KEY values and store them in a secret manager.
- [ ] Confirm a support process and response expectations.

## Verification before public sale
- [ ] Run the complete automated test suite on the deployment runtime.
- [ ] Complete security review and penetration testing.
- [ ] Complete mobile, supported-browser, accessibility, and load testing.
- [ ] Test account recovery, MFA recovery, workspace isolation, role permissions, backups, and account deletion.
- [ ] Confirm all legal and privacy policy pages are live and accurate.
