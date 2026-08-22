-- =============================================================================
-- Raptor AI — One-time cleanup of sandbox sessions stuck in 'starting'
-- =============================================================================
-- Root cause (fixed in sandbox_service.create_session): failures during
-- workspace setup / the running-status UPDATE were silently swallowed, so
-- rows landed in 'starting' and never moved. That code path now marks
-- failures as 'error' explicitly and logs why. This migration sweeps the
-- pre-existing backlog so it doesn't count against users' daily session
-- limits or show up as permanently "loading" in the UI.

-- Log the sweep as a sandbox event before the UPDATE, one per affected
-- session, so there's an audit trail for what this migration touched.
INSERT INTO sandbox_events (session_id, event_type, severity, payload)
SELECT id, 'system', 'warning',
       jsonb_build_object(
         'message', 'Session marked as error by one-time stuck-session cleanup migration (012)',
         'was_status', 'starting',
         'stuck_since', created_at
       )
FROM sandbox_sessions
WHERE status = 'starting'
  AND created_at < now() - interval '1 hour';

-- Anything still 'starting' after 1 hour is dead — a healthy session moves
-- to 'running' within seconds of creation. ended_at records when we closed
-- it out, for anyone auditing the sweep later.
UPDATE sandbox_sessions
SET status = 'error',
    ended_at = now()
WHERE status = 'starting'
  AND created_at < now() - interval '1 hour';
