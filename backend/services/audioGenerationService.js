const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { exec } = require('child_process');
const { query } = require('../config/database');

const PROJECT_ROOT = path.join(__dirname, '..');
const MEDIA_ROOT = path.resolve(PROJECT_ROOT, 'storage', 'media');
const CACHE_DIR = path.join(MEDIA_ROOT, 'audio_cache');
const TEMP_DIR = path.join(MEDIA_ROOT, 'temp_audio');

const IV_LENGTH = 16;

function getEncryptionKey() {
  const rawKey = process.env.ENCRYPTION_KEY || '';
  return crypto.createHash('sha256').update(rawKey).digest();
}

function decrypt(text) {
  if (!text) return '';
  if (!text.includes(':')) {
    return text;
  }
  const currentKey = getEncryptionKey();
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', currentKey, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    try {
      const legacyKey = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'ZAPFLOW_SECURE_SALT_KEY_2026').digest();
      const parts = text.split(':');
      const iv = Buffer.from(parts.shift(), 'hex');
      const encryptedText = Buffer.from(parts.join(':'), 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', legacyKey, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch (legacyErr) {
      return text;
    }
  }
}

async function ensureDirectories() {
  await fs.mkdir(MEDIA_ROOT, { recursive: true }).catch(() => {});
  await fs.mkdir(CACHE_DIR, { recursive: true }).catch(() => {});
  await fs.mkdir(TEMP_DIR, { recursive: true }).catch(() => {});
}

async function getVoiceSettingsFromDb(companyId) {
  const resolvedCompanyId = companyId || 'default';
  const { rows } = await query(
    `SELECT * FROM provider_keys WHERE tenant_id = $1 AND provider = 'elevenlabs' AND enabled = TRUE LIMIT 1`,
    [resolvedCompanyId]
  );
  if (rows.length === 0) {
    return null;
  }
  const dbRow = rows[0];
  const settings = dbRow.settings || {};
  return {
    apiKey: decrypt(dbRow.api_key),
    voiceId: settings.voice_id || '21m00Tcm4TlvDq8ikWAM', // Default Rachel
    model: settings.model || 'eleven_multilingual_v2',
    stability: typeof settings.stability === 'number' ? settings.stability : 0.5,
    similarityBoost: typeof settings.similarity_boost === 'number' ? settings.similarity_boost : 0.75,
    style: typeof settings.style === 'number' ? settings.style : 0.0,
    useSpeakerBoost: settings.use_speaker_boost !== false,
    voiceRule: settings.voice_rule || 'always',
  };
}

async function generateVoice({ text, companyId, customVoiceSettings }) {
  if (!text || !text.trim()) {
    throw new Error('Text to speech input cannot be empty.');
  }

  const cleanText = text.trim();
  const companyDir = companyId || 'default';
  await ensureDirectories();

  // 1. Check Cache
  const md5 = crypto.createHash('md5').update(cleanText).digest('hex');
  const cacheOggPath = path.join(CACHE_DIR, `${md5}.ogg`);

  let cacheExists = false;
  try {
    await fs.access(cacheOggPath);
    cacheExists = true;
  } catch {
    cacheExists = false;
  }

  const tenantAudioFolder = path.join(MEDIA_ROOT, companyDir, 'audios');
  await fs.mkdir(tenantAudioFolder, { recursive: true }).catch(() => {});
  const messageId = crypto.randomUUID();
  const destinationOggPath = path.join(tenantAudioFolder, `${Date.now()}-${messageId}.ogg`);

  if (cacheExists) {
    console.log(`[AUDIO_GEN] Cache hit for text hash ${md5}`);
    await fs.copyFile(cacheOggPath, destinationOggPath);
    const relativeUrl = `/media/${companyDir}/audios/${path.basename(destinationOggPath)}`;
    return {
      success: true,
      url: relativeUrl,
      filePath: destinationOggPath,
      fromCache: true,
    };
  }

  // 2. Fetch Voice Settings
  const settings = customVoiceSettings || (await getVoiceSettingsFromDb(companyId)) || {};
  let ttsProvider = settings.voiceProvider || 'default';
  const voiceGender = settings.voiceGender || 'female';
  const voiceName = voiceGender === 'male' ? 'pt-BR-AntonioNeural' : 'pt-BR-FranciscaNeural';

  // Cap text length to prevent overuse
  const cappedText = cleanText.substring(0, 1000);
  const tempMp3Path = path.join(TEMP_DIR, `${messageId}.mp3`);

  let generated = false;

  if (ttsProvider === 'elevenlabs' && settings.apiKey) {
    try {
      // 3. Request ElevenLabs TTS API
      const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${settings.voiceId || '21m00Tcm4TlvDq8ikWAM'}`;
      console.log(`[AUDIO_GEN] Calling ElevenLabs TTS for text: "${cappedText.substring(0, 50)}..."`);
      
      const response = await axios.post(
        ttsUrl,
        {
          text: cappedText,
          model_id: settings.model || 'eleven_multilingual_v2',
          voice_settings: {
            stability: typeof settings.stability === 'number' ? settings.stability : 0.5,
            similarity_boost: typeof settings.similarityBoost === 'number' ? settings.similarityBoost : 0.75,
            style: typeof settings.style === 'number' ? settings.style : 0.0,
            use_speaker_boost: settings.useSpeakerBoost !== false,
          },
        },
        {
          headers: {
            'xi-api-key': settings.apiKey,
            'content-type': 'application/json',
          },
          responseType: 'arraybuffer',
          timeout: 20000,
        }
      );

      const mp3Buffer = Buffer.from(response.data);
      await fs.writeFile(tempMp3Path, mp3Buffer);
      generated = true;
    } catch (elevenLabsErr) {
      console.error('[AUDIO_GEN] ElevenLabs generation failed, falling back to default Edge TTS:', elevenLabsErr.message);
      ttsProvider = 'default';
    }
  }

  if (!generated) {
    console.log(`[AUDIO_GEN] Generating default Edge TTS (${voiceName}) for text: "${cappedText.substring(0, 50)}..."`);
    try {
      const { EdgeTTS } = require('edge-tts-universal');
      const tts = new EdgeTTS();
      await tts.ttsPromise({
        text: cappedText,
        voice: voiceName,
        outputFile: tempMp3Path,
      });
      generated = true;
    } catch (edgeTtsErr) {
      console.error('[AUDIO_GEN] Default Edge TTS generation failed:', edgeTtsErr.message);
      throw new Error(`Voice generation failed: ${edgeTtsErr.message}`);
    }
  }

  // 4. Convert using ffmpeg
  console.log(`[AUDIO_GEN] Converting MP3 to OGG/Opus with ffmpeg`);
  await new Promise((resolve, reject) => {
    exec(
      `ffmpeg -y -i "${tempMp3Path}" -c:a libopus -application voip "${cacheOggPath}"`,
      (err, stdout, stderr) => {
        if (err) {
          console.error('[AUDIO_GEN] ffmpeg conversion failed:', err.message, stderr);
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });

  // Clean up temporary MP3
  await fs.unlink(tempMp3Path).catch(() => {});

  // Copy to destination
  await fs.copyFile(cacheOggPath, destinationOggPath);

  const relativeUrl = `/media/${companyDir}/audios/${path.basename(destinationOggPath)}`;
  return {
    success: true,
    url: relativeUrl,
    filePath: destinationOggPath,
    fromCache: false,
  };
}

module.exports = {
  generateVoice,
  getVoiceSettingsFromDb,
};
