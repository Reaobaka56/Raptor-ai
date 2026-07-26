-- =============================================================================
-- Raptor AI — Chat Messages Schema
-- =============================================================================

CREATE TABLE IF NOT EXISTS chat_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    read        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_sender   ON chat_messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_receiver ON chat_messages (receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_thread   ON chat_messages (
    LEAST(sender_id, receiver_id),
    GREATEST(sender_id, receiver_id),
    created_at DESC
);

-- Conversations view: unique pairs with latest message
CREATE OR REPLACE VIEW chat_conversations AS
SELECT DISTINCT ON (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id))
    id,
    sender_id,
    receiver_id,
    content,
    read,
    created_at,
    LEAST(sender_id, receiver_id) AS user_a,
    GREATEST(sender_id, receiver_id) AS user_b
FROM chat_messages
ORDER BY
    LEAST(sender_id, receiver_id),
    GREATEST(sender_id, receiver_id),
    created_at DESC;
