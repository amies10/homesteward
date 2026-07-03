-- Stores lazily-generated per-issue content (DIY plan, contractor briefing).
-- Populated on demand, not at parse time.

create table if not exists issue_details (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  report_id uuid references reports(id) on delete cascade not null,
  section_slug text not null,
  issue_index integer not null,
  materials_list jsonb,        -- Array<{ item: string; estimatedCost: string }>
  step_by_step_plan jsonb,     -- string[]
  contractor_briefing text,    -- Expert prep guide (generated on demand)
  unique (report_id, section_slug, issue_index)
);

alter table issue_details enable row level security;

create policy "anon_all_issue_details"
  on issue_details
  for all
  to anon
  using (true)
  with check (true);
