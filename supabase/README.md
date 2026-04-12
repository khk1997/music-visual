# Supabase leaderboard setup

1. Open the Supabase SQL editor.
2. Run `supabase/rhythm_leaderboard.sql`.
3. Copy your project URL and anon key into `window.__SUPABASE_CONFIG__` in `index.html`.

If those values are left blank, the game keeps using the local fallback leaderboard.

The rhythm leaderboard is split by level, so `1-1`, `1-2`, and other levels each store and query their own `level_id` rows.
