const { execSync, spawn } = require('child_process');
const path = require('path');

const commitMsg = process.argv[2] || `deploy: auto-sync update master vps ${new Date().toLocaleTimeString('pt-BR')}`;
const projectRoot = path.join(__dirname, '..');

console.log('\x1b[36m%s\x1b[0m', '====================================================');
console.log('\x1b[36m%s\x1b[0m', '  🚀 ZAPAI MASTER FAST DEPLOY & GIT SYNC');
console.log('\x1b[36m%s\x1b[0m', '====================================================');

try {
  console.log('\n\x1b[32m%s\x1b[0m', '1. Staging e criando commit Git...');
  execSync('git add .', { cwd: projectRoot, stdio: 'inherit' });
  try {
    execSync(`git commit -m "${commitMsg}"`, { cwd: projectRoot, stdio: 'inherit' });
  } catch (_e) {
    console.log('  -> Nenhuma alteração pendente para commit.');
  }

  console.log('\n\x1b[32m%s\x1b[0m', '2. Sincronizando com GitHub (push origin main)...');
  execSync('git push origin main', { cwd: projectRoot, stdio: 'inherit' });
  console.log('\x1b[32m%s\x1b[0m', '✔ GitHub sincronizado com sucesso!');

  console.log('\n\x1b[32m%s\x1b[0m', '3. Disparando deploy ultrarrápido via SSH na VPS Master (209.50.241.22)...');
  const sshCmd = 'c:\\projetos\\ZAPAI-FINAL\\node.exe tmp_ssh/run-ssh-cmd.js "cd /opt/zapai && bash deploy/auto-deploy.sh"';
  
  execSync(sshCmd, { cwd: projectRoot, stdio: 'inherit' });

  console.log('\n\x1b[36m%s\x1b[0m', '====================================================');
  console.log('\x1b[32m%s\x1b[0m', '✨ DEPLOY MASTER CONCLUÍDO E ONLINE NA VPS!');
  console.log('\x1b[36m%s\x1b[0m', '====================================================');
} catch (error) {
  console.error('\x1b[31m%s\x1b[0m', '\n✖ Falha no deploy master:', error.message);
  process.exit(1);
}
