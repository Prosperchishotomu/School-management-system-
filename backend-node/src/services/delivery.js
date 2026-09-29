const crypto = require('crypto');
const { query } = require('../config/db');

// Delivery is persisted first. Provider adapters can be enabled with gateway
// environment variables without changing the communication API contract.
async function enqueueMessageDeliveries({ schoolId, conversationId, messageId, senderId, body }) {
  try {
    const recipients = await query(`SELECT cp.user_id, u.role FROM conversation_participants cp
      INNER JOIN users u ON u.id = cp.user_id
      WHERE cp.conversation_id = ? AND cp.user_id <> ? AND u.status = 'active'`, [conversationId, senderId]);
    for (const recipient of recipients) {
      const channels = recipient.role === 'parent' || recipient.role === 'guardian' ? ['sms', 'email'] : ['email'];
      if (process.env.WHATSAPP_GATEWAY_URL) channels.push('whatsapp');
      for (const channel of channels) {
        try {
          await query(`INSERT IGNORE INTO delivery_outbox
            (id, school_id, recipient_id, channel, event_type, reference_id, payload)
            VALUES (?, ?, ?, ?, 'message.created', ?, ?)`, [
            `DLV${crypto.randomBytes(8).toString('hex')}`, schoolId, recipient.user_id,
            channel, messageId, JSON.stringify({ conversation_id: conversationId, message_id: messageId, body })
          ]);
        } catch (error) {
          console.warn(JSON.stringify({ event: 'delivery_enqueue_failed', channel, error: error.message }));
        }
      }
    }
  } catch (error) {
    console.warn(JSON.stringify({ event: 'delivery_recipient_lookup_failed', error: error.message }));
  }
}

module.exports = { enqueueMessageDeliveries };
