import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Play, Pause, Trash2, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface VoiceNoteRecorderProps {
  onVoiceNoteChange: (file: File | null) => void;
  onTranscriptionChange?: (text: string) => void;
  existingVoiceUrl?: string;
}

// Format seconds to M:SS
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const VoiceNoteRecorder = ({ onVoiceNoteChange, onTranscriptionChange, existingVoiceUrl }: VoiceNoteRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(existingVoiceUrl || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSupported, setIsSupported] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const currentFileRef = useRef<File | null>(null);

  // Generate waveform bars for visual feedback
  const waveformBars = useMemo(() => {
    const bars: number[] = [];
    const numBars = 30;
    const seed = audioUrl ? audioUrl.length : Date.now();
    for (let i = 0; i < numBars; i++) {
      const height = 0.25 + Math.abs(Math.sin((seed + i) * 0.5)) * 0.75;
      bars.push(height);
    }
    return bars;
  }, [audioUrl]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    // Check if MediaRecorder is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsSupported(false);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl && !existingVoiceUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  const transcribeAudio = async (file: File) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', file);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-voice`,
        {
          method: 'POST',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transcription failed');
      }

      const data = await response.json();
      if (data.transcription) {
        setTranscription(data.transcription);
        if (onTranscriptionChange) {
          onTranscriptionChange(data.transcription);
        }
        toast.success('Voice note transcribed!');
      }
    } catch (error: any) {
      if (import.meta.env.DEV) console.error('Transcription error:', error);
      toast.error(error.message || 'Failed to transcribe voice note');
    } finally {
      setIsTranscribing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);

        if (audioUrl && !existingVoiceUrl) URL.revokeObjectURL(audioUrl);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Create file from blob
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type });
        currentFileRef.current = file;
        onVoiceNoteChange(file);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      setTranscription('');

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      if (import.meta.env.DEV) console.error('Error accessing microphone:', error);
      toast.error('Could not access microphone. Please grant permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const playAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current || !audioRef.current || duration === 0) return;

    const rect = waveformRef.current.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const newTime = clickPosition * duration;

    audioRef.current.currentTime = Math.max(0, Math.min(newTime, duration));
    setCurrentTime(audioRef.current.currentTime);
  };

  const deleteRecording = () => {
    if (audioUrl && !existingVoiceUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setCurrentTime(0);
    setDuration(0);
    setTranscription('');
    currentFileRef.current = null;
    onVoiceNoteChange(null);
  };

  const handleTranscribe = () => {
    if (currentFileRef.current) {
      transcribeAudio(currentFileRef.current);
    } else if (audioBlob) {
      const file = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: audioBlob.type });
      transcribeAudio(file);
    }
  };

  if (!isSupported) {
    return (
      <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
        Voice recording is not supported in this browser.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          className="hidden"
        />
      )}

      {!audioUrl ? (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant={isRecording ? "destructive" : "outline"}
            size="lg"
            onClick={isRecording ? stopRecording : startRecording}
            className="gap-2"
          >
            {isRecording ? (
              <>
                <Square className="h-4 w-4 fill-current" />
                Stop ({formatTime(recordingTime)})
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                Record Voice Note
              </>
            )}
          </Button>

          {isRecording && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-[2px] h-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-destructive rounded-full animate-pulse"
                    style={{
                      height: `${20 + Math.random() * 80}%`,
                      animationDelay: `${i * 0.1}s`
                    }}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">Recording...</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/50">
            {/* Play/Pause Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={playAudio}
              className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="h-5 w-5 fill-current ml-0.5" />
              )}
            </Button>

            {/* Waveform */}
            <div
              ref={waveformRef}
              onClick={handleSeek}
              className="flex-1 flex items-center gap-[2px] h-10 cursor-pointer relative select-none"
            >
              {waveformBars.map((height, index) => {
                const barProgress = (index / waveformBars.length) * 100;
                const isPlayed = barProgress <= progress;
                return (
                  <div
                    key={index}
                    className="flex-1 rounded-full"
                    style={{
                      height: `${height * 100}%`,
                      minWidth: '3px',
                      maxWidth: '4px',
                      backgroundColor: isPlayed
                        ? 'hsl(var(--primary))'
                        : 'hsl(var(--muted-foreground) / 0.3)',
                      transition: 'background-color 0.1s ease'
                    }}
                  />
                );
              })}

              {/* Progress indicator */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-md transition-all duration-75 pointer-events-none ring-2 ring-background"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>

            {/* Time display */}
            <span className="text-sm text-muted-foreground tabular-nums min-w-[40px] text-right font-medium">
              {formatTime(Math.floor(isPlaying || currentTime > 0 ? currentTime : duration))}
            </span>

            {/* Transcribe Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleTranscribe}
              disabled={isTranscribing}
              className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
              title="Transcribe to text"
            >
              {isTranscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </Button>

            {/* Delete Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={deleteRecording}
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Transcription result */}
          {transcription && (
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Transcription:
              </p>
              <p className="text-sm">{transcription}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
