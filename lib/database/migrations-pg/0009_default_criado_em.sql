-- Colunas de data definidas como text tinham default 'now()' (texto literal): gravavam a string "now()".
-- Troca o default por timestamp ISO UTC e corrige os valores já gravados com o literal.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'text' AND column_default LIKE '%now()%'
  LOOP
    EXECUTE format(
      'UPDATE %I SET %I = to_char(now() at time zone ''utc'', ''YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'') WHERE %I = ''now()''',
      r.table_name, r.column_name, r.column_name);
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I SET DEFAULT (to_char(now() at time zone ''utc'', ''YYYY-MM-DD"T"HH24:MI:SS.MS"Z"''))',
      r.table_name, r.column_name);
  END LOOP;
END $$;
