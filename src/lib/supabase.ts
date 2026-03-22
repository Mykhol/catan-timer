import { createClient } from '@supabase/supabase-js';
import type { GameRow, Player } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateGameCode(): string {
  let code = 'CATAN-';
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export async function createGame(
  players: Player[],
  turnTime: number
): Promise<GameRow> {
  if (!supabase) throw new Error('Supabase not configured');

  for (let attempt = 0; attempt < 5; attempt++) {
    const gameCode = generateGameCode();
    const { data, error } = await supabase
      .from('games')
      .insert({
        game_code: gameCode,
        players,
        turn_time: turnTime,
        current_player_index: 0,
        turn_number: 1,
        timer_state: 'idle',
        timer_remaining: turnTime,
        timer_started_at: null,
      })
      .select()
      .single();

    if (error) {
      // Unique constraint violation — retry with new code
      if (error.code === '23505') continue;
      throw error;
    }
    return data as GameRow;
  }
  throw new Error('Failed to generate unique game code');
}

export async function fetchGameByCode(gameCode: string): Promise<GameRow | null> {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('games')
    .select()
    .eq('game_code', gameCode.toUpperCase())
    .single();

  if (error) return null;
  return data as GameRow;
}
