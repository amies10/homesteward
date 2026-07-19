-- Feature 7: property details (one row per user; survives report clears)
CREATE TABLE IF NOT EXISTS property_details (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid REFERENCES auth.users(id) UNIQUE NOT NULL,
  report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
  year_built integer,
  square_feet integer,
  home_style text,
  roof_type text,
  roof_age_years integer,
  hvac_type text,
  hvac_age_years integer,
  foundation_type text,
  bedrooms numeric(3,1),
  bathrooms numeric(3,1),
  other_specs jsonb            -- Array<{ label: string; value: string }>
);
ALTER TABLE property_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_property_details" ON property_details
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Feature 6: toolbox
CREATE TABLE IF NOT EXISTS user_toolbox (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  tool_name text NOT NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','suggested')),
  from_issue text              -- optional "slug-index" provenance
);
CREATE UNIQUE INDEX IF NOT EXISTS user_toolbox_user_tool_uniq
  ON user_toolbox (user_id, lower(tool_name));
ALTER TABLE user_toolbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_user_toolbox" ON user_toolbox
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
