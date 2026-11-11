# SILO Product Scope — Release Candidate Foundation

## Implemented in the recovered application source
- Account registration, email verification, login, persistent sessions, password recovery and optional authenticator MFA.
- Workspace-scoped tasks, customers, documents, automations, activity, AI proposals and editable Business Memory that is supplied to the AI context.
- Workspace members, invitations, role controls, workspace switching and ownership transfer.
- SILO Executive Director-style AI Assistant with operator-configured Ollama or OpenAI provider and workspace-aware operational context.
- Approval-based AI Employee proposal flow with six specialist role profiles (Executive Assistant, Operations Coordinator, Customer Relations Assistant, Sales Assistant, Marketing Coordinator and Administrative Assistant), rejection, history and guarded undo. These are role profiles within the existing AI planner, not autonomous independent agents.
- Calendar events, recurrence/reminders, email templates, customer email drafts and explicit send action for authorized users.
- Analytics, CSV import/export, industry starter packs, support ticket storage, workspace backup/restore and AI usage ledger.
- Stripe checkout, customer portal and webhook handling scaffolding.
- Public marketing page (`/website.html`) and pricing page (`/pricing.html`).

## Not implemented in this release
- Autonomous AI department directors or a coordinated multi-agent workforce.
- Employee/department marketplace, custom AI employee builder, partner portal or referral commission engine.
- Away Mode, owner-defined autonomy scopes, spending/action caps or an emergency stop across external systems.
- Business financial ledger, bookkeeping, payroll, tax filing, cash-flow forecasting or the monthly owner financial report.
- Multi-business portfolio dashboard, native mobile apps, white-label enterprise deployment or full business transformation services.
- Production-ready legal policies, verified production email delivery, live Stripe configuration or managed cloud AI configuration.

## Launch rule
Only sell and demonstrate capabilities that have passed runtime and provider testing on the actual deployment environment. Keep roadmap capabilities clearly labeled as planned. A source file or UI mockup is not proof of a working production feature.
