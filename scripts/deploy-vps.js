const { spawn, execSync } = require('child_process');
const readline = require('readline');

const VPS_IP = '209.50.229.68';
const VPS_USER = 'root';
const VPS_DIR = '/opt/zapai';

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

async function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

async function run() {
  console.log('============================================================');
  console.log('              ZAPAI ONE-CLICK DEPLOY UTILITY');
  console.log('============================================================\n');

  // Check git status
  console.log('[INFO] Verificando status do Git...');
  try {
    const status = execSync('git status --short').toString().trim();
    if (status) {
      console.log('\nAlterações pendentes detectadas:\n' + status + '\n');
      
      let commitMsg = '';
      if (process.stdin.isTTY) {
        commitMsg = await askQuestion('Digite a mensagem do commit (ou ENTER para auto-commit): ');
      }
      
      if (!commitMsg) {
        commitMsg = `auto-deploy: ${getTimestamp()}`;
      }

      console.log(`[INFO] Commitando alterações: "${commitMsg}"...`);
      execSync('git add -A');
      try {
        execSync(`git commit -m "${commitMsg}"`);
        console.log('[OK] Alterações commitadas.');
      } catch (err) {
        console.log('[WARN] Nada para commitar ou erro no commit. Continuando...');
      }
    } else {
      console.log('[OK] Git working directory limpo.');
    }
  } catch (err) {
    console.log('[WARN] Erro ao verificar status do Git. Continuando...');
  }

  // Git Push
  console.log('[INFO] Fazendo push para o GitHub (origin main)...');
  try {
    execSync('git push origin main', { stdio: 'inherit' });
    console.log('[OK] Push concluído com sucesso.\n');
  } catch (err) {
    console.error('[ERRO] Falha ao enviar para o GitHub. Verifique sua conexão e chaves SSH.');
    process.exit(1);
  }

  // SSH Connection & Auto-Deploy
  console.log('============================================================');
  console.log(`       CONECTANDO A VPS (${VPS_IP}) E INICIANDO DEPLOY`);
  console.log('============================================================\n');

  const sshCommand = `cd ${VPS_DIR} && bash deploy/auto-deploy.sh`;
  const ssh = spawn('ssh', ['-o', 'StrictHostKeyChecking=no', `${VPS_USER}@${VPS_IP}`, sshCommand], {
    stdio: 'inherit',
    shell: true,
  });

  ssh.on('close', (code) => {
    if (code !== 0) {
      console.error(`\n[ERRO] O DEPLOY FALHOU NA VPS! CÓDIGO DE RETORNO: ${code}`);
      process.exit(code);
    } else {
      console.log('\n[OK] DEPLOY CONCLUÍDO COM SUCESSO E SISTEMA ESTABILIZADO!');
      process.exit(0);
    }
  });
}

run();
