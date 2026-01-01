import { useCallback, useEffect, useRef } from 'react';

export function useSound(src?: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Create audio element on client only
    if (typeof window === 'undefined') return;
    
    // WebAudio context for synthetic fallback (always create)
    ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Only create audio element if src is provided
    if (src) {
      audioRef.current = new Audio(src);
      audioRef.current.preload = 'auto';
    }
  }, [src]);

  const play = useCallback(async () => {
    if (!ctxRef.current) return;

    // If we have an audio element, try it first
    if (audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
        return;
      } catch {
        // Audio failed, fall through to synthetic
      }
    }

    // Always use WebAudio synthetic beep as fallback
    const osc = ctxRef.current.createOscillator();
    const gain = ctxRef.current.createGain();
    osc.frequency.value = 800;
    gain.gain.value = 0.3;
    osc.connect(gain).connect(ctxRef.current.destination);
    osc.start();
    osc.stop(ctxRef.current.currentTime + 0.12);
  }, []);

  return play;
}
