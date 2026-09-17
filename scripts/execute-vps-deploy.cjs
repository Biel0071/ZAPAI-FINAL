const { spawn } = require('child_process');

const VPS_HOST = 'root@209.50.241.22';

function runRemoteCommand(cmdDescription, bashCommand) {
  return new Promise((resolve, reject) => {
    console.log(`\n>>> [START] ${cmdDescription}...`);
    const proc = spawn('ssh', [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ConnectTimeout=15',
      VPS_HOST,
      bashCommand
    ], { stdio: 'inherit', shell: false });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`>>> [SUCCESS] ${cmdDescription}`);
        resolve();
      } else {
        console.error(`>>> [FAILED] ${cmdDescription} (Exit Code: ${code})`);
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      console.error(`>>> [ERROR] Failed to start SSH process:`, err);
      reject(err);
    });
  });
}

async function main() {
  try {
    console.log('====================================================');
    console.log('   INICIANDO PIPELINE DE DEPLOY NA VPS (209.50.241.22)');
    console.log('====================================================');

    // 1. Checkout main and reset hard to origin/main
    await runRemoteCommand(
      'Atualizar repositório para origin/main na VPS',
      'cd /opt/zapai && git fetch origin main && git checkout main && git reset --hard origin/main && git log -n 1 --oneline'
    );

    // 2. Executar auto-deploy.sh oficial
    await runRemoteCommand(
      'Executar script oficial de auto-deploy na VPS',
      'cd /opt/zapai && bash deploy/auto-deploy.sh'
    );

    // 3. Executar ativação e ingestão de memórias no PostgreSQL da VPS
    await runRemoteCommand(
      'Ativar e ingerir memórias e evolução no banco de dados da VPS',
      'cd /opt/zapai && node scripts/activate-and-ingest-all-memory.cjs'
    );

    // 4. Checar status do PM2 e logs de inicialização
    await runRemoteCommand(
      'Checar status PM2 na VPS',
      'pm2 status zapflow-api'
    );

    console.log('\n====================================================');
    console.log('   DEPLOY E ATIVAÇÃO CONCLUÍDOS COM SUCESSO NA VPS!');
    console.log('====================================================');
  } catch (err) {
    console.error('\n[FATAL] Falha no pipeline de deploy:', err.message);
    process.exit(1);
  }
}

main();
