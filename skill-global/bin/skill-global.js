#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { detectProjectProfile } = require('../installer/detector');
const { syncEngineeringPack, computeFileHash } = require('../installer/sync');

const packRoot = path.resolve(__dirname, '..');
const version = fs.readFileSync(path.join(packRoot, 'VERSION'), 'utf8').trim();

const command = process.argv[2] || 'doctor';
const arg1 = process.argv[3];
const targetDir = process.cwd();

function logHeader(title) {
  console.log(`\n============================================================`);
  console.log(` SKILL-GLOBAL UNIVERSAL PACK (v${version}) — ${title}`);
  console.log(`============================================================`);
}

switch (command.toLowerCase()) {
  case 'version':
  case '-v':
  case '--version':
    console.log(`Skill Global Engineering Pack v${version}`);
    process.exit(0);
    break;

  case 'install': {
    logHeader('INSTALLATION');
    console.log(`Target project: ${targetDir}`);
    const report = syncEngineeringPack(targetDir, packRoot);
    console.log(`✅ Installed ${report.installedSkills.length} canonical skills in .agents/skills/`);
    console.log(`✅ Synced Adapters: ${report.syncedAdapters.join(', ')}`);
    console.log(`✅ Generated .zapflow/project-profile.json`);
    console.log(`✅ Lockfile (.zapflow/lock.json) updated with SHA-256 hashes`);

    // Run Doctor & Audit as part of installation validation
    runDoctor(targetDir);
    runAudit(targetDir);
    break;
  }

  case 'update': {
    logHeader('UPDATE');
    console.log(`Updating ZapFlow Engineering Pack in: ${targetDir}`);
    const report = syncEngineeringPack(targetDir, packRoot, { isUpdate: true });
    console.log(`✅ Engineering Pack updated to v${version}`);
    console.log(`✅ Updated ${report.installedSkills.length} skills while preserving custom overrides`);
    break;
  }

  case 'doctor': {
    logHeader('DOCTOR DIAGNOSTICS');
    runDoctor(targetDir);
    break;
  }

  case 'audit': {
    logHeader('SECURITY & INTEGRITY AUDIT');
    runAudit(targetDir);
    break;
  }

  case 'verify': {
    logHeader('LOCKFILE HASH VERIFICATION');
    const success = runVerify(targetDir);
    if (!success) {
      console.error(`❌ Verification failed! Skill files do not match .zapflow/lock.json`);
      process.exit(1);
    } else {
      console.log(`✅ All skill file hashes match .zapflow/lock.json perfectly.`);
      process.exit(0);
    }
    break;
  }

  case 'list': {
    logHeader('INSTALLED SKILLS & AGENTS');
    const skillsDir = path.join(targetDir, '.agents', 'skills');
    if (!fs.existsSync(skillsDir)) {
      console.log(`No .agents/skills folder found in ${targetDir}. Run 'zapflow-eng install' first.`);
      break;
    }

    const skills = fs.readdirSync(skillsDir).filter(f => fs.statSync(path.join(skillsDir, f)).isDirectory());
    console.log(`Installed Skills (${skills.length}):`);
    skills.forEach((s, idx) => {
      const hasSkillMd = fs.existsSync(path.join(skillsDir, s, 'SKILL.md'));
      console.log(`  ${(idx + 1).toString().padStart(2, ' ')}. ${s.padEnd(26, ' ')} [${hasSkillMd ? 'SKILL.md OK' : 'MISSING SKILL.MD'}]`);
    });
    break;
  }

  case 'remove': {
    logHeader('REMOVE SKILL');
    if (!arg1) {
      console.error(`Usage: zapflow-eng remove <skill-name>`);
      process.exit(1);
    }
    const skillPath = path.join(targetDir, '.agents', 'skills', arg1);
    const claudeSkillPath = path.join(targetDir, '.claude', 'skills', arg1);

    if (fs.existsSync(skillPath)) {
      fs.rmSync(skillPath, { recursive: true, force: true });
      if (fs.existsSync(claudeSkillPath)) fs.rmSync(claudeSkillPath, { recursive: true, force: true });
      console.log(`✅ Skill '${arg1}' removed successfully.`);

      // Re-sync lock
      syncEngineeringPack(targetDir, packRoot);
    } else {
      console.log(`Skill '${arg1}' not found in .agents/skills/`);
    }
    break;
  }

  case 'portable': {
    logHeader('PORTABLE BUNDLE GENERATION');
    const bundlePath = path.join(targetDir, `zapflow-engineering-pack-v${version}-portable.json`);
    const bundle = {
      version,
      packRoot: path.basename(packRoot),
      generatedAt: new Date().toISOString(),
      skills: {}
    };

    const sourceSkillsDir = path.join(packRoot, '.agents', 'skills');
    if (fs.existsSync(sourceSkillsDir)) {
      const folders = fs.readdirSync(sourceSkillsDir).filter(f => fs.statSync(path.join(sourceSkillsDir, f)).isDirectory());
      for (const f of folders) {
        const sFile = path.join(sourceSkillsDir, f, 'SKILL.md');
        if (fs.existsSync(sFile)) {
          bundle.skills[f] = fs.readFileSync(sFile, 'utf8');
        }
      }
    }
    fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));
    console.log(`✅ Portable bundle created: ${bundlePath}`);
    break;
  }

  case 'uninstall': {
    logHeader('UNINSTALLATION');
    const zapflowDir = path.join(targetDir, '.zapflow');
    const skillsDir = path.join(targetDir, '.agents', 'skills');
    const claudeSkillsDir = path.join(targetDir, '.claude', 'skills');

    if (fs.existsSync(skillsDir)) fs.rmSync(skillsDir, { recursive: true, force: true });
    if (fs.existsSync(zapflowDir)) fs.rmSync(zapflowDir, { recursive: true, force: true });
    console.log(`✅ Skill Global uninstalled cleanly from ${targetDir}`);
    break;
  }

  default:
    console.log(`Unknown command '${command}'.`);
    console.log(`Available commands: install, update, uninstall, doctor, audit, verify, list, remove, portable, version`);
    process.exit(1);
}

function runDoctor(tDir) {
  const results = [];
  
  // 1. Node check
  results.push({ name: 'Node.js Environment', status: 'PASS', detail: process.version });

  // 2. Git check
  const hasGit = fs.existsSync(path.join(tDir, '.git'));
  results.push({ name: 'Git Repository', status: hasGit ? 'PASS' : 'WARN', detail: hasGit ? 'Active .git' : 'No .git folder' });

  // 3. Project profile
  const profilePath = path.join(tDir, '.zapflow', 'project-profile.json');
  const hasProfile = fs.existsSync(profilePath);
  results.push({ name: 'Project Profile', status: hasProfile ? 'PASS' : 'WARN', detail: hasProfile ? '.zapflow/project-profile.json exists' : 'Not generated yet' });

  // 4. Lockfile
  const lockPath = path.join(tDir, '.zapflow', 'lock.json');
  const hasLock = fs.existsSync(lockPath);
  results.push({ name: 'Lockfile Status', status: hasLock ? 'PASS' : 'WARN', detail: hasLock ? '.zapflow/lock.json active' : 'Not lockfile' });

  // 5. Skills folder
  const skillsPath = path.join(tDir, '.agents', 'skills');
  const hasSkills = fs.existsSync(skillsPath);
  results.push({ name: 'Canonical Skills', status: hasSkills ? 'PASS' : 'FAIL', detail: hasSkills ? '.agents/skills/ present' : 'Missing .agents/skills' });

  // Render Table
  console.log(`\nDoctor Diagnostic Checks:`);
  results.forEach(r => {
    const symbol = r.status === 'PASS' ? '🟢' : r.status === 'WARN' ? '🟡' : '🔴';
    console.log(`  ${symbol} [${r.status.padEnd(4, ' ')}] ${r.name.padEnd(24, ' ')} : ${r.detail}`);
  });
}

function runAudit(tDir) {
  const issues = [];
  const skillsDir = path.join(tDir, '.agents', 'skills');

  if (fs.existsSync(skillsDir)) {
    const folders = fs.readdirSync(skillsDir).filter(f => fs.statSync(path.join(skillsDir, f)).isDirectory());
    for (const f of folders) {
      const sMd = path.join(skillsDir, f, 'SKILL.md');
      if (!fs.existsSync(sMd)) {
        issues.push(`Orphaned skill directory '${f}' missing SKILL.md`);
      } else {
        const content = fs.readFileSync(sMd, 'utf8');
        if (!content.startsWith('---')) {
          issues.push(`Skill '${f}' lacks frontmatter header`);
        }

        // Check for non-generalized host terms in core skills
        const domainSkills = ['whatsapp', 'graphify', 'analytics'];
        if (!domainSkills.includes(f)) {
          const forbiddenHostTerms = ['ZAPAI-FINAL', 'companyId'];
          for (const term of forbiddenHostTerms) {
            if (content.includes(term)) {
              issues.push(`Core skill '${f}' contains host-specific term '${term}' — needs generalization`);
            }
          }
        }
      }
    }
  }

  // Check for dangerous root artifacts
  const rootFiles = fs.readdirSync(tDir);
  const dangerousPatterns = ['FINAL_', 'FIX_', 'TEMP_', 'BACKUP_', 'NEW_'];
  for (const rf of rootFiles) {
    if (dangerousPatterns.some(p => rf.startsWith(p))) {
      issues.push(`Root hygiene warning: unclassified root artifact '${rf}' detected`);
    }
  }

  console.log(`\nAudit Results:`);
  if (issues.length === 0) {
    console.log(`  🟢 0 security or integrity issues found. Architecture clean.`);
  } else {
    issues.forEach(i => console.log(`  🟡 AUDIT WARN: ${i}`));
  }
}

function runVerify(tDir) {
  const lockPath = path.join(tDir, '.zapflow', 'lock.json');
  if (!fs.existsSync(lockPath)) return false;

  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const savedHashes = lock.file_hashes || {};

    const skillsDir = path.join(tDir, '.agents', 'skills');
    if (!fs.existsSync(skillsDir)) return false;

    for (const [skillName, savedHash] of Object.entries(savedHashes)) {
      const sFile = path.join(skillsDir, skillName, 'SKILL.md');
      const currentHash = computeFileHash(sFile);
      if (currentHash !== savedHash) {
        console.error(`Hash mismatch for skill '${skillName}': Expected ${savedHash}, got ${currentHash}`);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error(`Error reading lockfile: ${err.message}`);
    return false;
  }
}
