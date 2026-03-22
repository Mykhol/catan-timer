create table games (
  id uuid primary key default gen_random_uuid(),
  game_code text unique not null,
  players jsonb not null,
  turn_time int not null,
  current_player_index int not null default 0,
  turn_number int not null default 1,
  timer_state text not null default 'idle',
  timer_remaining int not null,
  timer_started_at timestamptz,
  created_at timestamptz default now()
);

create index idx_games_game_code on games(game_code);

alter table games enable row level security;

create policy "Games are publicly readable"
  on games for select using (true);

create policy "Anyone can create a game"
  on games for insert with check (true);

create policy "Anyone can update a game"
  on games for update using (true);

-- Enable Realtime for this table
alter publication supabase_realtime add table games;
