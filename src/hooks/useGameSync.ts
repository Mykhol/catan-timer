import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, fetchGameByCode } from '../lib/supabase';
import type { GameRow, TurnLogEntry } from '../types';

interface UseGameSyncReturn {
  gameState: GameRow | null;
  connected: boolean;
  error: string | null;
  actions: {
    startTimer: () => Promise<void>;
    pauseTimer: () => Promise<void>;
    resumeTimer: () => Promise<void>;
    resetTimer: () => Promise<void>;
    nextPlayer: () => Promise<void>;
    prevPlayer: () => Promise<void>;
    toggleMusic: () => Promise<void>;
    setVolume: (volume: number) => Promise<void>;
    endGame: () => Promise<void>;
  };
}

export function useGameSync(gameCode: string): UseGameSyncReturn {
  const [gameState, setGameState] = useState<GameRow | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gameStateRef = useRef<GameRow | null>(null);

  // Keep ref in sync
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Fetch initial state and subscribe
  useEffect(() => {
    if (!supabase || !gameCode) return;

    let cancelled = false;

    async function init() {
      const game = await fetchGameByCode(gameCode);
      if (cancelled) return;
      if (!game) {
        setError('Game not found');
        return;
      }
      setGameState(game);
      setConnected(true);
    }

    init();

    const channel = supabase!
      .channel(`game-${gameCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `game_code=eq.${gameCode}`,
        },
        (payload) => {
          setGameState(payload.new as GameRow);
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      cancelled = true;
      supabase!.removeChannel(channel);
    };
  }, [gameCode]);

  const updateGame = useCallback(
    async (updates: Partial<GameRow>) => {
      if (!supabase || !gameStateRef.current) return;
      const { error: err } = await supabase
        .from('games')
        .update(updates)
        .eq('id', gameStateRef.current.id);
      if (err) setError(err.message);
    },
    []
  );

  const startTimer = useCallback(async () => {
    const updates: Partial<GameRow> = {
      timer_state: 'running',
      timer_started_at: new Date().toISOString(),
    };
    // Set game_started_at on first ever start
    if (!gameStateRef.current?.game_started_at) {
      updates.game_started_at = new Date().toISOString();
    }
    await updateGame(updates);
  }, [updateGame]);

  const pauseTimer = useCallback(async () => {
    const gs = gameStateRef.current;
    if (!gs || !gs.timer_started_at) return;
    const elapsed = (Date.now() - new Date(gs.timer_started_at).getTime()) / 1000;
    const remaining = Math.max(0, Math.round(gs.timer_remaining - elapsed));
    await updateGame({
      timer_state: 'paused',
      timer_remaining: remaining,
      timer_started_at: null,
    });
  }, [updateGame]);

  const resumeTimer = useCallback(async () => {
    await updateGame({
      timer_state: 'running',
      timer_started_at: new Date().toISOString(),
    });
  }, [updateGame]);

  const resetTimer = useCallback(async () => {
    const gs = gameStateRef.current;
    if (!gs) return;
    await updateGame({
      timer_state: 'idle',
      timer_remaining: gs.turn_time,
      timer_started_at: null,
    });
  }, [updateGame]);

  const nextPlayer = useCallback(async () => {
    const gs = gameStateRef.current;
    if (!gs) return;

    // Compute turn duration for logging
    let duration = 0;
    if (gs.timer_state === 'completed') {
      duration = gs.turn_time;
    } else if (gs.timer_state === 'running' && gs.timer_started_at) {
      const elapsed = (Date.now() - new Date(gs.timer_started_at).getTime()) / 1000;
      duration = Math.round(gs.turn_time - Math.max(0, gs.timer_remaining - elapsed));
    } else if (gs.timer_state === 'paused') {
      duration = gs.turn_time - gs.timer_remaining;
    }

    const entry: TurnLogEntry = {
      player_index: gs.current_player_index,
      duration: Math.max(0, Math.round(duration)),
    };
    const newLog = [...(gs.turn_log || []), entry];

    const nextIndex = (gs.current_player_index + 1) % gs.players.length;
    const nextTurn = nextIndex === 0 ? gs.turn_number + 1 : gs.turn_number;
    const updates: Partial<GameRow> = {
      current_player_index: nextIndex,
      turn_number: nextTurn,
      timer_state: 'running',
      timer_remaining: gs.turn_time,
      timer_started_at: new Date().toISOString(),
      turn_log: newLog,
    };
    if (!gs.game_started_at) {
      updates.game_started_at = new Date().toISOString();
    }
    await updateGame(updates);
  }, [updateGame]);

  const prevPlayer = useCallback(async () => {
    const gs = gameStateRef.current;
    if (!gs) return;
    const prevIndex = (gs.current_player_index - 1 + gs.players.length) % gs.players.length;
    const prevTurn = prevIndex === gs.players.length - 1 ? Math.max(1, gs.turn_number - 1) : gs.turn_number;
    await updateGame({
      current_player_index: prevIndex,
      turn_number: prevTurn,
      timer_state: 'idle',
      timer_remaining: gs.turn_time,
      timer_started_at: null,
    });
  }, [updateGame]);

  const toggleMusic = useCallback(async () => {
    const gs = gameStateRef.current;
    if (!supabase || !gs) return;
    await supabase
      .from('games')
      .update({ music_playing: !gs.music_playing })
      .eq('id', gs.id);
  }, []);

  const setVolume = useCallback(async (volume: number) => {
    if (!supabase || !gameStateRef.current) return;
    await supabase
      .from('games')
      .update({ music_volume: Math.round(volume) })
      .eq('id', gameStateRef.current.id);
  }, []);

  const endGame = useCallback(async () => {
    await updateGame({
      timer_state: 'ended',
      music_playing: false,
      timer_started_at: null,
      game_ended_at: new Date().toISOString(),
    });
  }, [updateGame]);

  return {
    gameState,
    connected,
    error,
    actions: { startTimer, pauseTimer, resumeTimer, resetTimer, nextPlayer, prevPlayer, toggleMusic, setVolume, endGame },
  };
}
