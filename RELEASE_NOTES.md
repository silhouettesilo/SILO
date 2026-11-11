# SILO 3.0 Recovery 12 — Release Notes

This package consolidates the recovered SILO 3.0 development foundation with a public-facing marketing homepage, agreed pricing, registration entry fixes, Business Memory, specialist AI Employee role profiles, sales materials and launch/operator documentation.

## Included
- Existing Express + SQLite application source and recovered account, workspace, collaboration, data and AI workflows.
- Public marketing homepage at `/` for signed-out visitors (also available at `/website.html`).
- Authenticated app entry at `/?login=1`, registration at `/?register=1`, and existing verification/reset/billing callback query handling.
- Pricing at `/pricing.html`: Starter $19/month, Pro $49/month, Business custom; one subscription per business workspace, no per-employee billing.
- Stripe checkout source with payment-method collection, 14-day trial and trial-ending reminder email attempt through Resend. Provider lifecycle remains untested.
- Workspace-specific Business Memory with owner/admin create, edit and delete controls, AI context integration and backup v4 support.
- Six specialist AI Employee role profiles within the existing approval-based proposal planner.
- Sales kit, demo outline, outreach email, product scope and production operator checklists.
- Mac installation guide in `MAC_SETUP.md`.

## Not a production-sale certification
The application has not passed full dependency installation, native SQLite runtime, API integration, browser/mobile, Stripe, Resend, security penetration, accessibility, load or restore-drill testing in this environment. The package's own `BUILD_STATUS.txt` lists these limitations.

Do not describe the current role profiles as autonomous independent agents. The autonomous multi-department workforce, employee/department marketplace, partner portal, financial command center, referral commission engine, mobile apps and other long-term roadmap capabilities are not implemented in this release.
