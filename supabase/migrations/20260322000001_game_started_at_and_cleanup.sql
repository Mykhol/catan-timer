-- Track when the game actually started (first timer press)
alter table games add column game_started_at timestamptz;

-- Enable pg_cron extension
create extension if not exists pg_cron;

-- Delete games older than 24 hours, every hour
select cron.schedule(
  'cleanup-stale-games',
  '0 * * * *',
  $$DELETE FROM games WHERE created_at < now() - interval '24 hours'$$
);
