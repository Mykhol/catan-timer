-- Log each turn's duration for end-of-match analytics
alter table games add column turn_log jsonb not null default '[]';
