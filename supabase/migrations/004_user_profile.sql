-- Named 004 because 003_ignored_issues.sql already exists.

create table if not exists user_profile (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  skill_level text not null check (skill_level in ('beginner', 'some_experience', 'experienced', 'expert')),
  location text not null,
  onboarding_completed boolean default false not null
);

alter table user_profile enable row level security;

create policy "anon_all_user_profile"
  on user_profile
  for all
  to anon
  using (true)
  with check (true);
