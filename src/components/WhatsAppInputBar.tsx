import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Plus, 
  Camera, 
  ImageIcon, 
  Mic, 
  X, 
  Play, 
  Pause, 
  Square, 
  Trash2, 
} from 'lucide-react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';

interface ImagePreview {
  id: string;
  file: File;
  url: string;
}

interface WhatsAppInputBarProps {
  notes: string;
  onNotesChange: (value: string) => void;
  onImagesChange: (images: File[]) => void;
  onVoiceNoteChange: (file: File | null) => void;
  maxImages?: number;
  disabled?: boolean;
  voiceNoteFile: File | null;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const WhatsAppInputBar = ({
  notes,
  onNotesChange,
  onImagesChange,
  onVoiceNoteChange,
  maxImages = 10,
  disabled = false,
  voiceNoteFile,
}: WhatsAppInputBarProps) => {
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const waveformBars = useMemo(() => {
    const bars: number[] = [];
    const numBars = 25;
    const seed = audioUrl ? audioUrl.length : Date.now();
    for (let i = 0; i < numBars; i++) {
      const height = 0.25 + Math.abs(Math.sin((seed + i) * 0.5)) * 0.75;
      bars.push(height);
    }
    return bars;
  }, [audioUrl]);
  
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Reset state when voiceNoteFile is cleared externally
  useEffect(() => {
    if (!voiceNoteFile && audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioBlob(null);
      setAudioUrl(null);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [voiceNoteFile]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      images.forEach(img => URL.revokeObjectURL(img.url));
    };
  }, []);
  
  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 0.05,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
      initialQuality: 0.85,
    };
    const compressed = await imageCompression(file, options);
    if (compressed.size > 50 * 1024) {
      return await imageCompression(file, { ...options, initialQuality: 0.7, maxWidthOrHeight: 1024 });
    }
    return compressed;
  };
  
  const handleImageSelect = async (files: FileList | null, source: 'camera' | 'gallery') => {
    if (!files) return;
    setIsAttachOpen(false);
    
    const fileArray = Array.from(files);
    if (images.length + fileArray.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }
    
    try {
      const newImages: ImagePreview[] = [];
      for (const file of fileArray) {
        if (!file.type.startsWith('image/')) continue;
        toast.info(`Compressing ${file.name}...`);
        const compressed = await compressImage(file);
        newImages.push({
          id: Math.random().toString(36).substr(2, 9),
          file: compressed,
          url: URL.createObjectURL(compressed),
        });
      }
      
      const updated = [...images, ...newImages];
      setImages(updated);
      onImagesChange(updated.map(img => img.file));
      toast.success(`${newImages.length} image(s) added`);
    } catch (error) {
      toast.error('Failed to process images');
    }
  };
  
  const removeImage = (id: string) => {
    const img = images.find(i => i.id === id);
    if (img) URL.revokeObjectURL(img.url);
    const updated = images.filter(i => i.id !== id);
    setImages(updated);
    onImagesChange(updated.map(i => i.file));
  };
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type });
        onVoiceNoteChange(file);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (error) {
      toast.error('Could not access microphone');
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
  
  const deleteRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setCurrentTime(0);
    setDuration(0);
    onVoiceNoteChange(null);
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
    const pos = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pos * duration;
    setCurrentTime(audioRef.current.currentTime);
  };
  

  return (
    <div className="space-y-3">
      {/* Image Previews */}
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap p-2 bg-muted/30 rounded-lg">
          {images.map((image) => (
            <div key={image.id} className="relative w-16 h-16">
              <img
                src={image.url}
                alt="Preview"
                className="w-full h-full object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={() => removeImage(image.id)}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-md hover:opacity-80"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center rounded-b-lg">
                {(image.file.size / 1024).toFixed(0)}KB
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Voice Note Player */}
      {audioUrl && (
        <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-xl border border-border/50">
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="metadata"
            onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
            onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
            onEnded={() => {
              setIsPlaying(false);
              setCurrentTime(0);
              if (audioRef.current) audioRef.current.currentTime = 0;
            }}
            className="hidden"
          />
          
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={playAudio}
            className="h-8 w-8 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
          </Button>
          
          <div ref={waveformRef} onClick={handleSeek} className="flex-1 flex items-center gap-[2px] h-8 cursor-pointer">
            {waveformBars.map((height, i) => {
              const barProgress = (i / waveformBars.length) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-full transition-colors"
                  style={{
                    height: `${height * 100}%`,
                    minWidth: '2px',
                    maxWidth: '3px',
                    backgroundColor: barProgress <= progress ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)',
                  }}
                />
              );
            })}
          </div>
          
          <span className="text-xs text-muted-foreground tabular-nums min-w-[32px]">
            {formatTime(Math.floor(currentTime || duration))}
          </span>
          
          
          <Button type="button" variant="ghost" size="icon" onClick={deleteRecording} className="h-7 w-7 text-destructive">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
      
      {/* Recording State */}
      {isRecording && (
        <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-xl border border-destructive/30">
          <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm font-medium text-destructive">Recording... {formatTime(recordingTime)}</span>
          <div className="flex-1" />
          <Button type="button" variant="destructive" size="sm" onClick={stopRecording} className="gap-1">
            <Square className="h-3 w-3 fill-current" /> Stop
          </Button>
        </div>
      )}
      
      {/* Main Input Bar */}
      <div className="flex items-end gap-2 p-2 bg-muted/50 rounded-2xl border border-border/50">
        {/* Attachment Button */}
        <Popover open={isAttachOpen} onOpenChange={setIsAttachOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0" disabled={disabled}>
              <Plus className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" side="top" align="start">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => cameraInputRef.current?.click()}
                className="gap-2"
              >
                <Camera className="h-4 w-4" /> Camera
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => galleryInputRef.current?.click()}
                className="gap-2"
              >
                <ImageIcon className="h-4 w-4" /> Gallery
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        
        {/* Text Input */}
        <Textarea
          ref={textareaRef}
          id="notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Type a message or record voice..."
          rows={1}
          className="flex-1 min-h-[36px] max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 py-2"
          disabled={disabled}
        />
        
        
        {/* Record Voice Note Button */}
        {!audioUrl && !isRecording && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={startRecording}
            className="h-9 w-9 rounded-full shrink-0 text-primary hover:text-primary hover:bg-primary/10"
            disabled={disabled}
            title="Record voice note"
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}
      </div>
      
      {/* Hint Text */}
      <p className="text-xs text-muted-foreground text-center">
        {images.length > 0 && `${images.length} image(s) • `}
        {audioUrl ? 'Voice note attached' : isRecording ? 'Recording...' : 'Tap + to attach • Tap mic to record voice note'}
      </p>
      
      {/* Hidden File Inputs */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleImageSelect(e.target.files, 'camera')} className="hidden" />
      <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={(e) => handleImageSelect(e.target.files, 'gallery')} className="hidden" />
    </div>
  );
};
