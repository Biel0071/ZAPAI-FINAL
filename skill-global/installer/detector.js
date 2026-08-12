const fs = require('fs');
const path = require('path');

function detectProjectProfile(projectRoot) {
  const profile = {
    packVersion: "1.0.0",
    project: path.basename(projectRoot),
    language: [],
    framework: [],
    frontend: [],
    backend: [],
    database: [],
    orm: [],
    testing: [],
    packageManager: "npm",
    build: [],
    deployment: [],
    domainPacks: [],
    agents: [],
    skills: [],
    detectedAt: new Date().toISOString()
  };

  // 1. Detect Package Managers & Config Files
  if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) profile.packageManager = 'pnpm';
  else if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) profile.packageManager = 'yarn';
  else if (fs.existsSync(path.join(projectRoot, 'bun.lockb'))) profile.packageManager = 'bun';
  else if (fs.existsSync(path.join(projectRoot, 'cargo.lock'))) profile.packageManager = 'cargo';
  else if (fs.existsSync(path.join(projectRoot, 'go.mod'))) profile.packageManager = 'go';
  else if (fs.existsSync(path.join(projectRoot, 'poetry.lock'))) profile.packageManager = 'poetry';

  // 2. Scan package.json files
  const packageJsonPaths = [
    path.join(projectRoot, 'package.json'),
    path.join(projectRoot, 'backend/package.json'),
    path.join(projectRoot, 'frontend/package.json'),
    path.join(projectRoot, 'frontend-official/package.json')
  ];

  let allDeps = {};
  for (const pPath of packageJsonPaths) {
    if (fs.existsSync(pPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pPath, 'utf8'));
        const merged = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        allDeps = { ...allDeps, ...merged };
      } catch (err) {}
    }
  }

  // 3. Languages
  if (fs.existsSync(path.join(projectRoot, 'tsconfig.json')) || allDeps['typescript']) {
    profile.language.push('TypeScript');
  }
  if (fs.existsSync(path.join(projectRoot, 'package.json')) || allDeps['express']) {
    profile.language.push('JavaScript');
  }
  if (fs.existsSync(path.join(projectRoot, 'go.mod'))) profile.language.push('Go');
  if (fs.existsSync(path.join(projectRoot, 'Cargo.toml'))) profile.language.push('Rust');
  if (fs.existsSync(path.join(projectRoot, 'requirements.txt')) || fs.existsSync(path.join(projectRoot, 'pyproject.toml'))) profile.language.push('Python');

  profile.language = [...new Set(profile.language)];

  // 4. Frameworks & Components
  if (allDeps['react'] || allDeps['react-dom']) {
    profile.frontend.push('React');
    profile.framework.push('React');
  }
  if (allDeps['next']) {
    profile.frontend.push('Next.js');
    profile.framework.push('Next.js');
  }
  if (allDeps['vue']) {
    profile.frontend.push('Vue');
    profile.framework.push('Vue');
  }

  if (allDeps['express']) {
    profile.backend.push('Express');
    profile.framework.push('Express');
  }
  if (allDeps['@nestjs/core']) {
    profile.backend.push('NestJS');
    profile.framework.push('NestJS');
  }
  if (allDeps['fastify']) {
    profile.backend.push('Fastify');
    profile.framework.push('Fastify');
  }

  // 5. Database & ORM
  if (allDeps['pg'] || allDeps['pg-pool']) profile.database.push('PostgreSQL');
  if (allDeps['mysql'] || allDeps['mysql2']) profile.database.push('MySQL');
  if (allDeps['mongodb'] || allDeps['mongoose']) profile.database.push('MongoDB');
  if (allDeps['redis'] || allDeps['ioredis']) profile.database.push('Redis');

  if (allDeps['prisma'] || allDeps['@prisma/client']) profile.orm.push('Prisma');
  if (allDeps['typeorm']) profile.orm.push('TypeORM');
  if (allDeps['drizzle-orm']) profile.orm.push('Drizzle');
  if (allDeps['sequelize']) profile.orm.push('Sequelize');

  // 6. Testing
  if (allDeps['vitest']) profile.testing.push('Vitest');
  if (allDeps['jest']) profile.testing.push('Jest');
  if (allDeps['playwright'] || allDeps['@playwright/test']) profile.testing.push('Playwright');
  if (allDeps['cypress']) profile.testing.push('Cypress');

  // 7. Build System
  if (allDeps['vite']) profile.build.push('Vite');
  if (allDeps['webpack']) profile.build.push('Webpack');
  if (allDeps['esbuild']) profile.build.push('esbuild');

  // 8. Deployment
  if (fs.existsSync(path.join(projectRoot, 'docker-compose.yml')) || fs.existsSync(path.join(projectRoot, 'Dockerfile'))) {
    profile.deployment.push('Docker');
  }
  if (fs.existsSync(path.join(projectRoot, 'pm2.json')) || allDeps['pm2']) {
    profile.deployment.push('PM2');
  }

  // 9. Domain Pack Detection
  if (allDeps['@whiskeysockets/baileys'] || allDeps['whatsapp-web.js'] || fs.existsSync(path.join(projectRoot, 'backend/services/whatsapp'))) {
    profile.domainPacks.push('whatsapp');
  }
  if (fs.existsSync(path.join(projectRoot, 'graphify-out')) || fs.existsSync(path.join(projectRoot, 'graphify.json'))) {
    profile.domainPacks.push('graphify');
  }
  if (allDeps['recharts'] || allDeps['chart.js'] || fs.existsSync(path.join(projectRoot, 'frontend-official/src/pages/Dashboard.tsx'))) {
    profile.domainPacks.push('analytics');
  }

  profile.domainPacks = [...new Set(profile.domainPacks)];

  // 10. Detect AI Agents
  if (fs.existsSync(path.join(projectRoot, '.claude')) || fs.existsSync(path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude'))) {
    profile.agents.push('Claude Code');
  }
  if (fs.existsSync(path.join(projectRoot, '.agents')) || fs.existsSync(path.join(process.env.USERPROFILE || '', '.gemini/antigravity-ide'))) {
    profile.agents.push('Google Antigravity');
  }
  if (fs.existsSync(path.join(projectRoot, '.codex')) || process.env.CODEX_THREAD_ID) {
    profile.agents.push('OpenAI Codex');
  }
  if (fs.existsSync(path.join(projectRoot, '.gemini'))) {
    profile.agents.push('Gemini CLI');
  }
  if (fs.existsSync(path.join(projectRoot, '.qwen'))) {
    profile.agents.push('Qwen Code');
  }

  profile.agents = [...new Set(profile.agents)];

  return profile;
}

module.exports = { detectProjectProfile };
