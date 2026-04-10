-- Run this once in the Supabase SQL editor.
-- It creates the shared leaderboard table, enables public read/insert, and turns on Realtime.

create extension if not exists pgcrypto;

create table if not exists public.rhythm_leaderboard (
    id uuid primary key default gen_random_uuid(),
    player_id text not null,
    score integer not null default 0,
    result text not null default '-',
    created_at timestamptz not null default now()
);

alter table public.rhythm_leaderboard enable row level security;

drop policy if exists "Public can read rhythm leaderboard" on public.rhythm_leaderboard;
create policy "Public can read rhythm leaderboard"
on public.rhythm_leaderboard
for select
using (true);

drop policy if exists "Public can add rhythm leaderboard" on public.rhythm_leaderboard;
create policy "Public can add rhythm leaderboard"
on public.rhythm_leaderboard
for insert
with check (true);

alter table public.rhythm_leaderboard replica identity full;
alter publication supabase_realtime add table public.rhythm_leaderboard;
