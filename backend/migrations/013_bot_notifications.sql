-- =============================================================================
-- Raptor AI — Bot notification metadata, unsubscribe preferences, bot avatar
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. CHAT MESSAGE METADATA — structured payload alongside the plain-text
--    content, so the frontend can render rich affordances (a "View Meeting"
--    button, a "View PR" link) without parsing message text. NULL for
--    ordinary human messages; bot messages set {"type": ..., ...}.
-- ---------------------------------------------------------------------------
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS metadata JSONB;

-- ---------------------------------------------------------------------------
-- 2. NOTIFICATION PREFERENCES — per-user opt-out of specific Raptor Bot
--    notification types. Stored as a JSONB map of {notification_type: bool}.
--    Absence of a key means "enabled" (default-on), so existing users don't
--    need a backfill row per type when a new notification type ships later.
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- 3. BOT AVATAR — give raptor-bot a real avatar_url so it doesn't render as
--    a blank/initial avatar in Chat. Served from the frontend's public
--    assets (same asset as the site favicon), same origin as the app.
-- ---------------------------------------------------------------------------
UPDATE users SET avatar_url = '/raptor-bot.svg' WHERE username = 'raptor-bot' AND avatar_url IS NULL;
