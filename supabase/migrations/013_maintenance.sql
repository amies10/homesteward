CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  description text,
  category text,                      -- aligns with section slugs where sensible
  default_recurrence_months integer NOT NULL
);
ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_maintenance_tasks" ON maintenance_tasks
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS user_maintenance_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  task_id uuid REFERENCES maintenance_tasks(id),   -- null => custom task
  custom_name text,
  custom_description text,
  recurrence_months integer NOT NULL CHECK (recurrence_months BETWEEN 1 AND 60),
  anchor_date date NOT NULL DEFAULT current_date,  -- basis for first due date when no logs exist
  active boolean NOT NULL DEFAULT true,
  CHECK (task_id IS NOT NULL OR custom_name IS NOT NULL),
  UNIQUE (user_id, task_id)
);
ALTER TABLE user_maintenance_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_user_maintenance_tasks" ON user_maintenance_tasks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Completion history — required so past days render green and day detail shows history
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  user_task_id uuid REFERENCES user_maintenance_tasks(id) ON DELETE CASCADE NOT NULL,
  completed_on date NOT NULL DEFAULT current_date,  -- local YYYY-MM-DD from client
  notes text
);
CREATE INDEX IF NOT EXISTS maintenance_logs_task_idx
  ON maintenance_logs (user_task_id, completed_on DESC);
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_maintenance_logs" ON maintenance_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO maintenance_tasks (name, description, category, default_recurrence_months) VALUES
  ('Replace HVAC filter', 'Swap the furnace/AC filter; size is printed on the frame.', 'hvac', 3),
  ('Test smoke & CO detectors', 'Press the test button on every unit; replace batteries yearly.', 'electrical', 6),
  ('Clean gutters & downspouts', 'Clear leaves and debris; check water flows away from the foundation.', 'exterior', 6),
  ('Flush water heater', 'Drain sediment from the tank to extend life and efficiency.', 'plumbing', 12),
  ('Service HVAC system', 'Professional tune-up of furnace and AC.', 'hvac', 12),
  ('Inspect roof from ground', 'Look for lifted/missing shingles and damaged flashing.', 'roofing', 6),
  ('Clean range hood filter', 'Degrease the metal filter in the dishwasher or hot soapy water.', 'appliances', 3),
  ('Clean dryer vent duct', 'Clear lint from the full exterior duct run, not just the trap.', 'appliances', 12),
  ('Test GFCI outlets', 'Press test/reset on each GFCI in kitchen, baths, garage, exterior.', 'electrical', 6),
  ('Check water softener salt', 'Top up salt if below half.', 'plumbing', 3),
  ('Inspect caulking & grout', 'Check tubs, showers, sinks; re-caulk gaps before water gets behind.', 'bathrooms', 6),
  ('Run water in unused drains', 'Pour water into rarely used drains so the traps don''t dry out.', 'plumbing', 3),
  ('Check sump pump', 'Pour a bucket of water into the pit; confirm the pump kicks on.', 'structure', 6),
  ('Inspect foundation & grading', 'Walk the perimeter; look for new cracks and soil settling toward the house.', 'structure', 12),
  ('Winterize exterior faucets', 'Disconnect hoses; shut off and drain exterior spigots before first freeze.', 'exterior', 12),
  ('Clean refrigerator coils', 'Vacuum the coils under/behind the fridge.', 'appliances', 12),
  ('Deep-clean garbage disposal', 'Ice cubes + citrus peel; check for leaks underneath.', 'plumbing', 6),
  ('Check attic for leaks & pests', 'After heavy rain, scan for staining, wet insulation, droppings.', 'attic-insulation', 12),
  ('Test garage door auto-reverse', 'Place an object under the door; it must reverse on contact.', 'exterior', 6),
  ('Replace water filter cartridges', 'Fridge and under-sink filters per manufacturer interval.', 'appliances', 6)
ON CONFLICT (name) DO NOTHING;
