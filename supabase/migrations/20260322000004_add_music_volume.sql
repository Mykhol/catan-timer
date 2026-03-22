-- Add volume control for background music (0-100)
alter table games add column if not exists music_volume int not null default 40;
