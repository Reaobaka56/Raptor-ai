-- Repair jsonb values that were stored as a JSON *string* containing JSON text
-- (caused by pre-serialized json.dumps() params passing through the jsonb
-- codec's own json.dumps). Converts them to real objects/arrays so server-side
-- jsonb operators (jsonb_array_elements, ||, ->>) work. Idempotent.
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND data_type = 'jsonb'
    LOOP
        BEGIN
            EXECUTE format(
                $f$UPDATE %I SET %I = (%I #>> '{}')::jsonb
                   WHERE jsonb_typeof(%I) = 'string' AND (%I #>> '{}') ~ '^\s*[\[{]'$f$,
                r.table_name, r.column_name, r.column_name, r.column_name, r.column_name);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'skipped %.%: %', r.table_name, r.column_name, SQLERRM;
        END;
    END LOOP;
END$$;
