create table if not exists reports (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  raw_sections jsonb not null,
  pdf_filename text
);

create table if not exists completed_fixes (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  report_id uuid references reports(id) on delete cascade not null,
  section_slug text not null,
  issue_index integer not null,
  fixed_by text not null check (fixed_by in ('me', 'professional')),
  difficulty_rating integer check (difficulty_rating between 1 and 5),
  completed_at timestamptz not null,
  unique (report_id, section_slug, issue_index)
);
