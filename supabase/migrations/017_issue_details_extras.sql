-- E7: persist elaborated step detail, keyed by 0-based step index as a string
ALTER TABLE issue_details ADD COLUMN IF NOT EXISTS step_elaborations jsonb;  -- { "0": "…", "3": "…" }
-- C6: safety framing returned by generate-diy for electrical/gas/structural repairs
ALTER TABLE issue_details ADD COLUMN IF NOT EXISTS safety_warning text;
