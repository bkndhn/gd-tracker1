import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Mic, Loader2 } from 'lucide-react';
import { useSignedUrl } from '@/hooks/useSignedUrl';

interface VoiceNotePlayerProps {
  voiceUrl: string;
  compact?: boolean;
}

const PLAYBACK_SPEEDS = [1, 1.5, 2, 0.5];
const VOICE_PLAY_EVENT = 'gd-voice-play';

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const VoiceNotePlayer = ({ voiceUrl, compact = false }: VoiceNotePlayerProps) => {
  const resolvedUrl = useSignedUrl(voiceUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [progressPercent, setProgressPercent] = useState(0);
  const [displayTime, setDisplayTime] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2));

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);

  const numBars = compact ? 32 : 46;

  const waveformBars = useMemo(() => {
    const bars: number[] = [];
    let hash = 0;
    for (let i = 0; i < voiceUrl.length; i++) {
      hash = ((hash << 5) - hash) + voiceUrl.charCodeAt(i);
      hash |= 0;
    }
    for (let i = 0; i < numBars; i++) {
      const seed = Math.abs(Math.sin(hash * (i + 1)) * 10000);
      // Give a natural voice-envelope: taller in middle, softer at ends
      const envelope = 0.55 + 0.45 * Math.sin((i / numBars) * Math.PI);
      const raw = 0.25 + (seed % 75) / 100;
      bars.push(Math.min(1, raw * envelope + 0.15));
    }
    return bars;
  }, [voiceUrl, numBars]);

  const updateProgressFrame = useCallback(() => {
    if (audioRef.current && !isDraggingRef.current) {
      const currentTime = audioRef.current.currentTime;
      const audioDuration = audioRef.current.duration || 1;
      setProgressPercent((currentTime / audioDuration) * 100);
      setDisplayTime(currentTime);
    }
    if (isPlayingRef.current && !isDraggingRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateProgressFrame);
    }
  }, []);

  const startAnimationLoop = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(updateProgressFrame);
  }, [updateProgressFrame]);

  const stopAnimationLoop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Pause when another player starts
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      if (detail !== instanceIdRef.current && audioRef.current && isPlayingRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
        isPlayingRef.current = false;
        stopAnimationLoop();
      }
    };
    window.addEventListener(VOICE_PLAY_EVENT, handler);
    return () => window.removeEventListener(VOICE_PLAY_EVENT, handler);
  }, [stopAnimationLoop]);

  useEffect(() => {
    return () => {
      stopAnimationLoop();
      if (audioRef.current) audioRef.current.pause();
    };
  }, [stopAnimationLoop]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  const cyclePlaybackSpeed = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    setPlaybackSpeed(PLAYBACK_SPEEDS[nextIndex]);
  }, [playbackSpeed]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlayingRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
      stopAnimationLoop();
    } else {
      window.dispatchEvent(new CustomEvent(VOICE_PLAY_EVENT, { detail: instanceIdRef.current }));
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        isPlayingRef.current = true;
        startAnimationLoop();
      }).catch(() => {});
    }
  }, [startAnimationLoop, stopAnimationLoop]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      let d = audioRef.current.duration;
      // Fallback: some webm blobs report Infinity — seek trick
      if (!isFinite(d)) {
        audioRef.current.currentTime = 1e9;
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            d = audioRef.current.duration;
            if (isFinite(d)) setDuration(d);
          }
        }, 100);
      } else {
        setDuration(d);
      }
      setIsLoaded(true);
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    stopAnimationLoop();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setProgressPercent(0);
    setDisplayTime(0);
  }, [stopAnimationLoop]);

  const getTimeFromPosition = useCallback((clientX: number): number => {
    const ref = waveformRef.current;
    if (!ref || !duration) return 0;
    const rect = ref.getBoundingClientRect();
    const position = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
    return position * duration;
  }, [duration]);

  const seekTo = useCallback((newTime: number) => {
    if (audioRef.current && duration > 0) {
      const clampedTime = Math.max(0, Math.min(newTime, duration));
      audioRef.current.currentTime = clampedTime;
      setProgressPercent((clampedTime / duration) * 100);
      setDisplayTime(clampedTime);
    }
  }, [duration]);

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isLoaded || !duration) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    isDraggingRef.current = true;
    stopAnimationLoop();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    seekTo(getTimeFromPosition(clientX));
  }, [isLoaded, duration, getTimeFromPosition, seekTo, stopAnimationLoop]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      seekTo(getTimeFromPosition(clientX));
    };
    const handleUp = () => {
      setIsDragging(false);
      isDraggingRef.current = false;
      if (isPlayingRef.current) startAnimationLoop();
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, getTimeFromPosition, seekTo, startAnimationLoop]);

  // Sizes
  const btnSize = compact ? 'h-8 w-8' : 'h-10 w-10';
  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const waveH = compact ? 'h-8' : 'h-10';
  const knobSize = compact ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const timeCls = compact ? 'text-[10px]' : 'text-xs';

  return (
    <div
      className={[
        'group inline-flex items-center gap-2 w-full max-w-full',
        compact ? 'px-2 py-1.5' : 'px-3 py-2',
        'rounded-full border border-border/60',
        'bg-gradient-to-r from-muted/60 via-muted/30 to-muted/60',
        'backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow duration-300',
      ].join(' ')}
    >
      <audio
        ref={audioRef}
        src={resolvedUrl}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Mic avatar */}
      {!compact && (
        <div className="relative shrink-0">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-sm">
            <Mic className="h-4 w-4 text-primary-foreground" />
          </div>
          {isPlaying && (
            <span className="absolute inset-0 rounded-full ring-2 ring-primary/40 animate-ping" />
          )}
        </div>
      )}

      {/* Play/Pause */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        disabled={!resolvedUrl}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className={[
          btnSize,
          'shrink-0 rounded-full',
          'bg-gradient-to-br from-primary to-primary-glow text-primary-foreground',
          'hover:opacity-90 hover:scale-105 active:scale-95 transition-all',
          'shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.6)]',
        ].join(' ')}
      >
        {!resolvedUrl ? (
          <Loader2 className={`${iconSize} animate-spin`} />
        ) : isPlaying ? (
          <Pause className={`${iconSize} fill-current`} />
        ) : (
          <Play className={`${iconSize} fill-current ml-0.5`} />
        )}
      </Button>

      {/* Waveform */}
      <div
        ref={waveformRef}
        tabIndex={0}
        className={`flex-1 min-w-0 ${waveH} cursor-pointer relative select-none overflow-hidden touch-none outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-full`}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onKeyDown={(e) => {
          if (!isLoaded || !duration) return;
          const cur = audioRef.current?.currentTime ?? 0;
          if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
          else if (e.key === 'ArrowRight') { e.preventDefault(); seekTo(cur + (e.shiftKey ? 10 : 5)); }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); seekTo(cur - (e.shiftKey ? 10 : 5)); }
          else if (e.key === 'Home') { e.preventDefault(); seekTo(0); }
          else if (e.key === 'End') { e.preventDefault(); seekTo(duration - 0.1); }
          else if (/^[0-9]$/.test(e.key)) { e.preventDefault(); seekTo((parseInt(e.key, 10) / 10) * duration); }
        }}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercent)}
        aria-label="Voice note progress. Space to play, arrows to seek."
      >
        <div className="absolute inset-0 flex items-center gap-[2px] pointer-events-none">
          {waveformBars.map((height, index) => {
            const barPercent = ((index + 0.5) / waveformBars.length) * 100;
            const isPlayed = barPercent <= progressPercent;
            const isEdge = isPlaying && Math.abs(barPercent - progressPercent) < (100 / waveformBars.length) * 1.2;
            return (
              <div
                key={index}
                className="flex-1 rounded-full transition-all duration-150"
                style={{
                  height: `${height * 100}%`,
                  minWidth: '2px',
                  maxWidth: compact ? '3px' : '4px',
                  background: isPlayed
                    ? 'linear-gradient(to top, hsl(var(--primary)), hsl(var(--primary-glow)))'
                    : 'hsl(var(--muted-foreground) / 0.35)',
                  transform: isEdge ? 'scaleY(1.15)' : 'scaleY(1)',
                  boxShadow: isPlayed ? '0 0 4px hsl(var(--primary) / 0.35)' : 'none',
                }}
              />
            );
          })}
        </div>
        {/* Scrubber knob */}
        <div
          className="absolute top-1/2 z-20 pointer-events-none"
          style={{
            left: `${progressPercent}%`,
            transform: 'translate(-50%, -50%)',
            transition: isDragging ? 'none' : 'left 60ms linear',
          }}
        >
          <div
            className={`${knobSize} rounded-full bg-gradient-to-br from-primary to-primary-glow border-2 border-background shadow-md ${isPlaying ? 'ring-2 ring-primary/30' : ''}`}
          />
        </div>
      </div>

      {/* Time */}
      <span className={`${timeCls} text-muted-foreground tabular-nums shrink-0 min-w-[32px] text-right font-medium`}>
        {isPlaying || displayTime > 0 ? formatTime(displayTime) : formatTime(duration)}
      </span>

      {/* Speed */}
      <button
        type="button"
        onClick={cyclePlaybackSpeed}
        className={[
          'shrink-0 rounded-full font-semibold tabular-nums',
          'transition-colors border',
          playbackSpeed === 1
            ? 'text-muted-foreground border-transparent hover:text-foreground'
            : 'text-primary border-primary/30 bg-primary/5',
          compact ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5',
        ].join(' ')}
        aria-label={`Playback speed ${playbackSpeed}x`}
      >
        {playbackSpeed}×
      </button>
    </div>
  );
};
