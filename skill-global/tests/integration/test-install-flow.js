const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { syncEngineeringPack } = require('../../installer/sync');

function runTestIntegration() {
  console.log('Testing Integration Flow (Mock Target Projects)...');
  
  const packSourceDir = path.resolve(__dirname, '../..');

  // Test 1: React/Node Project (No WhatsApp)
  const mockNodeDir = path.resolve(__dirname, '../../temp-node-project');
  if (!fs.existsSync(mockNodeDir)) fs.mkdirSync(mockNodeDir, { recursive: true });
  fs.writeFileSync(path.join(mockNodeDir, 'package.json'), JSON.stringify({
    name: "node-test-project", dependencies: { "express": "^4.18.2", "react": "^18.2.0" }
  }, null, 2));

  const reportNode = syncEngineeringPack(mockNodeDir, packSourceDir);
  assert(fs.existsSync(path.join(mockNodeDir, '.agents', 'skills')), '.agents/skills should exist');
  assert(!reportNode.installedDomainPacks.includes('whatsapp'), 'Should NOT install WhatsApp domain pack for standard Node project');
  assert(reportNode.installedCoreSkills.includes('architect'), 'Should install core architect skill');
  fs.rmSync(mockNodeDir, { recursive: true, force: true });
  console.log('  ✅ Test 1: React/Node project installation (Core only) PASSED.');

  // Test 2: Python/FastAPI Project (No WhatsApp)
  const mockPyDir = path.resolve(__dirname, '../../temp-py-project');
  if (!fs.existsSync(mockPyDir)) fs.mkdirSync(mockPyDir, { recursive: true });
  fs.writeFileSync(path.join(mockPyDir, 'requirements.txt'), 'fastapi==0.100.0\nuvicorn==0.22.0\n');

  const reportPy = syncEngineeringPack(mockPyDir, packSourceDir);
  assert(!reportPy.installedDomainPacks.includes('whatsapp'), 'Should NOT install WhatsApp domain pack for Python project');
  assert(reportPy.installedCoreSkills.includes('developer'), 'Should install core developer skill');
  fs.rmSync(mockPyDir, { recursive: true, force: true });
  console.log('  ✅ Test 2: Python/FastAPI project installation (Core only) PASSED.');

  // Test 3: Project WITH WhatsApp dependency
  const mockWaDir = path.resolve(__dirname, '../../temp-wa-project');
  if (!fs.existsSync(mockWaDir)) fs.mkdirSync(mockWaDir, { recursive: true });
  fs.writeFileSync(path.join(mockWaDir, 'package.json'), JSON.stringify({
    name: "wa-test-project", dependencies: { "@whiskeysockets/baileys": "^6.7.0" }
  }, null, 2));

  const reportWa = syncEngineeringPack(mockWaDir, packSourceDir);
  assert(reportWa.installedDomainPacks.includes('whatsapp'), 'SHOULD install WhatsApp domain pack when Baileys is detected');
  fs.rmSync(mockWaDir, { recursive: true, force: true });
  console.log('  ✅ Test 3: Project with WhatsApp dependency installation (Core + Domain Pack) PASSED.');
}

module.exports = { runTestIntegration };
