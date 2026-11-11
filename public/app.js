const API = "/api";
const root = document.getElementById("pageRoot");
const modalRoot = document.getElementById("modalRoot");
const toastRegion = document.getElementById("toastRegion");
const sidebar = document.getElementById("sidebar");

const state = {
  page: "dashboard",
  tasks: [], customers: [], documents: [], automations: [], activity: [], proposals: [],
  settings: {},
  taskFilter: "all",
  taskSearch: "",
  taskSort: "priority",
  customerSearch: "",
  documentSearch: "",
  chat: [{ role: "assistant", text: "Hello! I'm SILO. I can summarize your workspace, help you review tasks, and point you toward useful next steps. What would you like to know?" }],
  settingsTab: "workspace"
};

const PAGE_META = {
  dashboard: ["YOUR INTELLIGENT BUSINESS SYSTEM", "Welcome to ", "SILO.", "Your business, your intelligence, your control. Let's get to work."],
  assistant: ["WORKSPACE INTELLIGENCE", "SILO ", "Assistant.", "A local business companion connected to your workspace data."],
  tasks: ["WORKSPACE MANAGEMENT", "Your ", "Tasks.", "Organize priorities, track deadlines, and keep work moving."],
  automations: ["WORKFLOW MANAGEMENT", "Your ", "Automations.", "Create repeatable workflows for everyday operations."],
  customers: ["RELATIONSHIP MANAGEMENT", "Your ", "Customers.", "Keep customer information and relationship notes organized."],
  analytics: ["BUSINESS INTELLIGENCE", "Workspace ", "Analytics.", "Understand activity and performance across your workspace."],
  documents: ["KNOWLEDGE MANAGEMENT", "Your ", "Documents.", "Create and organize important workspace information."],
  employee: ["AI OPERATIONS", "AI ", "Employee.", "Review proposed work and approve actions before SILO carries them out."],
  settings: ["WORKSPACE CONFIGURATION", "System ", "Settings.", "Configure the identity and preferences of your SILO workspace."]
};

const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const formatDate = value => value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "No date";
const timeAgo = value => {
  if (!value) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(value);
};
const emptyState = (title, detail) => `<div class="empty-state"><strong>${escapeHTML(title)}</strong>${escapeHTML(detail)}</div>`;
const pageHeading = page => {
  const meta = PAGE_META[page];
  return `<div class="page-heading"><div><p class="eyebrow">${meta[0]}</p><h1>${meta[1]}<span>${meta[2]}</span></h1><p class="page-subtitle">${meta[3]}</p></div></div>`;
};

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}
function toast(message, type = "success") {
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  toastRegion.appendChild(item);
  setTimeout(() => item.remove(), 3600);
}
function setBusy(button, busy, label = "Saving...") {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
}
async function refreshData() {
  const names = ["tasks", "customers", "documents", "automations", "activity", "proposals"];
  const results = await Promise.all(names.map(name => api(`/${name}`)));
  names.forEach((name, index) => { state[name] = results[index]; });
  state.settings = await api("/settings");
  updateWorkspaceLabels();
}
function updateWorkspaceLabels() {
  const name = state.settings.workspaceName || "My Workspace";
  ["workspaceName", "accountWorkspace"].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = name;
  });
  const profile = document.getElementById("profileName");
  if (profile) profile.textContent = state.settings.ownerName || "Workspace";
}
function showPage(page) {
  if (!PAGE_META[page]) return;
  state.page = page;
  document.querySelectorAll(".nav-item[data-page]").forEach(button => button.classList.toggle("active", button.dataset.page === page));
  sidebar.classList.remove("open");
  renderPage();
}
function renderPage() {
  const renderer = {
    dashboard: renderDashboard, assistant: renderAssistant, tasks: renderTasks,
    automations: renderAutomations, customers: renderCustomers, analytics: renderAnalytics,
    documents: renderDocuments, employee: renderEmployee, settings: renderSettings
  }[state.page];
  if (renderer) renderer();
}
function statCard(icon, label, value, note) {
  return `<div class="stat-card"><div class="stat-top"><span class="tiny-label">${escapeHTML(label)}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${escapeHTML(note)}</div></div>`;
}
function renderDashboard() {
  const active = state.tasks.filter(t => !t.completed);
  const completed = state.tasks.filter(t => t.completed);
  const urgent = active.filter(t => t.priority === "urgent").length;
  const enabled = state.automations.filter(a => a.enabled).length;
  const recent = state.activity.slice(0, 6);
  const priorityTasks = [...active].sort((a,b) => (PRIORITY_ORDER[a.priority || "normal"] ?? 2) - (PRIORITY_ORDER[b.priority || "normal"] ?? 2)).slice(0,5);
  root.innerHTML = `<div class="page-content">${pageHeading("dashboard")}
    <section class="stat-grid">
      ${statCard("▤", "ACTIVE TASKS", active.length, `${completed.length} completed`)}
      ${statCard("♙", "CUSTOMERS", state.customers.length, "Saved customer records")}
      ${statCard("⟳", "ACTIVE AUTOMATIONS", enabled, `${state.automations.length} total workflows`)}
      ${statCard("!", "URGENT TASKS", urgent, "Require your attention")}
    </section>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-title"><div><h2>Priority Queue</h2><p>Your highest-priority open work</p></div><button class="text-button" data-action="navigate" data-page="tasks">View all tasks →</button></div>
        ${priorityTasks.length ? `<div class="simple-list">${priorityTasks.map(t=>`<div class="simple-list-item"><span class="activity-dot"></span><div style="flex:1;min-width:0"><strong>${escapeHTML(t.title)}</strong><small>${escapeHTML(t.description || "No description")} · ${t.dueDate ? `Due ${formatDate(t.dueDate)}` : "No due date"}</small></div><span class="pill priority-${escapeHTML(t.priority || "normal")}">${escapeHTML(t.priority || "normal")}</span></div>`).join("")}</div>` : emptyState("You're all caught up","Create a task to start building your priority queue.")}
      </section>
      <section class="panel"><div class="panel-title"><div><h2>Quick Actions</h2><p>Move your work forward</p></div></div><div class="quick-actions">
        <button class="quick-action" data-action="new-task"><span>＋</span>Create a task</button>
        <button class="quick-action" data-action="new-customer"><span>♙</span>Add a customer</button>
        <button class="quick-action" data-action="new-document"><span>▧</span>New document</button>
        <button class="quick-action" data-action="navigate" data-page="assistant"><span>✧</span>Ask SILO</button>
      </div></section>
      <section class="panel"><div class="panel-title"><div><h2>Recent Activity</h2><p>Latest changes in your workspace</p></div><span class="tiny-label">LIVE DATA</span></div>
        ${recent.length ? `<div class="activity-list">${recent.map(a=>`<div class="activity-item"><span class="activity-dot"></span><div><strong>${escapeHTML(a.description)}</strong><small>${timeAgo(a.createdAt)}</small></div></div>`).join("")}</div>` : emptyState("No activity yet","Your workspace activity will appear here.")}
      </section>
      <section class="panel"><div class="panel-title"><div><h2>Workspace Snapshot</h2><p>A quick look at your operations</p></div></div>
        <div class="metric-row"><span>Task completion</span><strong>${state.tasks.length ? Math.round(completed.length/state.tasks.length*100) : 0}%</strong></div>
        <div class="bar-track"><div class="bar-fill" style="width:${state.tasks.length ? completed.length/state.tasks.length*100 : 0}%"></div></div>
        <div class="metric-row"><span>Saved documents</span><strong>${state.documents.length}</strong></div>
        <div class="metric-row"><span>Pending AI approvals</span><strong>${state.proposals.filter(p=>p.status==="pending").length}</strong></div>
        <div class="metric-row"><span>Workspace mode</span><strong>Local preview</strong></div>
      </section>
    </div></div>`;
}
function renderTasks() {
  let tasks = [...state.tasks];
  const query = state.taskSearch.toLowerCase();
  if (query) tasks = tasks.filter(t => `${t.title} ${t.description || ""}`.toLowerCase().includes(query));
  if (state.taskFilter === "active") tasks = tasks.filter(t=>!t.completed);
  if (state.taskFilter === "completed") tasks = tasks.filter(t=>t.completed);
  if (state.taskFilter === "urgent") tasks = tasks.filter(t=>t.priority==="urgent" && !t.completed);
  tasks.sort((a,b) => state.taskSort === "priority" ? (PRIORITY_ORDER[a.priority || "normal"]??2)-(PRIORITY_ORDER[b.priority || "normal"]??2) : state.taskSort === "newest" ? new Date(b.createdAt)-new Date(a.createdAt) : state.taskSort === "oldest" ? new Date(a.createdAt)-new Date(b.createdAt) : (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  root.innerHTML = `<div class="page-content">${pageHeading("tasks")}
    <section class="panel">
      <div class="panel-title"><div><h2>Task Manager</h2><p>${state.tasks.filter(t=>!t.completed).length} active · ${state.tasks.filter(t=>t.completed).length} completed</p></div><button class="btn btn-primary" data-action="new-task">＋ New Task</button></div>
      <div class="toolbar"><div class="search-field"><input id="taskSearch" placeholder="Search tasks..." value="${escapeHTML(state.taskSearch)}"></div>
        <div class="filter-tabs">${[["all","All"],["active","Active"],["completed","Completed"],["urgent","Urgent"]].map(([v,l])=>`<button class="filter-tab ${state.taskFilter===v?"active":""}" data-action="task-filter" data-value="${v}">${l}</button>`).join("")}</div>
        <select class="field" id="taskSort" aria-label="Sort tasks"><option value="priority" ${state.taskSort==="priority"?"selected":""}>Sort: Priority</option><option value="due" ${state.taskSort==="due"?"selected":""}>Sort: Due date</option><option value="newest" ${state.taskSort==="newest"?"selected":""}>Sort: Newest</option><option value="oldest" ${state.taskSort==="oldest"?"selected":""}>Sort: Oldest</option></select>
      </div>
      ${tasks.length ? `<div class="task-grid">${tasks.map(taskCard).join("")}</div>` : emptyState("No matching tasks","Try another filter or create a new task.")}</section></div>`;
}
function taskCard(t) {
  const overdue = t.dueDate && !t.completed && new Date(`${t.dueDate}T23:59:59`) < new Date();
  return `<article class="task-card ${t.completed?"is-complete":""}"><div class="task-card-head"><h3>${escapeHTML(t.title)}</h3><span class="pill priority-${escapeHTML(t.priority||"normal")}">${escapeHTML(t.priority||"normal")}</span></div>
    ${t.description?`<p class="task-description">${escapeHTML(t.description)}</p>`:""}
    <div class="task-meta"><span class="pill ${t.completed?"status-completed":""}">${t.completed?"Completed":"Active"}</span>${t.dueDate?`<span class="pill" style="${overdue?"color:var(--red)":""}">${overdue?"Overdue · ":"Due "}${formatDate(t.dueDate)}</span>`:""}</div>
    <div class="task-card-foot"><span class="task-date">Created ${formatDate(t.createdAt)}</span><div class="card-actions"><button class="text-button" data-action="edit-task" data-id="${t.id}">Edit</button><button class="text-button" data-action="toggle-task" data-id="${t.id}" data-completed="${!t.completed}">${t.completed?"Reopen":"Complete"}</button><button class="text-button danger" data-action="delete-task" data-id="${t.id}">Delete</button></div></div></article>`;
}
function renderCustomers() {
  const q = state.customerSearch.toLowerCase();
  const records = state.customers.filter(c=>`${c.name} ${c.company||""} ${c.email||""} ${c.phone||""}`.toLowerCase().includes(q));
  root.innerHTML = `<div class="page-content">${pageHeading("customers")}<section class="panel"><div class="panel-title"><div><h2>Customer Directory</h2><p>${state.customers.length} saved customer records</p></div><button class="btn btn-primary" data-action="new-customer">＋ Add Customer</button></div>
    <div class="toolbar"><div class="search-field"><input id="customerSearch" placeholder="Search name, company, or email..." value="${escapeHTML(state.customerSearch)}"></div></div>
    ${records.length?`<div class="entity-grid">${records.map(c=>`<article class="entity-card"><div class="task-card-head"><div><h3>${escapeHTML(c.name)}</h3><p class="task-description">${escapeHTML(c.company||"Individual customer")}</p></div><span class="pill">${escapeHTML(c.status||"active")}</span></div><div class="task-meta">${c.email?`<span class="pill">${escapeHTML(c.email)}</span>`:""}${c.phone?`<span class="pill">${escapeHTML(c.phone)}</span>`:""}</div>${c.notes?`<p class="task-description">${escapeHTML(c.notes)}</p>`:""}<div class="task-card-foot"><span class="task-date">Added ${formatDate(c.createdAt)}</span><div class="card-actions"><button class="text-button" data-action="edit-customer" data-id="${c.id}">Edit</button><button class="text-button danger" data-action="delete-customer" data-id="${c.id}">Delete</button></div></div></article>`).join("")}</div>`:emptyState("No customers found","Add a customer or adjust your search.")}</section></div>`;
}
function renderDocuments() {
  const q = state.documentSearch.toLowerCase();
  const records = state.documents.filter(d=>`${d.title} ${d.category||""} ${d.content||""}`.toLowerCase().includes(q));
  root.innerHTML = `<div class="page-content">${pageHeading("documents")}<section class="panel"><div class="panel-title"><div><h2>Document Library</h2><p>${state.documents.length} saved documents</p></div><button class="btn btn-primary" data-action="new-document">＋ New Document</button></div>
    <div class="toolbar"><div class="search-field"><input id="documentSearch" placeholder="Search documents..." value="${escapeHTML(state.documentSearch)}"></div></div>
    ${records.length?`<div class="entity-grid">${records.map(d=>`<article class="entity-card"><div class="task-card-head"><h3>▧ ${escapeHTML(d.title)}</h3><span class="pill">${escapeHTML(d.category||"General")}</span></div><p class="task-description">${escapeHTML((d.content||"").slice(0,220))}${(d.content||"").length>220?"…":""}</p><div class="task-card-foot"><span class="task-date">Updated ${formatDate(d.updatedAt||d.createdAt)}</span><div class="card-actions"><button class="text-button" data-action="edit-document" data-id="${d.id}">Open / Edit</button><button class="text-button danger" data-action="delete-document" data-id="${d.id}">Delete</button></div></div></article>`).join("")}</div>`:emptyState("No documents yet","Create a document to start building your workspace knowledge base.")}</section></div>`;
}
function renderAutomations() {
  root.innerHTML = `<div class="page-content">${pageHeading("automations")}<section class="panel"><div class="panel-title"><div><h2>Workflow Builder</h2><p>Local automations that can perform approved internal actions</p></div><button class="btn btn-primary" data-action="new-automation">＋ Create Automation</button></div>
    <div class="form-note">Enabled workflows can run manually or automatically when a task is created or completed. Scheduled schedules and external integrations are not connected yet.</div>
    ${state.automations.length?`<div class="simple-list section-gap">${state.automations.map(a=>`<div class="simple-list-item automation-card"><span class="automation-icon">⟳</span><div class="automation-main"><h3>${escapeHTML(a.name)}</h3><p>${escapeHTML(a.description||"No description")}<br>Trigger: ${escapeHTML(a.trigger||"manual")} · Action: Create task · ${a.lastRunAt?`Last run ${timeAgo(a.lastRunAt)}`:"Never run"}</p><div class="task-meta"><span class="pill">${a.enabled?"Enabled":"Disabled"}</span><span class="pill">${escapeHTML(a.actionValue||"Task title not set")}</span></div></div><div class="card-actions"><button class="text-button" data-action="run-automation" data-id="${a.id}">Run</button><button class="text-button" data-action="toggle-automation" data-id="${a.id}">${a.enabled?"Disable":"Enable"}</button><button class="text-button" data-action="edit-automation" data-id="${a.id}">Edit</button><button class="text-button danger" data-action="delete-automation" data-id="${a.id}">Delete</button></div></div>`).join("")}</div>`:emptyState("No automations configured","Create a workflow to automate a repeatable task.")}</section></div>`;
}
function renderAnalytics() {
  const active = state.tasks.filter(t=>!t.completed).length, done = state.tasks.length-active;
  const priorities = ["urgent","high","normal","low"];
  const max = Math.max(1,...priorities.map(p=>state.tasks.filter(t=>(t.priority||"normal")===p).length));
  const days = Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d;});
  const daily = days.map(d=>state.tasks.filter(t=>{const created=new Date(t.createdAt);return created.toDateString()===d.toDateString();}).length);
  const dailyMax = Math.max(1,...daily);
  root.innerHTML = `<div class="page-content">${pageHeading("analytics")}<section class="stat-grid">${statCard("▤","TOTAL TASKS",state.tasks.length,"All saved tasks")}${statCard("✓","COMPLETED",done,"Finished tasks")}${statCard("♙","CUSTOMERS",state.customers.length,"Customer records")}${statCard("▧","DOCUMENTS",state.documents.length,"Saved documents")}</section>
    <div class="dashboard-grid"><section class="panel"><div class="panel-title"><div><h2>Task Completion</h2><p>Current task status distribution</p></div></div><div class="metric-row"><span>Completed</span><strong>${done}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${state.tasks.length?done/state.tasks.length*100:0}%"></div></div><div class="metric-row"><span>Active</span><strong>${active}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${state.tasks.length?active/state.tasks.length*100:0}%"></div></div><div class="metric-row"><span>Completion rate</span><strong>${state.tasks.length?Math.round(done/state.tasks.length*100):0}%</strong></div></section>
    <section class="panel"><div class="panel-title"><div><h2>Priority Distribution</h2><p>All tasks by assigned priority</p></div></div>${priorities.map(p=>`<div class="metric-row"><span>${p[0].toUpperCase()+p.slice(1)}</span><strong>${state.tasks.filter(t=>(t.priority||"normal")===p).length}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${state.tasks.filter(t=>(t.priority||"normal")===p).length/max*100}%"></div></div>`).join("")}</section>
    <section class="panel"><div class="panel-title"><div><h2>Task Creation</h2><p>Tasks created over the last seven days</p></div></div><div class="chart-bars">${daily.map((n,i)=>`<div class="chart-column"><i style="height:${Math.max(3,n/dailyMax*100)}%"></i><small>${days[i].toLocaleDateString(undefined,{weekday:"short"})}</small></div>`).join("")}</div></section>
    <section class="panel"><div class="panel-title"><div><h2>Workspace Inventory</h2><p>Records currently stored locally</p></div></div>${[["Customers",state.customers.length],["Documents",state.documents.length],["Automations",state.automations.length],["Pending approvals",state.proposals.filter(p=>p.status==="pending").length]].map(([l,n])=>`<div class="metric-row"><span>${l}</span><strong>${n}</strong></div>`).join("")}</section></div></div>`;
}
function renderAssistant() {
  root.innerHTML = `<div class="page-content">${pageHeading("assistant")}<section class="panel chat-panel"><div class="panel-title"><div><h2>✧ SILO Assistant</h2><p id="aiConnectionLabel">Checking local Ollama connection...</p></div><span class="pill status-completed" id="aiConnectionBadge">LOCAL AI</span></div>
    <div class="chat-history" id="chatHistory">${state.chat.map(m=>`<div class="chat-bubble ${m.role}">${escapeHTML(m.text)}</div>`).join("")}</div>
    <form class="chat-composer" id="chatForm"><input class="field" id="chatInput" maxlength="2000" placeholder="Ask SILO about your business or workspace..." required><button class="btn btn-primary" type="submit">Send ↑</button></form>
    <p class="form-note">Powered by Qwen3 1.7B through Ollama. Your workspace context and conversations are processed locally on this Mac. SILO's assistant is read-only; workspace changes still require your approval.</p>
    </section></div>`;
  const history = document.getElementById("chatHistory");
  history.scrollTop = history.scrollHeight;
  api("/ai/status").then(status => {
    const label = document.getElementById("aiConnectionLabel");
    const badge = document.getElementById("aiConnectionBadge");
    if (!label || !badge) return;
    label.textContent = status.connected && status.installed
      ? `Connected · ${status.model} · Running locally`
      : status.message || "Local AI is unavailable.";
    badge.textContent = status.connected && status.installed ? "AI ONLINE" : "AI OFFLINE";
    badge.classList.toggle("status-completed", Boolean(status.connected && status.installed));
  }).catch(() => {});
}
function employeeActionLabel(action) {
  const labels = {
    create_task: "Create task", update_task: "Update task", complete_task: "Complete task",
    create_customer: "Create customer", update_customer: "Update customer",
    create_document: "Create document", update_document: "Update document",
    create_automation: "Create automation", update_automation: "Update automation"
  };
  return labels[action.type] || "Workspace action";
}
function employeeActionDetail(action) {
  const d = action.data || {};
  const collection = action.type.includes("task") ? "tasks" : action.type.includes("customer") ? "customers" : action.type.includes("document") ? "documents" : "automations";
  const existing = d.id ? findById(collection, d.id) : null;
  const target = d.title || d.name || existing?.title || existing?.name || (d.id ? "Existing record" : "New record");
  const details = action.type === "complete_task" ? `Mark “${target}” as completed`
    : action.type.startsWith("create_") ? `Add “${target}”`
    : `Change “${target}”`;
  return `${details}${action.reason ? ` — ${action.reason}` : ""}`;
}
function renderEmployee() {
  const pending = state.proposals.filter(p=>p.status==="pending");
  const reviewed = state.proposals.filter(p=>p.status!=="pending").slice(0,8);
  const actionCount = pending.reduce((sum,p)=>sum+(Array.isArray(p.actions)?p.actions.length:1),0);
  root.innerHTML = `<div class="page-content">${pageHeading("employee")}<section class="panel"><div class="panel-title"><div><h2>AI Employee Control Center</h2><p>Describe the work. SILO will plan it, show every proposed change, and wait for your approval.</p></div><span class="pill priority-high">HUMAN APPROVAL</span></div>
    <div class="dashboard-grid"><div><h2>Give SILO a job</h2><p class="form-note">The AI Employee can prepare multi-step changes to tasks, customers, documents, and automations. Nothing changes until you approve the complete plan.</p>
      <form id="employeePlanForm" class="section-gap"><div class="form-field"><label for="employeeRequest">What would you like SILO to do?</label><textarea class="field" id="employeeRequest" maxlength="2000" rows="5" placeholder="Example: Review my active tasks, mark finished work complete, and create follow-up tasks for anything urgent." required></textarea></div><div class="form-actions"><button class="btn btn-primary" type="submit">✧ Prepare Work Plan</button></div></form>
      <p class="form-note">SILO can create and update internal records. Deletions, external messages, purchases, payments, and other external actions are not available to the AI Employee.</p>
    </div><div><h2>Employee Safety</h2><div class="metric-row"><span>Workspace changes</span><strong>Approval required</strong></div><div class="metric-row"><span>Multi-step plans</span><strong>Up to 8 actions</strong></div><div class="metric-row"><span>External actions</span><strong>Disabled</strong></div><div class="metric-row"><span>Pending plans</span><strong>${pending.length}</strong></div><div class="metric-row"><span>Actions awaiting review</span><strong>${actionCount}</strong></div></div></div></section>
    <section class="panel section-gap"><div class="panel-title"><div><h2>Approval Queue</h2><p>Review the full plan before allowing SILO to make changes.</p></div><span class="pill">${pending.length} PENDING</span></div>
      ${pending.length?pending.map(p=>`<div class="approval-card"><div class="task-card-head"><strong>${escapeHTML(p.title)}</strong><span class="pill priority-${escapeHTML(p.priority||"normal")}">${Array.isArray(p.actions)?`${p.actions.length} ACTION${p.actions.length===1?"":"S"}`:escapeHTML(p.priority||"normal")}</span></div><p>${escapeHTML(p.description||"No additional details")}</p>${Array.isArray(p.actions)?`<div class="section-gap">${p.actions.map((a,i)=>`<div class="metric-row"><span><strong>${i+1}. ${escapeHTML(employeeActionLabel(a))}</strong><br><small>${escapeHTML(employeeActionDetail(a))}</small></span></div>`).join("")}</div>`:`<p>${escapeHTML(p.description||"")}</p>`}<small class="muted">Prepared ${timeAgo(p.createdAt)} · No changes have been made yet</small><div class="approval-actions"><button class="btn btn-primary btn-small" data-action="approve-proposal" data-id="${p.id}">Approve & Execute Plan</button><button class="btn btn-small btn-danger" data-action="reject-proposal" data-id="${p.id}">Reject</button></div></div>`).join(""):emptyState("No pending plans","Give SILO a job to prepare your first AI Employee work plan.")}</section>
    ${reviewed.length?`<section class="panel section-gap"><div class="panel-title"><div><h2>Recently Reviewed</h2><p>Previously approved or rejected plans.</p></div></div>${reviewed.map(p=>`<div class="metric-row"><span>${escapeHTML(p.title)}<br><small>${Array.isArray(p.executionResults)?`${p.executionResults.length} action(s) executed`:p.executionError?escapeHTML(p.executionError):""}</small></span><span class="pill ${p.status==="approved"?"status-completed":""}">${escapeHTML(p.status)}</span>${Array.isArray(p.executionResults)?`<button class="text-button" data-action="view-proposal-results" data-id="${p.id}">View report</button>`:""}</div>`).join("")}</section>`:""}</div>`;
}

function renderSettings() {
  const s = state.settings;
  const tabs = [["workspace","Workspace"],["preferences","Preferences"],["system","System & Data"]];
  root.innerHTML = `<div class="page-content">${pageHeading("settings")}<div class="settings-layout"><section class="panel settings-nav">${tabs.map(([id,label])=>`<button class="${state.settingsTab===id?"active":""}" data-action="settings-tab" data-value="${id}">${label}</button>`).join("")}</section><section class="panel">
    ${state.settingsTab==="workspace"?`<div class="panel-title"><div><h2>Workspace Identity</h2><p>These details personalize your SILO workspace.</p></div></div><form id="settingsForm"><div class="form-grid"><div class="form-field"><label for="settingWorkspace">Workspace name</label><input class="field" id="settingWorkspace" maxlength="100" value="${escapeHTML(s.workspaceName||"")} " required></div><div class="form-field"><label for="settingOwner">Owner / display name</label><input class="field" id="settingOwner" maxlength="100" value="${escapeHTML(s.ownerName||"")}"></div><div class="form-field"><label for="settingIndustry">Industry</label><input class="field" id="settingIndustry" maxlength="100" value="${escapeHTML(s.industry||"")}" placeholder="e.g. Hospitality, Retail, Consulting"></div><div class="form-field"><label for="settingTimezone">Timezone</label><input class="field" id="settingTimezone" maxlength="100" value="${escapeHTML(s.timezone||"")}"></div><div class="form-field full"><label for="settingDescription">Business description</label><textarea class="field" id="settingDescription" maxlength="1000">${escapeHTML(s.description||"")}</textarea></div></div><div class="form-actions"><button class="btn btn-primary" type="submit">Save Workspace</button></div></form>`:
    state.settingsTab==="preferences"?`<div class="panel-title"><div><h2>Preferences</h2><p>Control local workspace behavior.</p></div></div><div class="setting-row"><div><strong>Activity notifications</strong><small>Show in-app feedback for workspace activity.</small></div><input class="switch" type="checkbox" id="settingNotifications" ${s.notifications!==false?"checked":""}></div><div class="setting-row"><div><strong>Compact interface</strong><small>Reserved preference for a denser workspace layout.</small></div><input class="switch" type="checkbox" id="settingCompact" ${s.compactMode?"checked":""}></div><p class="form-note">Preferences are stored locally in your SILO data folder.</p>`:
    `<div class="panel-title"><div><h2>System & Data</h2><p>Information about this local installation.</p></div></div><div class="setting-row"><div><strong>Application version</strong><small>SILO Intelligent Business Management</small></div><strong>1.2</strong></div><div class="setting-row"><div><strong>Storage mode</strong><small>Local JSON files in server/data</small></div><strong>Local</strong></div><div class="setting-row"><div><strong>AI connection</strong><small>Local model served by Ollama on this Mac.</small></div><strong>Qwen3 1.7B</strong></div><div class="setting-row"><div><strong>Authentication</strong><small>This local preview does not have user accounts.</small></div><strong>Not enabled</strong></div><div class="section-gap"><h3>Workspace Backups</h3><p class="form-note">Export a complete copy of your tasks, customers, documents, automations, activity, approvals, and settings. Store backup files somewhere separate from this Mac.</p><div class="form-actions"><a class="btn btn-primary" href="/api/backup/export">↓ Export Full Backup</a><label class="btn" for="restoreBackupFile">Restore Backup</label><input id="restoreBackupFile" type="file" accept="application/json,.json" hidden></div></div><div class="section-gap"><h3>System Diagnostics</h3><p class="form-note">Check local storage health, application version, and Ollama connectivity.</p><button class="btn" type="button" data-action="system-diagnostics">Run Diagnostics</button></div><div class="form-note section-gap">SILO is still a local-first preview. Before public deployment, it needs user authentication, authorization, database migrations, encrypted backup strategy, rate limiting, and a production security review. The local server now binds to this Mac only by default; do not expose it directly to the internet.</div>`}
  </section></div></div>`;
}
function openModal(title, subtitle, body) {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}"><div class="modal-header"><div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(subtitle||"")}</p></div><button class="modal-close" data-action="close-modal" aria-label="Close">×</button></div>${body}</section></div>`;
  modalRoot.querySelector(".modal-backdrop").addEventListener("click", e=>{if(e.target===e.currentTarget)closeModal();});
}
function closeModal(){modalRoot.replaceChildren();}
function formField(label,id,value="",type="text",full=false,placeholder="") {
  return `<div class="form-field ${full?"full":""}"><label for="${id}">${label}</label>${type==="textarea"?`<textarea class="field" id="${id}" placeholder="${escapeHTML(placeholder)}" maxlength="20000">${escapeHTML(value)}</textarea>`:`<input class="field" id="${id}" type="${type}" id="${id}" value="${escapeHTML(value)}" placeholder="${escapeHTML(placeholder)}" ${type==="date"?"":""}>`}</div>`;
}
function openTaskModal(task=null) {
  const t=task||{};
  openModal(task?"Edit Task":"Create a Task", "Keep the details and priority of this work up to date.", `<form id="taskModalForm"><div class="form-grid">
    ${formField("Task title","modalTaskTitle",t.title||"","text",true,"What needs to get done?")}
    ${formField("Description","modalTaskDescription",t.description||"","textarea",true,"Add useful context...")}
    <div class="form-field"><label for="modalTaskPriority">Priority</label><select class="field" id="modalTaskPriority">${["low","normal","high","urgent"].map(p=>`<option value="${p}" ${(t.priority||"normal")===p?"selected":""}>${p[0].toUpperCase()+p.slice(1)}</option>`).join("")}</select></div>
    <div class="form-field"><label for="modalTaskDue">Due date</label><input class="field" id="modalTaskDue" type="date" value="${escapeHTML(t.dueDate||"")}"></div>
    </div><div class="form-actions"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${task?"Save Changes":"Create Task"}</button></div></form>`);
  document.getElementById("taskModalForm").addEventListener("submit", async e=>{
    e.preventDefault(); const button=e.submitter; setBusy(button,true);
    try {
      const payload={title:document.getElementById("modalTaskTitle").value,description:document.getElementById("modalTaskDescription").value,priority:document.getElementById("modalTaskPriority").value,dueDate:document.getElementById("modalTaskDue").value};
      await api(task?`/tasks/${task.id}`:"/tasks",{method:task?"PATCH":"POST",body:JSON.stringify(payload)});
      closeModal(); await refreshData(); renderPage(); toast(task?"Task updated.":"Task created.");
    } catch(err){toast(err.message,"error");setBusy(button,false);}
  });
}
function openCustomerModal(customer=null) {
  const c=customer||{};
  openModal(customer?"Edit Customer":"Add Customer","Save contact details and relationship notes.",`<form id="customerForm"><div class="form-grid">
    ${formField("Customer name","customerName",c.name||"","text",true,"Full name or contact name")}
    ${formField("Company","customerCompany",c.company||"")}
    ${formField("Email","customerEmail",c.email||"","email")}
    ${formField("Phone","customerPhone",c.phone||"","tel")}
    <div class="form-field"><label for="customerStatus">Status</label><select class="field" id="customerStatus">${["active","prospect","inactive"].map(s=>`<option ${((c.status||"active")===s)?"selected":""}>${s}</option>`).join("")}</select></div>
    ${formField("Notes","customerNotes",c.notes||"","textarea",true,"Interaction history, preferences, or useful context...")}
    </div><div class="form-actions"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Save Customer</button></div></form>`);
  document.getElementById("customerForm").addEventListener("submit",async e=>{
    e.preventDefault();const button=e.submitter;setBusy(button,true);
    try{const payload={name:document.getElementById("customerName").value,company:document.getElementById("customerCompany").value,email:document.getElementById("customerEmail").value,phone:document.getElementById("customerPhone").value,status:document.getElementById("customerStatus").value,notes:document.getElementById("customerNotes").value};
      await api(customer?`/customers/${customer.id}`:"/customers",{method:customer?"PATCH":"POST",body:JSON.stringify(payload)});
      closeModal();await refreshData();renderPage();toast(customer?"Customer updated.":"Customer added.");
    }catch(err){toast(err.message,"error");setBusy(button,false);}
  });
}
function openDocumentModal(doc=null) {
  const d=doc||{};
  openModal(doc?"Edit Document":"Create Document","Write and save useful information in your workspace.",`<form id="documentForm"><div class="form-grid">
    ${formField("Document title","documentTitle",d.title||"","text",true,"Document title")}
    ${formField("Category","documentCategory",d.category||"General")}
    ${formField("Content","documentContent",d.content||"","textarea",true,"Start writing...")}
    </div><div class="form-actions"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Save Document</button></div></form>`);
  document.getElementById("documentForm").addEventListener("submit",async e=>{
    e.preventDefault();const button=e.submitter;setBusy(button,true);
    try{const payload={title:document.getElementById("documentTitle").value,category:document.getElementById("documentCategory").value,content:document.getElementById("documentContent").value};
      await api(doc?`/documents/${doc.id}`:"/documents",{method:doc?"PATCH":"POST",body:JSON.stringify(payload)});
      closeModal();await refreshData();renderPage();toast(doc?"Document updated.":"Document saved.");
    }catch(err){toast(err.message,"error");setBusy(button,false);}
  });
}
function openAutomationModal(automation=null) {
  const a=automation||{};
  openModal(automation?"Edit Automation":"Create Automation","Configure a local workflow that can create a task manually or in response to a task event.",`<form id="automationForm"><div class="form-grid">
    ${formField("Automation name","automationName",a.name||"","text",true,"e.g. Create weekly follow-up task")}
    ${formField("Description","automationDescription",a.description||"","textarea",true,"What is this workflow for?")}
    <div class="form-field"><label for="automationTrigger">Trigger</label><select class="field" id="automationTrigger">${[["manual","Manual run"],["task_created","When a task is created"],["task_completed","When a task is completed"]].map(([v,l])=>`<option value="${v}" ${(a.trigger||"manual")===v?"selected":""}>${l}</option>`).join("")}</select></div>
    <div class="form-field"><label for="automationAction">Action</label><select class="field" id="automationAction"><option value="create_task">Create a task</option></select></div>
    ${formField("New task title","automationValue",a.actionValue||"","text",true,"Title for the task this workflow creates")}
    </div><div class="form-actions"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Save Automation</button></div><p class="form-note">Manual runs and task-created / task-completed triggers are active. Scheduled time-based workflows and external integrations are not available yet.</p></form>`);
  document.getElementById("automationForm").addEventListener("submit",async e=>{
    e.preventDefault();const button=e.submitter;setBusy(button,true);
    try{const payload={name:document.getElementById("automationName").value,description:document.getElementById("automationDescription").value,trigger:document.getElementById("automationTrigger").value,action:document.getElementById("automationAction").value,actionValue:document.getElementById("automationValue").value};
      await api(automation?`/automations/${automation.id}`:"/automations",{method:automation?"PATCH":"POST",body:JSON.stringify(payload)});
      closeModal();await refreshData();renderPage();toast(automation?"Automation updated.":"Automation created.");
    }catch(err){toast(err.message,"error");setBusy(button,false);}
  });
}
function findById(collection,id){return state[collection].find(item=>item.id===id);}
async function removeRecord(collection,id,label) {
  if(!confirm(`Delete this ${label}? This cannot be undone.`))return;
  try{await api(`/${collection}/${id}`,{method:"DELETE"});await refreshData();renderPage();toast(`${label[0].toUpperCase()+label.slice(1)} deleted.`);}
  catch(err){toast(err.message,"error");}
}
async function sendChat(message) {
  const previousHistory = state.chat
    .filter(item => item.role === "user" || item.role === "assistant")
    .slice(-8)
    .map(item => ({ role: item.role, content: item.text }))
    .filter(item => item.content && item.content !== "Thinking...");
  state.chat.push({role:"user",text:message});
  state.chat.push({role:"assistant",text:"Thinking..."});
  renderAssistant();
  try {
    const result = await api("/assistant", {
      method: "POST",
      body: JSON.stringify({ message, history: previousHistory })
    });
    state.chat[state.chat.length-1].text = result.response;
  } catch(err) {
    state.chat[state.chat.length-1].text = `I couldn't reach the local AI: ${err.message}`;
  }
  renderAssistant();
}
async function handleAction(button) {
  const action=button.dataset.action,id=button.dataset.id;
  try {
    if(action==="navigate")return showPage(button.dataset.page);
    if(action==="new-task")return openTaskModal();
    if(action==="new-customer")return openCustomerModal();
    if(action==="new-document")return openDocumentModal();
    if(action==="new-automation")return openAutomationModal();
    if(action==="close-modal")return closeModal();
    if(action==="edit-task")return openTaskModal(findById("tasks",id));
    if(action==="edit-customer")return openCustomerModal(findById("customers",id));
    if(action==="edit-document")return openDocumentModal(findById("documents",id));
    if(action==="edit-automation")return openAutomationModal(findById("automations",id));
    if(action==="delete-task")return removeRecord("tasks",id,"task");
    if(action==="delete-customer")return removeRecord("customers",id,"customer");
    if(action==="delete-document")return removeRecord("documents",id,"document");
    if(action==="delete-automation")return removeRecord("automations",id,"automation");
    if(action==="toggle-task") {
      await api(`/tasks/${id}`,{method:"PATCH",body:JSON.stringify({completed:button.dataset.completed==="true"})});
      await refreshData();renderPage();toast("Task status updated.");return;
    }
    if(action==="task-filter"){state.taskFilter=button.dataset.value;renderTasks();return;}
    if(action==="run-automation"){
      const result=await api(`/automations/${id}/run`,{method:"POST",body:"{}"});
      await refreshData();renderPage();toast(`Automation ran. Created: ${result.task.title}`);return;
    }
    if(action==="toggle-automation"){
      const a=findById("automations",id);await api(`/automations/${id}`,{method:"PATCH",body:JSON.stringify({enabled:!a.enabled})});
      await refreshData();renderPage();toast(`Automation ${a.enabled?"disabled":"enabled"}.`);return;
    }
    if(action==="settings-tab"){state.settingsTab=button.dataset.value;renderSettings();return;}
    if(action==="view-proposal-results"){
      const proposal=findById("proposals",id);
      if(!proposal)return;
      const rows=(proposal.executionResults||[]).map((item,index)=>`<div class="metric-row"><span><strong>${index+1}. ${escapeHTML(item.type.replaceAll("_"," "))}</strong><br><small>${escapeHTML(item.label||item.taskTitle||item.automationName||item.id||"Completed")}</small></span><span class="pill status-completed">Success</span></div>`).join("");
      openModal("Execution Report",`Completed ${formatDate(proposal.reviewedAt)} · ${proposal.executionResults?.length||0} action(s)`,rows||emptyState("No execution details","No action results were recorded."));return;
    }
    if(action==="system-diagnostics"){
      const result=await api("/system/diagnostics");
      const rows=Object.entries(result.storage||{}).map(([name,item])=>`<div class="metric-row"><span>${escapeHTML(name)}</span><strong>${item.readable?`${item.records} records`:`Error: ${escapeHTML(item.error)}`}</strong></div>`).join("");
      openModal("System Diagnostics",`SILO ${escapeHTML(result.version)} · ${escapeHTML(result.node)} · ${escapeHTML(result.platform)}`,`<div class="metric-row"><span>Local AI</span><strong>${result.ai?.connected?(result.ai.installed?"Connected · Model installed":"Connected · Model missing"):"Not connected"}</strong></div>${rows}<p class="form-note">Diagnostics checked ${formatDate(result.timestamp)}.</p>`);return;
    }
    if(action==="approve-proposal"){
      const result=await api(`/proposals/${id}/approve`,{method:"POST",body:"{}"});
      await refreshData();renderPage();
      toast(`Approved. SILO executed ${result.results?.length || 1} action(s).`);return;
    }
    if(action==="reject-proposal"){
      await api(`/proposals/${id}/reject`,{method:"POST",body:"{}"});
      await refreshData();renderPage();toast("Proposal rejected.");return;
    }
  } catch(err){toast(err.message,"error");}
}

document.addEventListener("click",event=>{
  const nav=event.target.closest("[data-page]");
  if(nav){event.preventDefault();showPage(nav.dataset.page);return;}
  const actionButton=event.target.closest("[data-action]");
  if(actionButton){if(actionButton.dataset.action==="backdrop-close")return;handleAction(actionButton);}
});
document.addEventListener("input",event=>{
  if(event.target.id==="taskSearch"){state.taskSearch=event.target.value;const pos=event.target.selectionStart;renderTasks();const input=document.getElementById("taskSearch");input.focus();input.setSelectionRange(pos,pos);}
  if(event.target.id==="customerSearch"){state.customerSearch=event.target.value;const pos=event.target.selectionStart;renderCustomers();const input=document.getElementById("customerSearch");input.focus();input.setSelectionRange(pos,pos);}
  if(event.target.id==="documentSearch"){state.documentSearch=event.target.value;const pos=event.target.selectionStart;renderDocuments();const input=document.getElementById("documentSearch");input.focus();input.setSelectionRange(pos,pos);}
});
document.addEventListener("change",event=>{
  if(event.target.id==="taskSort"){state.taskSort=event.target.value;renderTasks();}
  if(event.target.id==="settingNotifications"||event.target.id==="settingCompact"){
    const payload=event.target.id==="settingNotifications"?{notifications:event.target.checked}:{compactMode:event.target.checked};
    api("/settings",{method:"PATCH",body:JSON.stringify(payload)}).then(async()=>{await refreshData();toast("Preference saved.");}).catch(err=>toast(err.message,"error"));
  }
});
document.addEventListener("submit",async event=>{
  if(event.target.id==="chatForm"){event.preventDefault();const input=document.getElementById("chatInput");const message=input.value.trim();if(message)sendChat(message);}
  if(event.target.id==="employeePlanForm"){
    event.preventDefault();const button=event.submitter;const message=document.getElementById("employeeRequest").value.trim();if(!message)return;setBusy(button,true,"Planning...");
    try{
      const result=await api("/employee/plan",{method:"POST",body:JSON.stringify({message})});
      if(!result.created){toast(result.summary||"SILO needs more information before it can prepare this plan.","error");setBusy(button,false);return;}
      await refreshData();renderEmployee();toast(`SILO prepared a plan with ${result.proposal.actions.length} action(s). Review it below.`);
    }catch(err){toast(err.message,"error");setBusy(button,false);}
  }
  if(event.target.id==="proposalForm"){
    event.preventDefault();const button=event.submitter;setBusy(button,true);
    try{await api("/proposals",{method:"POST",body:JSON.stringify({title:document.getElementById("proposalTitle").value,description:document.getElementById("proposalDescription").value,priority:document.getElementById("proposalPriority").value})});
      await refreshData();renderEmployee();toast("Proposal submitted for your approval.");
    }catch(err){toast(err.message,"error");setBusy(button,false);}
  }
  if(event.target.id==="settingsForm"){
    event.preventDefault();const button=event.submitter;setBusy(button,true);
    try{await api("/settings",{method:"PATCH",body:JSON.stringify({workspaceName:document.getElementById("settingWorkspace").value.trim(),ownerName:document.getElementById("settingOwner").value,industry:document.getElementById("settingIndustry").value,timezone:document.getElementById("settingTimezone").value,description:document.getElementById("settingDescription").value})});
      await refreshData();renderSettings();toast("Workspace settings saved.");
    }catch(err){toast(err.message,"error");setBusy(button,false);}
  }
});
document.addEventListener("change",async event=>{
  if(event.target.id!=="restoreBackupFile")return;
  const file=event.target.files?.[0];
  if(!file)return;
  try{
    const backup=JSON.parse(await file.text());
    if(!confirm("Restoring this backup will replace the current SILO workspace data. Export a backup of the current workspace first if you may need it. Continue?"))return;
    const result=await api("/backup/restore",{method:"POST",body:JSON.stringify({backup})});
    await refreshData();renderSettings();
    toast(`Backup restored. ${Object.values(result.counts).reduce((sum,n)=>sum+n,0)} records loaded.`);
  }catch(error){toast(`Backup restore failed: ${error.message}`,"error");}
  finally{event.target.value="";}
});

document.getElementById("mobileMenu").addEventListener("click",()=>sidebar.classList.toggle("open"));
document.getElementById("notificationButton").addEventListener("click",()=>{
  const recent=state.activity.slice(0,12);
  openModal("Workspace Activity","Recent events recorded by SILO.",`<div class="notification-list">${recent.length?recent.map(a=>`<div class="activity-item"><span class="activity-dot"></span><div><strong>${escapeHTML(a.description)}</strong><small>${formatDate(a.createdAt)} · ${timeAgo(a.createdAt)}</small></div></div>`).join(""):emptyState("No activity yet","Workspace events will appear here.")}</div>`);
});

async function initialize() {
  document.getElementById("todayLabel").textContent = new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
  try {
    const health=await api("/health");
    document.getElementById("systemStatus").textContent=`SYSTEM ${health.status.toUpperCase()}`;
    await refreshData();
    renderDashboard();
    console.log("SILO 1.2 initialized.");
  } catch(error) {
    document.getElementById("systemStatus").textContent="SERVER CONNECTION ERROR";
    root.innerHTML=`<div class="page-content">${pageHeading("dashboard")}<div class="panel">${emptyState("SILO could not connect to its server",`${error.message} Make sure the server is running with npm start, then refresh this page.`)}<button class="btn btn-primary section-gap" id="retryConnection">Retry Connection</button></div></div>`;
    document.getElementById("retryConnection").addEventListener("click",initialize);
  }
}
initialize();
