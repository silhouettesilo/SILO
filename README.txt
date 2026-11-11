SILO 1.1 — AI EMPLOYEE UPGRADE
================================

This upgrade adds a local-AI work planner to SILO. The AI Employee can prepare multi-step plans that create or update tasks, complete tasks, create or update customer records, create or update documents, and create or update automation records.

IMPORTANT SAFETY DESIGN
- Planning does not change workspace data.
- Every proposed action is displayed in the AI Employee approval queue.
- Nothing executes until you click Approve & Execute Plan.
- A plan contains at most 8 actions.
- The server validates every action again before executing an approved plan.
- The AI cannot delete records, send emails/messages, make purchases, move money, or perform external actions.
- The regular Assistant remains read-only. Workspace actions happen through the AI Employee approval queue.
- Existing task/customer/document/automation screens and local JSON data remain in place.

INSTALLATION
1. In the Terminal window running SILO, press Control+C to stop the server.
2. Make a backup of your entire SILO folder before replacing anything.
3. Extract this ZIP.
4. Copy the extracted server/server.js over:
   ~/Projects/SILO/server/server.js
5. Copy the extracted public/app.js over:
   ~/Projects/SILO/public/app.js
6. Do NOT replace server/data, package.json, package-lock.json, index.html, or style.css.
7. Make sure the Ollama app is open and the qwen3:1.7b model is installed.
8. In Terminal, run:
   cd ~/Projects/SILO
   npm start
9. Open or refresh http://localhost:3000.

TESTING THE AI EMPLOYEE
1. Open AI Employee in the SILO sidebar.
2. Enter a request such as:
   "Create a high-priority task called Prepare next week's business review, and create a document called Weekly Review Checklist with a short checklist for reviewing tasks, customers, and upcoming deadlines."
3. Click Prepare Work Plan.
4. Review every proposed action in the Approval Queue.
5. Click Approve & Execute Plan.
6. Confirm the new records appear in their respective SILO sections.

OPTIONAL CONNECTION CHECK
Open this URL in your browser:
http://localhost:3000/api/ai/status

Expected result includes connected: true, installed: true, and model: qwen3:1.7b.

CURRENT LIMITATIONS
- The AI Employee supports up to 8 actions per plan.
- Event-based automation triggers are stored as configuration, but the existing automation engine currently executes manual create-task workflows only.
- Authentication and multi-user permissions are not included in this local preview. Do not expose this development server directly to the public internet.
- The included source files passed Node.js syntax checks. The approval workflow was integration-tested with a mocked Ollama response; the final live model behavior must be tested on your Mac.

ROLLBACK
Stop SILO with Control+C and restore server/server.js and public/app.js from your backup. Your server/data files were not changed by this upgrade.
