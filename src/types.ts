export interface Player {
  id: number;
  name: string;
}

export type TimerState = 'idle' | 'running' | 'paused' | 'completed' | 'ended';

export interface TurnLogEntry {
  player_index: number;
  duration: number; // seconds
}

export interface GameRow {
  id: string;
  game_code: string;
  players: Player[];
  turn_time: number;
  current_player_index: number;
  turn_number: number;
  timer_state: TimerState;
  timer_remaining: number;
  timer_started_at: string | null;
  game_started_at: string | null;
  game_ended_at: string | null;
  music_playing: boolean;
  music_volume: number;
  turn_log: TurnLogEntry[];
  board_layout: import('./lib/boardTypes').BoardDefinition | null;
  created_at: string;
}
