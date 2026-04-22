const EMOJI_REGEX = /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/gu;

function extractEmojis(text = '') {
  return String(text).match(EMOJI_REGEX) || [];
}

module.exports = {
  extractEmojis,
};