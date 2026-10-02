const fs = require('fs');
const path = require('path');
const { ClassicLevel } = require('classic-level');

const LEVELDB_DIR = 'C:\\Users\\Dell\\AppData\\Local\\Temp\\waspeed_leveldb';
const UPLOADS_DIR = path.resolve(__dirname, '../backend/uploads/quick_replies');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function sanitizeFilename(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_.-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 50);
}

function getExtFromMime(mime) {
  if (!mime) return '.bin';
  if (mime.includes('ogg')) return '.ogg';
  if (mime.includes('mpeg') || mime.includes('mp3')) return '.mp3';
  if (mime.includes('png')) return '.png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('mp4')) return '.mp4';
  if (mime.includes('pdf')) return '.pdf';
  return '.bin';
}

function generateAiMetadata(title, category, actionTypes, messages) {
  const normTitle = title.toLowerCase();
  const textJoined = messages.join(' ').toLowerCase();

  let aiMemory = '';
  let tags = [category.toLowerCase()];

  // Specific high-value scripts & products
  if (normTitle.includes('churras')) {
    aiMemory = 'Apresentação completa da Churrasqueira Trio pré-moldada por R$ 990,00 ou até 10x sem juros (ou R$ 940,50 no PIX com 5% de desconto). Envia fotos reais de instalações e clientes. Usar quando o cliente perguntar de churrasqueira, trio ou pedir fotos do produto.';
    tags.push('churrasqueira', 'trio', 'pre-moldada', 'fotos', 'promocao', '990', 'grelha');
  } else if (normTitle.includes('betoneira')) {
    aiMemory = 'Apresentação técnica e comercial da Betoneira CSM 400L por R$ 2.999,00 à vista ou em até 10x de R$ 299,90. Envia foto técnica do equipamento. Usar quando o cliente solicitar cotação ou fotos de betoneira CSM.';
    tags.push('betoneira', 'csm', '400l', 'maquinas', 'obras', '2999', 'equipamentos');
  } else if (normTitle.includes('chale')) {
    aiMemory = 'Apresentação e vídeo do Chalé Container 5x5m habitável com banheiro e varanda. Usar quando o cliente demonstrar interesse em containers habitáveis ou chalés modulares.';
    tags.push('chale', 'container', 'habitavel', 'video', 'modulo', 'estrutura');
  } else if (normTitle.includes('jad')) {
    aiMemory = 'Script oficial de envio e rastreamento via transportadora Jadlog. Informa sobre conferência e acompanhamento pelo app da Jadlog. Usar quando cliente fechar pedido ou pedir informações de entrega por transportadora.';
    tags.push('jadlog', 'rastreio', 'envio', 'transportadora', 'entrega', 'app');
  } else if (normTitle.includes('tijolo') && (normTitle.includes('qualidade') || actionTypes.includes('video'))) {
    aiMemory = 'Vídeo de teste de resistência e qualidade comprovada dos tijolos direto da cerâmica. Usar quando o cliente tiver dúvida se o tijolo quebra fácil ou solicitar comprovação de qualidade.';
    tags.push('tijolo', 'qualidade', 'resistencia', 'video', 'ceramica', 'prova');
  } else if (normTitle.includes('tijolo')) {
    aiMemory = 'Cotação e script de tijolos (8, 9 ou 12 furos) com áudio e cotação de milheiro. Usar para apresentar tijolos e perguntar quantas unidades o cliente precisa.';
    tags.push('tijolo', '8 furos', '9 furos', '12 furos', 'milheiro', 'ceramica', 'unidades');
  } else if (normTitle.includes('cimento') && actionTypes.includes('audio')) {
    aiMemory = 'Áudio explicativo sobre marcas e aplicação de cimento para obra. Usar quando o cliente pedir áudio sobre cimento.';
    tags.push('cimento', 'audio', 'explicacao', 'cp2', 'cp3');
  } else if (normTitle.includes('cimento')) {
    aiMemory = 'Promoção especial de cimento com 30% de desconto a partir de 20 unidades. Envia imagem da promoção. Usar quando cliente cotar cimento.';
    tags.push('cimento', 'promocao', '30 off', '20 unidades', 'sacos');
  } else if (normTitle.includes('bloco') && actionTypes.includes('audio')) {
    aiMemory = 'Áudio explicativo sobre blocos de concreto e estruturais para alvenaria. Usar quando o cliente solicitar detalhes por voz sobre blocos.';
    tags.push('bloco', 'concreto', 'estrutural', 'audio', 'alvenaria');
  } else if (normTitle.includes('bloco')) {
    aiMemory = 'Promoção de blocos com 30% de desconto. Envia imagem com tabela de medidas e modelos. Usar para cotar blocos.';
    tags.push('bloco', 'concreto', 'estrutural', 'promocao', '30 off');
  } else if (normTitle.includes('caixa') || normTitle.includes('cx')) {
    aiMemory = 'Promoção de Caixa d\'água Fortlev 10.000L em polietileno com imagem e condições facilitadas. Usar quando cliente cotar caixa d\'água.';
    tags.push('caixa dagua', 'fortlev', '10000l', 'reservatorio', 'promocao');
  } else if (normTitle.includes('telha black')) {
    aiMemory = 'Vídeo demonstrativo das Telhas Black resinadas de alta resistência e acabamento térmico. Usar quando cliente demonstrar interesse em telhas esmaltadas/black.';
    tags.push('telha', 'telha black', 'esmaltada', 'video', 'cobertura');
  } else if (normTitle.includes('dados entrega')) {
    aiMemory = 'Coleta de dados essenciais para faturamento e logística: Nome completo, CPF/CNPJ, endereço da obra e ponto de referência. Usar na etapa de fechamento de venda.';
    tags.push('fechamento', 'dados', 'entrega', 'cpf', 'cadastro', 'endereco');
  } else if (normTitle.includes('retirada')) {
    aiMemory = 'Pergunta se o cliente prefere receber o material na obra via entrega com caminhão ou fazer retirada direta na loja/depósito.';
    tags.push('entrega', 'retirada', 'loja', 'frete', 'logistica');
  } else if (normTitle.includes('pagamento') || normTitle.includes('pix')) {
    aiMemory = 'Opções de pagamento aceitas: Dinheiro, Cartão (até 10x sem juros), Boleto e PIX da empresa com desconto de 5%. Usar para tirar dúvidas de formas de pagamento.';
    tags.push('pagamento', 'pix', 'cartao', 'parcelamento', 'boleto');
  } else if (normTitle.includes('garantia')) {
    aiMemory = 'Explicação formal sobre garantia de fábrica de todos os produtos e suporte direto do depósito. Usar para superar objeção de confiança ou segurança.';
    tags.push('garantia', 'seguranca', 'confianca', 'qualidade');
  } else if (normTitle.includes('sorteio')) {
    aiMemory = 'Mensagem de participação e premiação do sorteio da loja no Instagram e WhatsApp. Usar em campanhas ou engajamento de sorteios.';
    tags.push('sorteio', 'premio', 'instagram', 'promocao');
  } else if (normTitle.includes('insta') || normTitle.includes('site') || normTitle.includes('catalogo')) {
    aiMemory = 'Links oficiais do Instagram, site e catálogo virtual da loja no WhatsApp. Usar quando o cliente quiser ver o catálogo completo ou redes sociais.';
    tags.push('catalogo', 'instagram', 'site', 'redes sociais', 'links');
  } else {
    const previewText = textJoined ? textJoined.slice(0, 100) : title;
    aiMemory = `Resposta rápida de ${category}: "${title}". Conteúdo: ${previewText}`;
    tags.push(normTitle.replace(/[^a-z0-9]/g, ' '));
  }

  return { aiMemory, tags: Array.from(new Set(tags.filter(Boolean))) };
}

async function main() {
  console.log('Opening LevelDB from', LEVELDB_DIR);
  const db = new ClassicLevel(LEVELDB_DIR, { valueEncoding: 'utf8' });
  await db.open();

  const rawCats = JSON.parse(await db.get('categoria'));
  const catMap = Object.fromEntries(rawCats.map(c => [c.id, c.name]));

  const catNormalize = {
    'SCRIPTS': 'SCRIPTS',
    'PRODUTOS': 'PRODUTOS',
    'CADASTRO': 'CADASTRO & ENTREGA',
    'SORTEIO': 'SORTEIO & PROMOÇÕES',
    'AUDIOS CLIENTES': 'ÁUDIOS DE ATENDIMENTO',
    'ELEVEN': 'ELEVEN',
  };

  const qrList = JSON.parse(await db.get('respostasRapidas'));
  const acaoList = JSON.parse(await db.get('respostasRapidasAcao'));
  const acaoMap = Object.fromEntries(acaoList.map(a => [a.id, a]));

  console.log(`Found ${qrList.length} quick replies and ${acaoList.length} action items.`);

  const processedQuickReplies = [];
  let savedFilesCount = 0;

  for (const qr of qrList) {
    const rawCat = catMap[qr.categoria] || 'ATENDIMENTO GERAL';
    const category = catNormalize[rawCat] || 'ATENDIMENTO GERAL';
    const title = qr.titulo || qr.title || 'Sem Título';
    const id = qr.id;
    const isScript = qr.type === 'script';

    const items = [];
    const messages = [];
    const actionTypes = [];

    if (isScript && Array.isArray(qr.script)) {
      for (let sIdx = 0; sIdx < qr.script.length; sIdx++) {
        const step = qr.script[sIdx];
        const stepAcao = acaoMap[step.id];
        const timerSec = Number(step.timer || 0);

        if (stepAcao && Array.isArray(stepAcao.acao)) {
          for (let aIdx = 0; aIdx < stepAcao.acao.length; aIdx++) {
            const act = stepAcao.acao[aIdx];
            const p = act.propriedades || {};
            const actType = act.type || 'text';
            actionTypes.push(actType);

            if (p.mensagem) {
              messages.push(p.mensagem);
              items.push({
                type: 'text',
                value: p.mensagem,
                delay: timerSec * 1000,
                delayMs: timerSec * 1000,
              });
            }

            if (p.base64) {
              const mimeMatch = p.base64.match(/^data:([^;]+);base64,/);
              const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
              const ext = getExtFromMime(mime);
              const filename = `${sanitizeFilename(title)}_step${sIdx + 1}_${aIdx + 1}${ext}`;
              const filePath = path.join(UPLOADS_DIR, filename);

              const b64Data = p.base64.replace(/^data:[^;]+;base64,/, '');
              fs.writeFileSync(filePath, Buffer.from(b64Data, 'base64'));
              savedFilesCount++;

              items.push({
                type: actType === 'audio' ? 'audio' : (actType === 'video' ? 'video' : 'image'),
                value: `/uploads/quick_replies/${filename}`,
                filename,
                caption: p.mensagem || '',
                delay: timerSec * 1000,
                delayMs: timerSec * 1000,
              });
            }
          }
        }
      }
    } else {
      const acaoObj = acaoMap[id];
      if (acaoObj && Array.isArray(acaoObj.acao)) {
        for (let aIdx = 0; aIdx < acaoObj.acao.length; aIdx++) {
          const act = acaoObj.acao[aIdx];
          const p = act.propriedades || {};
          const actType = act.type || 'text';
          actionTypes.push(actType);

          if (p.mensagem) {
            messages.push(p.mensagem);
            items.push({
              type: 'text',
              value: p.mensagem,
              delay: (p.aguarde || 0) * 1000,
              delayMs: (p.aguarde || 0) * 1000,
            });
          }

          if (p.base64) {
            const mimeMatch = p.base64.match(/^data:([^;]+);base64,/);
            const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
            const ext = getExtFromMime(mime);
            const filename = `${sanitizeFilename(title)}_${aIdx + 1}${ext}`;
            const filePath = path.join(UPLOADS_DIR, filename);

            const b64Data = p.base64.replace(/^data:[^;]+;base64,/, '');
            fs.writeFileSync(filePath, Buffer.from(b64Data, 'base64'));
            savedFilesCount++;

            items.push({
              type: actType === 'audio' ? 'audio' : (actType === 'video' ? 'video' : 'image'),
              value: `/uploads/quick_replies/${filename}`,
              filename,
              caption: p.mensagem || '',
              delay: (p.aguarde || 0) * 1000,
              delayMs: (p.aguarde || 0) * 1000,
            });
          }
        }
      }
    }

    // Determine primary content and media
    const primaryText = messages.join('\n\n') || (items.find(i => i.type === 'text')?.value || '');
    const firstMedia = items.find(i => i.type && i.type !== 'text');
    const { aiMemory, tags } = generateAiMetadata(title, category, actionTypes, messages);

    const record = {
      id,
      company_id: 'default',
      title,
      category,
      tags,
      aiMemory,
      content: primaryText,
      items,
      steps: isScript ? qr.script : [],
      isFlow: isScript,
      mediaUrl: firstMedia ? firstMedia.value : null,
      mediaType: firstMedia ? firstMedia.type : null,
      filename: firstMedia ? firstMedia.filename : null,
      favorite: ['CHURRAS', 'BETONEIRA', 'SCRIPT TIJOLO', 'SCRIPT CIMENTO', 'unidades', 'DADOS ENTREGA'].includes(title),
    };

    processedQuickReplies.push(record);
  }

  await db.close();

  console.log(`Processed ${processedQuickReplies.length} quick replies.`);
  console.log(`Saved ${savedFilesCount} media files to ${UPLOADS_DIR}`);

  // Save JSON bundle
  const bundlePath = path.resolve(__dirname, 'waspeed_ready_bundle.json');
  fs.writeFileSync(bundlePath, JSON.stringify(processedQuickReplies, null, 2), 'utf8');
  console.log('Saved bundle to', bundlePath);

  // Group by category
  const catsCount = {};
  for (const r of processedQuickReplies) {
    catsCount[r.category] = (catsCount[r.category] || 0) + 1;
  }
  console.log('Breakdown by Category:', catsCount);
}

main().catch(console.error);
