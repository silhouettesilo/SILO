# SILO — Mac Setup

Tested target: macOS on Apple Silicon, Node.js 20 or newer. Node.js 24 is supported by the declared engine range; native SQLite installation still needs to complete successfully on the target Mac.

## Before replacing an existing SILO folder
1. Stop the running SILO server.
2. Make a separate copy of your current project folder.
3. Preserve your current `.env` and the full `server/data/` folder. The recovery ZIP intentionally does not contain customer data or live secrets.
4. Extract this ZIP to a new folder first. Do not overwrite your existing project until you have compared it and backed up its data.

## Install and run
Open Terminal in the extracted `SILO` folder:

```bash
npm install
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 32
```

Put the first generated value in `.env` as `SESSION_SECRET` and the second as `MFA_ENCRYPTION_KEY`. Keep both private and different. If you already have production data, preserve the existing stable values instead of generating replacements.

For local Ollama, make sure Ollama is running and that the configured model is installed. The default is `qwen3:1.7b`; change `OLLAMA_MODEL` in `.env` if you use a different model. Then run:

```bash
npm test
npm start
```

Open `http://localhost:3000`. The public website is shown when signed out; the app opens after sign-in. Use `/?register=1` to open registration and `/?login=1` to open sign-in directly.

## Important
- If `npm install` fails while building `better-sqlite3`, do not deploy. Resolve the native build issue first.
- The first account uses a one-time setup key printed in the server terminal unless `SILO_SETUP_KEY` is configured.
- Email verification and recovery delivery require Resend configuration. In development, verification links are printed in the server terminal.
- Stripe checkout requires test-mode keys, monthly Starter/Pro Price IDs, webhook signing secret and portal configuration. Do not enter live keys until the full test lifecycle passes.
- Ollama running on this Mac serves this Mac only; remote customers need a hosted AI provider or hosted Ollama deployment.
- Do not use the local development server as a public production deployment.
