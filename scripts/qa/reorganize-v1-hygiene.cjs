const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}
function moveFile(src, dest) {
  try {
    if (!fs.existsSync(src)) return false;
    ensureDir(path.dirname(dest));
    fs.renameSync(src, dest);
    return true;
  } catch (e) {
    console.warn("Could not rename", src, "->", e.message);
    return false;
  }
}

console.log("1. Moving stray root files...");
["all_messages.txt", "sidebar.txt", "waspeed_raw_dump.txt"].forEach((f) => {
  moveFile(path.join(root, f), path.join(root, "outros/dumps", f));
});
moveFile(path.join(root, "walkthrough.md"), path.join(root, "docs/releases/WALKTHROUGH_HISTORY.md"));

console.log("2. Moving non-gitignored root folders (artifacts, reports, uploads)...");
["artifacts", "reports"].forEach((dir) => {
  moveFile(path.join(root, dir), path.join(root, "outros", dir));
});
moveFile(path.join(root, "uploads"), path.join(root, "data/uploads"));

console.log("3. Moving frontend-official stray files...");
const feRoot = path.join(root, "frontend-official");
for (const entry of fs.readdirSync(feRoot)) {
  if (
    /^update\d+\.cjs$/.test(entry) ||
    entry === "verify_final_fix.mjs" ||
    /^vite\.config\.ts\.timestamp-/.test(entry)
  ) {
    moveFile(path.join(feRoot, entry), path.join(root, "outros/frontend-temp", entry));
  }
}
moveFile(path.join(feRoot, "src/mock.txt"), path.join(root, "outros/frontend-temp/mock.txt"));

console.log("4. Organizing scripts/ into branched subfolders...");
const scriptsDir = path.join(root, "scripts");
const KEEP_SCRIPTS = new Set([
  "runtime-lib.mjs",
  "runtime-start.mjs",
  "runtime-stop.mjs",
  "runtime-clean.mjs",
  "runtime-restart.mjs",
  "deploy-master.js",
  "deploy-production.sh",
  "rollback-production.sh",
  "run-e2e-smoke.js",
  "migrate.js",
  "seed.js",
  "backup-postgres.sh",
  "restore-postgres.sh",
  "healthcheck.sh",
  "audit-project-hygiene.js",
]);

let movedScripts = 0;
for (const entry of fs.readdirSync(scriptsDir, { withFileTypes: true })) {
  if (entry.isDirectory()) continue;
  if (KEEP_SCRIPTS.has(entry.name)) continue;
  const name = entry.name;
  let bucket = "misc";
  if (/^(capture_|screenshot)/.test(name)) bucket = "captures";
  else if (
    /^(check_|debug_|diagnose_|inspect_|query_|list_|find_|get_|read_|fetch_|dump_|probe_|scan_|search_|trace_|audit_)/.test(
      name
    )
  )
    bucket = "diagnostics";
  else if (/^(fix_|patch_|update_|restore_|clean_|reset_|sync_|apply_|set_|enable_|create_)/.test(name))
    bucket = "fixes";
  else if (/^(test_|verify_|validate_|sim_)/.test(name)) bucket = "verifications";
  if (moveFile(path.join(scriptsDir, name), path.join(root, "outros/scripts-archive", bucket, name))) {
    movedScripts++;
  }
}
console.log("Moved ad-hoc scripts:", movedScripts);

console.log("5. Organizing docs/ into branched subfolders...");
const docsDir = path.join(root, "docs");
ensureDir(path.join(docsDir, "architecture"));
ensureDir(path.join(docsDir, "releases"));
ensureDir(path.join(docsDir, "ops"));
ensureDir(path.join(docsDir, "archive"));

for (const entry of fs.readdirSync(docsDir, { withFileTypes: true })) {
  if (entry.isDirectory()) continue;
  const name = entry.name;
  if (
    name === "ARCHITECTURE.md" ||
    name === "PROJECT_STRUCTURE.md" ||
    name === "API.md" ||
    name === "SECURITY.md"
  ) {
    moveFile(path.join(docsDir, name), path.join(docsDir, "architecture", name));
  } else if (
    name === "DEPLOY.md" ||
    name === "OPERATIONS.md" ||
    name === "OBSERVABILITY.md" ||
    name === "TROUBLESHOOTING.md"
  ) {
    moveFile(path.join(docsDir, name), path.join(docsDir, "ops", name));
  } else if (name !== "INDEX.md") {
    moveFile(path.join(docsDir, name), path.join(docsDir, "archive", name));
  }
}

console.log("Done! Scripts remaining in scripts/:", fs.readdirSync(scriptsDir).join(", "));
console.log("Docs folders in docs/:", fs.readdirSync(docsDir).join(", "));
