/**
 * ============================================================================
 * BUILD VALIDATOR
 * ============================================================================
 * 
 * Valida o build para garantir consistência.
 * Se bundle divergir, bloquear deploy.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BUILD_ID_FILE = path.join(__dirname, '../dist/build-id.json');
const EXPECTED_BUNDLES = [
  'index.html',
  'assets/index-',
  'assets/vendor-',
  'assets/ui-',
  'assets/query-',
  'assets/charts-',
];

function calculateFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function generateBuildId() {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${random}`;
}

function validateBuild() {
  const distPath = path.join(__dirname, '../dist');

  if (!fs.existsSync(distPath)) {
    console.error('❌ Erro: Diretório dist não encontrado');
    process.exit(1);
  }

  const files = fs.readdirSync(distPath, { recursive: true });
  const buildId = generateBuildId();

  console.log('🔍 Validando build...');
  console.log(`📦 Build ID: ${buildId}`);
  console.log(`📁 Arquivos encontrados: ${files.length}`);

  // Verificar arquivos essenciais
  const indexHtmlPath = path.join(distPath, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    console.error('❌ Erro: index.html não encontrado');
    process.exit(1);
  }

  const indexHtmlHash = calculateFileHash(indexHtmlPath);
  console.log(`✅ index.html: ${indexHtmlHash.substring(0, 16)}...`);

  // Verificar assets com hash
  const assetsPath = path.join(distPath, 'assets');
  if (!fs.existsSync(assetsPath)) {
    console.error('❌ Erro: Diretório assets não encontrado');
    process.exit(1);
  }

  const assetFiles = fs.readdirSync(assetsPath);
  const hashedAssets = assetFiles.filter(f => f.includes('.'));

  console.log(`✅ Assets com hash: ${hashedAssets.length}`);

  // Verificar se todos os bundles esperados existem
  for (const bundle of EXPECTED_BUNDLES) {
    const found = assetFiles.some(f => f.startsWith(bundle.replace('assets/', '')));
    if (!found) {
      console.error(`❌ Erro: Bundle esperado não encontrado: ${bundle}`);
      process.exit(1);
    }
    console.log(`✅ Bundle encontrado: ${bundle}*`);
  }

  // Salvar build ID
  const buildIdContent = {
    id: buildId,
    timestamp: new Date().toISOString(),
    indexHtmlHash,
    assetCount: hashedAssets.length,
    files: files.map(f => ({
      path: f,
      hash: fs.existsSync(path.join(distPath, f)) ? calculateFileHash(path.join(distPath, f)) : null
    }))
  };

  fs.writeFileSync(BUILD_ID_FILE, JSON.stringify(buildIdContent, null, 2));

  console.log('\n✅ Build validado com sucesso');
  console.log(`📄 Build ID salvo em: ${BUILD_ID_FILE}`);
  console.log('\n📊 Resumo:');
  console.log(`   - Build ID: ${buildId}`);
  console.log(`   - Arquivos: ${files.length}`);
  console.log(`   - Assets: ${hashedAssets.length}`);
  console.log(`   - Index hash: ${indexHtmlHash.substring(0, 16)}...`);

  return buildId;
}

function compareBuilds() {
  if (!fs.existsSync(BUILD_ID_FILE)) {
    console.log('⚠️  Nenhum build anterior encontrado');
    return null;
  }

  const previousBuild = JSON.parse(fs.readFileSync(BUILD_ID_FILE, 'utf-8'));
  const currentBuild = validateBuild();

  if (previousBuild.indexHtmlHash !== currentBuild.indexHtmlHash) {
    console.log('\n⚠️  Bundle divergente detectado');
    console.log(`   Anterior: ${previousBuild.indexHtmlHash.substring(0, 16)}...`);
    console.log(`   Atual: ${currentBuild.indexHtmlHash.substring(0, 16)}...`);
    console.log('\n❌ Deploy bloqueado: bundle divergente');
    process.exit(1);
  }

  console.log('\n✅ Build consistente com versão anterior');
  return currentBuild;
}

// Executar validação
const mode = process.argv[2];

if (mode === '--compare') {
  compareBuilds();
} else {
  validateBuild();
}
