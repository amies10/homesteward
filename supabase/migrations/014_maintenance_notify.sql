-- Push-notification preference per task. No delivery mechanism yet — this is
-- scaffolding so the data model is ready when the app is installed as a PWA.
ALTER TABLE user_maintenance_tasks ADD COLUMN IF NOT EXISTS notify boolean NOT NULL DEFAULT false;
