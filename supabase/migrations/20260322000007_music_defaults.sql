-- Default music to on at 30% volume
alter table games alter column music_playing set default true;
alter table games alter column music_volume set default 30;
