module.exports = {
  version: '029_remove_invalid_media_placeholders',
  description: 'Remove invalid empty media placeholders created from WhatsApp protocol events',
  up: async (client) => {
    await client.query("DELETE FROM messages WHERE LOWER(COALESCE(media_type, type, '')) = 'media' AND BTRIM(COALESCE(content, '')) IN ('', '[media]') AND BTRIM(COALESCE(media_path, '')) = '' AND BTRIM(COALESCE(whatsapp_message_id, '')) = '';");
  },
};