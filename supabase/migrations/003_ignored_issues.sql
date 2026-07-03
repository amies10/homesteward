create table if not exists ignored_issues (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  report_id uuid references reports(id) on delete cascade not null,
  section_slug text not null,
  issue_index integer not null,
  unique (report_id, section_slug, issue_index)
);

create policy "anon_all_ignored_issues"
  on ignored_issues
  for all
  to anon
  using (true)
  with check (true);
