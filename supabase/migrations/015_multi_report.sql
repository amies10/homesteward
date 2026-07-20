-- B1/B2: multi-report support. reports already allows multiple rows per user;
-- these columns let the UI label each report's issues and surface parser notes.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS document_type text;  -- e.g. 'Home Inspection', 'Contractor Assessment'
ALTER TABLE reports ADD COLUMN IF NOT EXISTS parser_note text;    -- best-effort-parse note shown to the user
