const BASE = process.env.SILO_URL || "http://127.0.0.1:3000";

async function check(name, request, validate = () => true) {
  try {
    const response = await fetch(`${BASE}${request}`);
    const data = await response.json().catch(() => null);
    if (!response.ok || !validate(data)) {
      console.log(`FAIL  ${name} (${response.status})`);
      if (data) console.log(`      ${JSON.stringify(data).slice(0, 400)}`);
      return false;
    }
    console.log(`PASS  ${name}`);
    return true;
  } catch (error) {
    console.log(`FAIL  ${name}: ${error.message}`);
    return false;
  }
}

(async () => {
  console.log(`Checking SILO at ${BASE}\n`);
  const results = [];
  results.push(await check("Health endpoint", "/api/health", data => data?.status === "online" && data?.version === "1.2"));
  results.push(await check("Tasks collection", "/api/tasks", Array.isArray));
  results.push(await check("Customers collection", "/api/customers", Array.isArray));
  results.push(await check("Documents collection", "/api/documents", Array.isArray));
  results.push(await check("Automations collection", "/api/automations", Array.isArray));
  results.push(await check("AI status endpoint", "/api/ai/status", data => typeof data?.connected === "boolean"));
  results.push(await check("System diagnostics", "/api/system/diagnostics", data => data?.version === "1.2" && data?.storage));
  results.push(await check("Backup export", "/api/backup/export", data => data?.application === "SILO" && data?.backupVersion === 1 && data?.collections));
  console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed.`);
  if (results.some(ok => !ok)) process.exitCode = 1;
})();
