-- Permissive RLS policies for anon access (pre-auth development)
-- Replace these with user-scoped policies when auth is added.

-- reports
create policy "anon_all_reports"
  on reports
  for all
  to anon
  using (true)
  with check (true);

-- completed_fixes
create policy "anon_all_completed_fixes"
  on completed_fixes
  for all
  to anon
  using (true)
  with check (true);
