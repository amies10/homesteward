-- H1: actual amount paid; D4: contractor the user recorded hiring
ALTER TABLE completed_fixes ADD COLUMN IF NOT EXISTS actual_cost numeric(10,2);
ALTER TABLE completed_fixes ADD COLUMN IF NOT EXISTS hired_contractor jsonb;  -- { "name": text, "phone"?: text, "website"?: text, "mapsUrl"?: text }
