import { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSignedImageUrls } from '@/hooks/useSignedUrl';
import { LazyImage } from '@/components/LazyImage';

interface ImageThumbnailProps {
  images: Array<{
    id: string;
    image_url: string;
    image_name?: string;
  }>;
  maxDisplay?: number;
}

export const ImageThumbnail = ({ images, maxDisplay = 1 }: ImageThumbnailProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const resolvedImages = useSignedImageUrls(images);

  if (!resolvedImages || resolvedImages.length === 0) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }

  const displayImages = resolvedImages.slice(0, maxDisplay);
  const remainingCount = resolvedImages.length - maxDisplay;

  const handlePrev = () => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : resolvedImages.length - 1));
  const handleNext = () => setCurrentIndex((prev) => (prev < resolvedImages.length - 1 ? prev + 1 : 0));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1 hover:opacity-80 transition-opacity">
          {displayImages.map((img) => (
            <LazyImage
              key={img.id}
              src={img.image_url}
              alt={img.image_name || 'Visit image'}
              wrapperClassName="w-8 h-8 rounded border border-border"
            />
          ))}
          {remainingCount > 0 && (
            <span className="text-xs text-primary font-medium ml-0.5">+{remainingCount}</span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="relative">
          <div className="relative aspect-video bg-black flex items-center justify-center">
            <LazyImage
              src={resolvedImages[currentIndex]?.image_url}
              alt={resolvedImages[currentIndex]?.image_name || 'Visit image'}
              fit="contain"
              eager
              wrapperClassName="w-full h-full bg-black"
            />
          </div>
          {resolvedImages.length > 1 && (
            <>
              <Button variant="ghost" size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                onClick={handlePrev}><ChevronLeft className="h-6 w-6" /></Button>
              <Button variant="ghost" size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                onClick={handleNext}><ChevronRight className="h-6 w-6" /></Button>
            </>
          )}
          {resolvedImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
              {currentIndex + 1} / {resolvedImages.length}
            </div>
          )}
        </div>
        {resolvedImages.length > 1 && (
          <div className="p-4 bg-muted flex gap-2 overflow-x-auto">
            {resolvedImages.map((img, idx) => (
              <button key={img.id} onClick={() => setCurrentIndex(idx)}
                className={`shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-all ${idx === currentIndex ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                <LazyImage src={img.image_url} alt="" wrapperClassName="w-full h-full" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
