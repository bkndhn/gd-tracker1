import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Mic, Loader2, RotateCcw, RotateCw } from 'lucide-react';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import {
  getResumePosition,
  setResumePosition,
  clearResumePosition,
  loadPeaks,
  pseudoPeaks,
} from '@/lib/voicePlayback';

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
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);
  const [showRemaining, setShowRemaining] = useState(false);
  const [peaks, setPeaks] = useState<number[] | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const durationRef = useRef(0);
  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2));

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  // Bar count adapts to the actual rendered width so bars never overflow
  // into the time / speed controls (tables, mobile, narrow cells).
  const [waveWidth, setWaveWidth] = useState(0);
  useEffect(() => {
    const el = waveformRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWaveWidth(Math.round(w));
    });
    ro.observe(el);
    setWaveWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const barPitch = compact ? 4 : 5; // px per bar incl. gap
  const numBars = Math.max(12, Math.min(compact ? 40 : 64, Math.floor((waveWidth || 140) / barPitch)));
  const fallbackBars = useMemo(() => pseudoPeaks(voiceUrl, numBars), [voiceUrl, numBars]);
  const waveformBars = peaks ?? fallbackBars;


  // Real amplitude peaks (decoded once per note, cached)
  useEffect(() => {
    if (!resolvedUrl) return;
    let cancelled = false;
    loadPeaks(voiceUrl, resolvedUrl, numBars).then((p) => {
      if (!cancelled && p) setPeaks(p);
    });
    return () => { cancelled = true; };
  }, [resolvedUrl, voiceUrl, numBars]);

  const persist = useCallback((time: number) => {
    setResumePosition(voiceUrl, time);
  }, [voiceUrl]);

  const updateProgressFrame = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !isDraggingRef.current) {
      const currentTime = audio.currentTime;
      const audioDuration = durationRef.current || audio.duration || 1;
      setProgressPercent(Math.min(100, (currentTime / audioDuration) * 100));
      setDisplayTime(currentTime);
      setResumePosition(voiceUrl, currentTime);
      try {
        if (audio.buffered.length) {
          const end = audio.buffered.end(audio.buffered.length - 1);
          setBufferedPercent(Math.min(100, (end / audioDuration) * 100));
        }
      } catch { /* noop */ }
    }
    if (isPlayingRef.current && !isDraggingRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateProgressFrame);
    }
  }, [voiceUrl]);

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

  // Pause when another player starts (keeping this one's resume position)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      if (detail !== instanceIdRef.current && audioRef.current && isPlayingRef.current) {
        persist(audioRef.current.currentTime);
        audioRef.current.pause();
        setIsPlaying(false);
        isPlayingRef.current = false;
        stopAnimationLoop();
      }
    };
    window.addEventListener(VOICE_PLAY_EVENT, handler);
    return () => window.removeEventListener(VOICE_PLAY_EVENT, handler);
  }, [stopAnimationLoop, persist]);

  useEffect(() => {
    return () => {
      stopAnimationLoop();
      const audio = audioRef.current;
      if (audio) {
        setResumePosition(voiceUrl, audio.currentTime);
        audio.pause();
      }
    };
  }, [stopAnimationLoop, voiceUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  const cyclePlaybackSpeed = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    setPlaybackSpeed(PLAYBACK_SPEEDS[(currentIndex + 1) % PLAYBACK_SPEEDS.length]);
  }, [playbackSpeed]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlayingRef.current) {
      persist(audio.currentTime);
      audio.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
      stopAnimationLoop();
    } else {
      window.dispatchEvent(new CustomEvent(VOICE_PLAY_EVENT, { detail: instanceIdRef.current }));
      const resume = getResumePosition(voiceUrl);
      if (resume > 0 && Math.abs(audio.currentTime - resume) > 0.2 && (!durationRef.current || resume < durationRef.current - 0.3)) {
        try { audio.currentTime = resume; } catch { /* noop */ }
      }
      audio.play().then(() => {
        setIsPlaying(true);
        isPlayingRef.current = true;
        startAnimationLoop();
      }).catch(() => {});
    }
  }, [startAnimationLoop, stopAnimationLoop, persist, voiceUrl]);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let d = audio.duration;
    if (!isFinite(d)) {
      // Some webm blobs report Infinity — seek trick to force duration
      audio.currentTime = 1e9;
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
    audio.playbackRate = playbackSpeed;
    // Restore resume position across remounts
    const resume = getResumePosition(voiceUrl);
    if (resume > 0 && (!isFinite(d) || resume < d - 0.3)) {
      try {
        audio.currentTime = resume;
        setDisplayTime(resume);
        if (isFinite(d) && d > 0) setProgressPercent((resume / d) * 100);
      } catch { /* noop */ }
    }
  }, [playbackSpeed, voiceUrl]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    stopAnimationLoop();
    if (audioRef.current) audioRef.current.currentTime = 0;
    clearResumePosition(voiceUrl);
    setProgressPercent(0);
    setDisplayTime(0);
  }, [stopAnimationLoop, voiceUrl]);

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
      persist(clampedTime);
    }
  }, [duration, persist]);

  const skip = useCallback((delta: number) => {
    seekTo((audioRef.current?.currentTime ?? 0) + delta);
  }, [seekTo]);

  // Media Session API — lockscreen / background controls
  useEffect(() => {
    if (!isPlaying || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms: any = (navigator as any).mediaSession;
    try {
      ms.metadata = new (window as any).MediaMetadata({ title: 'Voice Note', artist: 'GD Tracker' });
      const setAction = (a: string, cb: any) => { try { ms.setActionHandler(a, cb); } catch { /* noop */ } };
      setAction('play', () => { if (audioRef.current && !isPlayingRef.current) togglePlay(); });
      setAction('pause', () => { if (audioRef.current && isPlayingRef.current) togglePlay(); });
      setAction('seekbackward', (d: any) => seekTo((audioRef.current?.currentTime ?? 0) - (d?.seekOffset || 5)));
      setAction('seekforward', (d: any) => seekTo((audioRef.current?.currentTime ?? 0) + (d?.seekOffset || 5)));
      setAction('seekto', (d: any) => { if (typeof d?.seekTime === 'number') seekTo(d.seekTime); });
      return () => { ['play', 'pause', 'seekbackward', 'seekforward', 'seekto'].forEach(a => setAction(a, null)); };
    } catch { /* noop */ }
  }, [isPlaying, togglePlay, seekTo]);

  // Unified pointer events (mouse / touch / pen)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isLoaded || !duration) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setIsDragging(true);
    isDraggingRef.current = true;
    stopAnimationLoop();
    seekTo(getTimeFromPosition(e.clientX));
  }, [isLoaded, duration, getTimeFromPosition, seekTo, stopAnimationLoop]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!duration) return;
    const rect = waveformRef.current?.getBoundingClientRect();
    if (rect) setHoverPercent(Math.max(0, Math.min(((e.clientX - rect.left) / rect.width) * 100, 100)));
    if (isDraggingRef.current) {
      e.preventDefault();
      seekTo(getTimeFromPosition(e.clientX));
    }
  }, [duration, getTimeFromPosition, seekTo]);

  const endDrag = useCallback((e?: React.PointerEvent) => {
    if (e) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
    }
    if (!isDraggingRef.current) return;
    setIsDragging(false);
    isDraggingRef.current = false;
    if (isPlayingRef.current) startAnimationLoop();
  }, [startAnimationLoop]);

  // Sizes
  const btnSize = compact ? 'h-8 w-8' : 'h-10 w-10';
  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const waveH = compact ? 'h-8' : 'h-10';
  const knobSize = compact ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const timeCls = compact ? 'text-[10px]' : 'text-xs';

  const timeLabel = showRemaining && duration
    ? `-${formatTime(Math.max(0, duration - displayTime))}`
    : (isPlaying || displayTime > 0 ? formatTime(displayTime) : formatTime(duration));

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

      {/* Skip back */}
      {!compact && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); skip(-5); }}
          disabled={!isLoaded}
          aria-label="Back 5 seconds"
          className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
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

      {/* Skip forward */}
      {!compact && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); skip(5); }}
          disabled={!isLoaded}
          aria-label="Forward 5 seconds"
          className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors disabled:opacity-40"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Waveform */}
      <div
        ref={waveformRef}
        tabIndex={0}
        className={`flex-1 basis-0 min-w-[56px] ${waveH} cursor-pointer relative select-none overflow-visible touch-none outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-full`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={(e) => { setHoverPercent(null); endDrag(e); }}
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
        aria-valuemax={Math.round(duration) || 100}
        aria-valuenow={Math.round(displayTime)}
        aria-valuetext={`${formatTime(displayTime)} of ${formatTime(duration)}`}
        aria-label="Voice note progress. Space to play, arrows to seek."
      >
        {/* Buffered range */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/10 pointer-events-none transition-[width] duration-300"
          style={{ width: `${bufferedPercent}%` }}
        />

        <div className="absolute inset-0 overflow-hidden rounded-full">
          <div className="absolute inset-0 flex items-center gap-[1px] pointer-events-none">
            {waveformBars.map((height, index) => {
              const barPercent = ((index + 0.5) / waveformBars.length) * 100;
              const isPlayed = barPercent <= progressPercent;
              const isHovered = hoverPercent !== null && barPercent <= hoverPercent && !isPlayed;
              const isEdge = isPlaying && Math.abs(barPercent - progressPercent) < (100 / waveformBars.length) * 1.2;
              return (
                <div
                  key={index}
                  className="flex-1 min-w-0 rounded-full transition-all duration-150"
                  style={{
                    height: `${Math.max(0.18, height) * 100}%`,
                    maxWidth: compact ? '3px' : '4px',
                    background: isPlayed
                      ? 'linear-gradient(to top, hsl(var(--primary)), hsl(var(--primary-glow)))'
                      : isHovered
                        ? 'hsl(var(--primary) / 0.35)'
                        : 'hsl(var(--muted-foreground) / 0.35)',
                    transform: isEdge ? 'scaleY(1.18)' : 'scaleY(1)',
                    boxShadow: isPlayed ? '0 0 4px hsl(var(--primary) / 0.35)' : 'none',
                  }}
                />
              );
            })}
          </div>
        </div>


        {/* Hover scrub tooltip */}
        {hoverPercent !== null && duration > 0 && (
          <div
            className="absolute -top-6 z-30 pointer-events-none px-1.5 py-0.5 rounded-md bg-foreground text-background text-[10px] font-medium tabular-nums shadow-md"
            style={{ left: `${hoverPercent}%`, transform: 'translateX(-50%)' }}
          >
            {formatTime((hoverPercent / 100) * duration)}
          </div>
        )}

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
            className={`${knobSize} rounded-full bg-gradient-to-br from-primary to-primary-glow border-2 border-background shadow-md ${isPlaying ? 'ring-2 ring-primary/30' : ''} ${isDragging ? 'scale-125' : ''} transition-transform`}
          />
        </div>
      </div>

      {/* Right cluster: time + speed, always aligned and never overlapped */}
      <div className="shrink-0 flex items-center gap-1.5 pl-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowRemaining((v) => !v); }}
          aria-label="Toggle remaining time"
          className={`${timeCls} text-muted-foreground hover:text-foreground transition-colors tabular-nums min-w-[34px] text-right font-medium leading-none`}
        >
          {timeLabel}
        </button>

        <button
          type="button"
          onClick={cyclePlaybackSpeed}
          className={[
            'rounded-full font-semibold tabular-nums leading-none',
            'transition-colors border',
            playbackSpeed === 1
              ? 'text-muted-foreground border-border/60 hover:text-foreground'
              : 'text-primary border-primary/30 bg-primary/5',
            compact ? 'text-[9px] px-1.5 py-[3px]' : 'text-[10px] px-2 py-1',
          ].join(' ')}
          aria-label={`Playback speed ${playbackSpeed}x`}
        >
          {playbackSpeed}×
        </button>
      </div>

    </div>
  );
};
