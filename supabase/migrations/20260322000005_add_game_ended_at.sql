-- Freeze game duration when game ends
alter table games add column game_ended_at timestamptz;
