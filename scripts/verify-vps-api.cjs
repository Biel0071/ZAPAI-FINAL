const { spawn } = require('child_process');

const remoteScript = `
const crypto = require('crypto');
require('dotenv').config({ path: '/opt/zapai/backend/.env' });

const secret = process.env.JWT_SECRET || 'secret';
const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  userId: 'test-admin',
  companyId: 'default',
  role: 'admin',
  exp: Math.floor(Date.now() / 1000) + 3600
})).toString('base64url');
const sig = crypto.createHmac('sha256', secret).update(header + '.' + payload).digest('base64url');
const token = header + '.' + payload + '.' + sig;

async function run() {
  console.log('Testing endpoints on VPS...');
  
  // Test media
  const resMedia = await fetch('http://127.0.0.1:4025/api/ai/memory/media?limit=5', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const dataMedia = await resMedia.json();
  console.log('[API MEDIA]', 'status:', resMedia.status, 'success:', dataMedia.success, 'count:', dataMedia.data?.length);
  if (dataMedia.data && dataMedia.data.length > 0) {
    console.log('[API MEDIA SAMPLE]', {
      id: dataMedia.data[0].id,
      category: dataMedia.data[0].category,
      caption: dataMedia.data[0].caption ? dataMedia.data[0].caption.substring(0, 50) : null,
      ocr_preview: dataMedia.data[0].ocr_analysis ? dataMedia.data[0].ocr_analysis.substring(0, 60) : null,
      source: dataMedia.data[0].source
    });
  }

  // Test overview
  const resOverview = await fetch('http://127.0.0.1:4025/api/ai/evolution/overview', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const dataOverview = await resOverview.json();
  console.log('[API OVERVIEW]', 'status:', resOverview.status, 'success:', dataOverview.success);
  console.log('[API STORE DETAILS]', {
    storeName: dataOverview.data?.store?.name,
    attendantName: dataOverview.data?.store?.attendant_name,
    attendantRole: dataOverview.data?.store?.attendant_role,
    themeColor: dataOverview.data?.store?.theme_color,
    address: dataOverview.data?.store?.address,
    attendantConfig: dataOverview.data?.store?.attendant_config
  });
  console.log('[API EVOLUTION STATS]', {
    level: dataOverview.data?.overview?.level,
    xp: dataOverview.data?.overview?.xp,
    totalInteractions: dataOverview.data?.overview?.totalInteractions,
    semanticNodes: dataOverview.data?.overview?.semanticNodes,
    recentLearningsCount: dataOverview.data?.recent_learnings?.length
  });

  const storeId = dataOverview.data?.store?.id || dataOverview.store?.id;
  console.log('[TARGET STORE ID]', storeId);

  // Test store update
  const resUpdateStore = await fetch('http://127.0.0.1:4025/api/ai/history/stores/' + encodeURIComponent(storeId), {
    method: 'PUT',
    headers: { 
      'Content-Agent': 'camila',
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token 
    },
    body: JSON.stringify({
      name: 'Arte Concreto Fábrica & Loja',
      attendant_name: 'Camila Santos',
      attendant_role: 'Especialista em Churrasqueiras & Pré-Moldados',
      theme_color: '#f97316',
      address: 'Rodovia Anhanguera, KM 120 - Americana/SP',
      phone: '19998123456',
      business_hours: 'Seg a Sex: 07:30 às 18:00 | Sábado: 07:30 às 13:00',
      attendant_config: {
        hairColor: '#451a03',
        uniformColor: '#ea580c',
        hasHeadset: true,
        hasIdBadge: true,
        hasGlasses: false,
        officeScene: 'storefront'
      }
    })
  });
  const dataUpdate = await resUpdateStore.json();
  console.log('[API STORE UPDATE]', 'status:', resUpdateStore.status, 'success:', dataUpdate.success, 'updatedStore:', dataUpdate.data?.name);
}

run().catch(console.error);
`;

const proc = spawn('ssh', [
  '-o', 'StrictHostKeyChecking=no',
  'root@209.50.241.22',
  'cd /opt/zapai/backend && node -'
], { stdio: ['pipe', 'inherit', 'inherit'] });

proc.stdin.write(remoteScript);
proc.stdin.end();

proc.on('close', (code) => {
  console.log('Finished with code', code);
});
