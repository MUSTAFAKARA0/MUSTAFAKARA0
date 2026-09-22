# BREAKLINE — Database (Phase 8 — NOT STARTED)

No database exists yet — the game is fully offline (see SAVE_SYSTEM.md).
This is the intended Supabase/Postgres schema for when Phase 8 starts, kept
here so future work has a target without needing a live project today.

```
profiles              (user_id, username, avatar, created_at)
player_settings       (user_id, audio/haptics/sensitivity — mirrors SettingsManager.to_dict())
player_progress       (user_id, best_score, best_distance, best_combo,
                        total_coins, total_runs, unlocked_levels[] — mirrors SaveManager.data)
inventory              (user_id, item_id, equipped)
items                  (item_id, name, type, unlock_condition)
daily_challenges       (date, challenge_type, params)
daily_scores           (user_id, date, score)
achievements           (achievement_id, name, condition)
player_achievements    (user_id, achievement_id, unlocked_at)
leaderboard_scores     (user_id, score, distance, combo, submitted_at)
```

Row-Level Security (RLS) must be enabled on every table above once created,
scoped so a user can only read/write their own rows (leaderboard reads are
the one public-read exception). The service role key never ships in the
client — only the anon key with RLS does.

Nothing in this file should be acted on before Phase 8 explicitly begins.
