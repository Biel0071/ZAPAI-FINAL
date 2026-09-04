const fs = require('fs');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

async function extractTextFromFile(filePath, mimeType) {
  try {
    if (mimeType === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      return data.text;
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      mimeType === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } else if (mimeType === 'text/plain') {
      return fs.readFileSync(filePath, 'utf8');
    }
    throw new Error('Formato de arquivo não suportado. Use PDF, DOCX ou TXT.');
  } catch (error) {
    console.error('Erro ao extrair texto do arquivo:', error);
    throw new Error('Falha ao processar o arquivo de contexto.');
  }
}

module.exports = {
  extractTextFromFile,
};
