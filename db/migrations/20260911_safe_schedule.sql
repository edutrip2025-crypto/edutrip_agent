-- Apply after db/schema.sql on projects created before 2026-09-11.
-- The worker enforces the narrower 10:00–16:00 IST window before calling ea_claim.
alter table public.settings alter column daily_limit set default 5;
alter table public.settings alter column min_gap_minutes set default 30;
update public.settings
set daily_limit=least(daily_limit,5),
    min_gap_minutes=greatest(min_gap_minutes,30),
    sending_enabled=false
where id=1;
