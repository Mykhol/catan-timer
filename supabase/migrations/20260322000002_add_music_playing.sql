-- Track whether background music is playing and at what volume
alter table games add column music_playing boolean not null default false;
alter table games add column music_volume int not null default 40;
