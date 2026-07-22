/**
 * ZAPFLOW AI Voices Engine Service
 * Manages official ZAPFLOW neural voice profiles and parameter synthesis settings.
 */

const SYSTEM_VOICES = [
  // Feminine Voices
  {
    id: 'zapflow-aurora',
    name: 'ZAPFLOW Aurora',
    gender: 'female',
    role: 'Especialista Comercial',
    description: 'Tom firme, elegante e consultivo. Alta persuasão para fechamentos B2B.',
    defaultParams: {
      speed: 1.0,
      pitch: 0,
      intonation: 0.85,
      naturalness: 0.95,
      breath: 0.4,
      expressiveness: 0.8,
      emphasis: 0.75,
      stability: 0.85,
      pronunciation: 0.95,
      pauses: 0.3,
    },
  },
  {
    id: 'zapflow-luna',
    name: 'ZAPFLOW Luna',
    gender: 'female',
    role: 'Jovem & Dinâmica',
    description: 'Tom leve, moderno e enérgico. Excelente para varejo e engajamento rápido.',
    defaultParams: {
      speed: 1.1,
      pitch: 2,
      intonation: 0.9,
      naturalness: 0.9,
      breath: 0.5,
      expressiveness: 0.9,
      emphasis: 0.8,
      stability: 0.8,
      pronunciation: 0.9,
      pauses: 0.2,
    },
  },
  {
    id: 'zapflow-sophia',
    name: 'ZAPFLOW Sophia',
    gender: 'female',
    role: 'Executiva',
    description: 'Tom formal, articulado e corporativo. Ideal para empresas de grande porte.',
    defaultParams: {
      speed: 0.95,
      pitch: -1,
      intonation: 0.8,
      naturalness: 0.98,
      breath: 0.3,
      expressiveness: 0.7,
      emphasis: 0.7,
      stability: 0.95,
      pronunciation: 0.98,
      pauses: 0.4,
    },
  },
  {
    id: 'zapflow-maya',
    name: 'ZAPFLOW Maya',
    gender: 'female',
    role: 'Acolhedora',
    description: 'Tom empático, calmo e receptivo. Perfeito para pós-vendas e atendimento.',
    defaultParams: {
      speed: 0.95,
      pitch: 1,
      intonation: 0.85,
      naturalness: 0.96,
      breath: 0.6,
      expressiveness: 0.85,
      emphasis: 0.65,
      stability: 0.9,
      pronunciation: 0.95,
      pauses: 0.4,
    },
  },

  // Masculine Voices
  {
    id: 'zapflow-orion',
    name: 'ZAPFLOW Orion',
    gender: 'male',
    role: 'Consultor',
    description: 'Tom equilibrado, seguro e didático. Alta confiabilidade comercial.',
    defaultParams: {
      speed: 1.0,
      pitch: 0,
      intonation: 0.85,
      naturalness: 0.95,
      breath: 0.4,
      expressiveness: 0.75,
      emphasis: 0.8,
      stability: 0.9,
      pronunciation: 0.95,
      pauses: 0.3,
    },
  },
  {
    id: 'zapflow-atlas',
    name: 'ZAPFLOW Atlas',
    gender: 'male',
    role: 'Executivo',
    description: 'Tom grave, sério e de autoridade. Excelente para negociações corporativas.',
    defaultParams: {
      speed: 0.95,
      pitch: -3,
      intonation: 0.8,
      naturalness: 0.97,
      breath: 0.3,
      expressiveness: 0.7,
      emphasis: 0.85,
      stability: 0.95,
      pronunciation: 0.97,
      pauses: 0.4,
    },
  },
  {
    id: 'zapflow-noah',
    name: 'ZAPFLOW Noah',
    gender: 'male',
    role: 'Jovem',
    description: 'Tom descontraído, amigável e conversacional. Ótimo para público jovem.',
    defaultParams: {
      speed: 1.05,
      pitch: 1,
      intonation: 0.9,
      naturalness: 0.92,
      breath: 0.5,
      expressiveness: 0.85,
      emphasis: 0.75,
      stability: 0.85,
      pronunciation: 0.92,
      pauses: 0.25,
    },
  },
  {
    id: 'zapflow-titan',
    name: 'ZAPFLOW Titan',
    gender: 'male',
    role: 'Premium',
    description: 'Tom imponente, marcante e aveludado. Projetado para marcas de luxo e alto ticket.',
    defaultParams: {
      speed: 0.9,
      pitch: -4,
      intonation: 0.85,
      naturalness: 0.98,
      breath: 0.4,
      expressiveness: 0.8,
      emphasis: 0.9,
      stability: 0.98,
      pronunciation: 0.98,
      pauses: 0.5,
    },
  },
];

// In-memory voice profiles per company/agent
const customProfiles = new Map();

function listVoices() {
  return SYSTEM_VOICES;
}

function getVoiceById(id) {
  return SYSTEM_VOICES.find((v) => v.id === id || v.name === id) || SYSTEM_VOICES[0];
}

function saveVoiceProfile({ agentId, voiceId, params, companyId = 'default' }) {
  const key = `${companyId}:${agentId || 'default'}`;
  const profile = {
    agentId,
    voiceId,
    params,
    updatedAt: new Date().toISOString(),
  };
  customProfiles.set(key, profile);
  return profile;
}

function getVoiceProfile(agentId, companyId = 'default') {
  const key = `${companyId}:${agentId || 'default'}`;
  return customProfiles.get(key) || null;
}

/**
 * Synthesizes test preview audio parameter payload
 */
async function synthesizeVoicePreview({ voiceId, text, params }) {
  const voice = getVoiceById(voiceId);
  const sampleText = text || `Olá! Eu sou ${voice.name}, especialista ${voice.role}. Como posso ajudar suas vendas hoje?`;

  return {
    success: true,
    data: {
      voiceId: voice.id,
      voiceName: voice.name,
      role: voice.role,
      sampleText,
      appliedParams: params || voice.defaultParams,
      // Sample audio metadata payload
      audioFormat: 'mp3',
      sampleRate: 44100,
      durationSeconds: Math.ceil(sampleText.length / 15),
      generatedAt: new Date().toISOString(),
    },
  };
}

module.exports = {
  SYSTEM_VOICES,
  listVoices,
  getVoiceById,
  saveVoiceProfile,
  getVoiceProfile,
  synthesizeVoicePreview,
};
