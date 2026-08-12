const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { detectProjectProfile } = require('./detector');

function computeFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function syncEngineeringPack(targetDir, packSourceDir, options = {}) {
  const report = {
    installedSkills: [],
    installedCoreSkills: [],
    installedDomainPacks: [],
    syncedAdapters: [],
    profileCreated: false,
    lockUpdated: false,
    policyCreated: false,
    errors: []
  };

  const zapflowDir = path.join(targetDir, '.zapflow');
  const targetAgentsDir = path.join(targetDir, '.agents');
  const targetSkillsDir = path.join(targetAgentsDir, 'skills');
  const targetAgentsSubDir = path.join(targetAgentsDir, 'agents');
  const targetRulesDir = path.join(targetAgentsDir, 'rules');

  // Ensure directories exist
  [zapflowDir, targetAgentsDir, targetSkillsDir, targetAgentsSubDir, targetRulesDir].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  // 1. Detect profile and domain packs
  const profile = detectProjectProfile(targetDir);

  // 2. Copy Universal Core skills from .agents/skills/
  const sourceCoreSkillsDir = path.join(packSourceDir, '.agents', 'skills');
  if (fs.existsSync(sourceCoreSkillsDir)) {
    const skillFolders = fs.readdirSync(sourceCoreSkillsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const skillFolder of skillFolders) {
      const srcSkillPath = path.join(sourceCoreSkillsDir, skillFolder);
      const destSkillPath = path.join(targetSkillsDir, skillFolder);

      if (!fs.existsSync(destSkillPath)) fs.mkdirSync(destSkillPath, { recursive: true });

      const files = fs.readdirSync(srcSkillPath);
      for (const file of files) {
        fs.copyFileSync(path.join(srcSkillPath, file), path.join(destSkillPath, file));
      }
      report.installedCoreSkills.push(skillFolder);
      report.installedSkills.push(skillFolder);
    }
  }

  // 3. Copy detected Domain Packs from domain-packs/
  const sourceDomainPacksDir = path.join(packSourceDir, 'domain-packs');
  if (fs.existsSync(sourceDomainPacksDir)) {
    for (const dpName of profile.domainPacks) {
      const srcDpPath = path.join(sourceDomainPacksDir, dpName);
      if (fs.existsSync(srcDpPath)) {
        const destDpPath = path.join(targetSkillsDir, dpName);
        if (!fs.existsSync(destDpPath)) fs.mkdirSync(destDpPath, { recursive: true });

        const files = fs.readdirSync(srcDpPath);
        for (const file of files) {
          fs.copyFileSync(path.join(srcDpPath, file), path.join(destDpPath, file));
        }
        report.installedDomainPacks.push(dpName);
        if (!report.installedSkills.includes(dpName)) report.installedSkills.push(dpName);
      }
    }
  }

  // 4. Copy source agents to .agents/agents/
  const sourceAgentsDir = path.join(packSourceDir, '.agents', 'agents');
  if (fs.existsSync(sourceAgentsDir)) {
    const agentFiles = fs.readdirSync(sourceAgentsDir).filter(f => f.endsWith('.md'));
    for (const file of agentFiles) {
      fs.copyFileSync(path.join(sourceAgentsDir, file), path.join(targetAgentsSubDir, file));
    }
  }

  // 5. Copy source rules to .agents/rules/
  const sourceRulesDir = path.join(packSourceDir, '.agents', 'rules');
  if (fs.existsSync(sourceRulesDir)) {
    const ruleFiles = fs.readdirSync(sourceRulesDir).filter(f => f.endsWith('.md'));
    for (const file of ruleFiles) {
      fs.copyFileSync(path.join(sourceRulesDir, file), path.join(targetRulesDir, file));
    }
  }

  // Save profile
  profile.skills = report.installedSkills;
  fs.writeFileSync(path.join(zapflowDir, 'project-profile.json'), JSON.stringify(profile, null, 2));
  report.profileCreated = true;

  // 6. Sync Adapters
  const targetClaudeSkillsDir = path.join(targetDir, '.claude', 'skills');
  if (!fs.existsSync(targetClaudeSkillsDir)) fs.mkdirSync(targetClaudeSkillsDir, { recursive: true });

  for (const skillFolder of report.installedSkills) {
    const srcSkillFile = path.join(targetSkillsDir, skillFolder, 'SKILL.md');
    const destClaudeFolder = path.join(targetClaudeSkillsDir, skillFolder);
    if (fs.existsSync(srcSkillFile)) {
      if (!fs.existsSync(destClaudeFolder)) fs.mkdirSync(destClaudeFolder, { recursive: true });
      fs.copyFileSync(srcSkillFile, path.join(destClaudeFolder, 'SKILL.md'));
    }
  }
  report.syncedAdapters.push('Claude Code');
  report.syncedAdapters.push('Google Antigravity');
  report.syncedAdapters.push('OpenAI Codex');
  report.syncedAdapters.push('Gemini CLI');
  report.syncedAdapters.push('Qwen Code');

  // 7. Policy File
  const policyPath = path.join(zapflowDir, 'policy.json');
  const policy = {
    version: "1.0.0",
    description: "Skill Global Universal Engineering Policy",
    allowlist: {
      vendors: ["superpowers", "wshobson", "anthropic", "autoresearch"],
      repositories: [
        "https://github.com/obra/superpowers.git",
        "https://github.com/wshobson/agents.git",
        "https://github.com/anthropics/skills.git",
        "https://github.com/karpathy/autoresearch.git"
      ]
    },
    skill_permissions: {
      allowed_file_extensions: [".md", ".txt", ".json", ".yaml", ".yml"],
      forbidden_file_extensions: [".sh", ".bat", ".ps1", ".py", ".js", ".exe", ".bin"],
      auto_execute_scripts: false,
      require_approval_for_destructive: true
    },
    protected_paths: {
      never_modify: [
        ".env", ".env.*", "**/.env", "*.pem", "*.key", "*.p12", "backend/sessions/**", "tmp_ssh/**", "deploy/**", ".git/**", "node_modules/**"
      ],
      never_read: ["admin-credentials.txt", ".ssh/**", "*.pem", "*.key"]
    },
    forbidden_operations: [
      "modify .env files",
      "run SSH commands",
      "deploy to production",
      "commit to git automatically",
      "push to GitHub automatically",
      "modify database schema without migration",
      "delete existing source files"
    ]
  };
  fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2));
  report.policyCreated = true;

  // 8. Generate Manifest (skills.json)
  const manifestPath = path.join(zapflowDir, 'skills.json');
  const manifest = {
    version: "1.0.0",
    pack: "Skill Global Universal Layer",
    created: new Date().toISOString().split('T')[0],
    update_policy: "manual",
    core: report.installedCoreSkills,
    domainPacks: {
      whatsapp: { enabled: profile.domainPacks.includes('whatsapp'), skills: ["whatsapp"] },
      graphify: { enabled: profile.domainPacks.includes('graphify'), skills: ["graphify"] },
      analytics: { enabled: profile.domainPacks.includes('analytics'), skills: ["analytics"] }
    },
    installed_skills: report.installedSkills,
    native_agents: ["architect", "developer", "debugger", "tester", "reviewer", "security", "release"]
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // 9. Generate Lockfile (lock.json)
  const lockPath = path.join(zapflowDir, 'lock.json');
  const fileHashes = {};
  for (const sName of report.installedSkills) {
    const sFile = path.join(targetSkillsDir, sName, 'SKILL.md');
    fileHashes[sName] = computeFileHash(sFile);
  }

  const lock = {
    version: "1.0.0",
    pack_version: "Skill Global Engineering Pack 1.0.0",
    generated_at: new Date().toISOString(),
    file_hashes: fileHashes,
    installed_skills: report.installedSkills
  };
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2));
  report.lockUpdated = true;

  return report;
}

module.exports = { syncEngineeringPack, computeFileHash };
