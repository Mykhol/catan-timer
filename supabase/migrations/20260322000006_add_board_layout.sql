-- Store the board layout so controllers can render it
alter table games add column board_layout jsonb;
