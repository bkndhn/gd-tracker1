
import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useSignedImageUrls } from '@/hooks/useSignedUrl';
import { LazyImage } from '@/components/LazyImage';

interface ImageDisplayProps {
  images: Array<{
    id: string;
    image_url: string;
    image_name?: string;
  }>;
  className?: string;
}

export const ImageDisplay = ({ images, className = "" }: ImageDisplayProps) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const resolvedImages = useSignedImageUrls(images);

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  if (!resolvedImages || resolvedImages.length === 0) return null;

  const handlePrevious = () => setSelectedImageIndex((prev) => prev === 0 ? resolvedImages.length - 1 : prev - 1);
  const handleNext = () => setSelectedImageIndex((prev) => prev === resolvedImages.length - 1 ? 0 : prev + 1);

  const onTouchStart = (e: React.TouchEvent) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e: React.TouchEvent) => { setTouchEnd(e.targetTouches[0].clientX); };
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance) handleNext();
    if (distance < -minSwipeDistance) handlePrevious();
  };

  const handleDownload = async () => {
    const currentImage = resolvedImages[selectedImageIndex];
    if (!currentImage) return;
    try {
      const response = await fetch(currentImage.image_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = currentImage.image_name || `image-${selectedImageIndex + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Download failed:', error);
    }
  };

  const renderThumbnails = () => {
    if (resolvedImages.length === 1) {
      return (
        <LazyImage
          src={resolvedImages[0].image_url}
          alt="Visit photo"
          wrapperClassName="w-16 h-16 rounded hover:opacity-80 transition-opacity"
          onClick={() => setIsOpen(true)}
        />
      );
    }
    return (
      <div className="flex gap-1">
        <LazyImage
          src={resolvedImages[0].image_url}
          alt="Visit photo"
          wrapperClassName="w-16 h-16 rounded hover:opacity-80 transition-opacity"
          onClick={() => setIsOpen(true)}
        />
        {resolvedImages.length > 1 && (
          <div className="w-16 h-16 bg-muted rounded flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors text-xs font-medium"
            onClick={() => setIsOpen(true)}>+{resolvedImages.length - 1}</div>
        )}
      </div>
    );
  };

  return (
    <div className={className}>
      {renderThumbnails()}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl w-full h-[90vh] p-0 flex flex-col bg-black/95 border-none">
          <div className="relative flex-1 flex items-center justify-center overflow-hidden"
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <Button variant="ghost" size="icon"
              className="absolute top-4 right-4 z-50 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
              onClick={() => setIsOpen(false)}><X className="h-6 w-6" /></Button>
            <Button variant="ghost" size="icon"
              className="absolute top-4 right-16 z-50 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
              onClick={handleDownload} title="Download Image"><Download className="h-6 w-6" /></Button>
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <LazyImage src={resolvedImages[selectedImageIndex]?.image_url} alt={`Image ${selectedImageIndex + 1}`}
                fit="contain" eager wrapperClassName="w-full h-full bg-transparent" />
              {resolvedImages.length > 1 && (
                <>
                  <Button variant="ghost" size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full h-10 w-10"
                    onClick={(e) => { e.stopPropagation(); handlePrevious(); }}><ChevronLeft className="h-6 w-6" /></Button>
                  <Button variant="ghost" size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full h-10 w-10"
                    onClick={(e) => { e.stopPropagation(); handleNext(); }}><ChevronRight className="h-6 w-6" /></Button>
                </>
              )}
            </div>
            {resolvedImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                {selectedImageIndex + 1} / {resolvedImages.length}
              </div>
            )}
          </div>
          {resolvedImages.length > 1 && (
            <div className="flex gap-2 p-4 justify-center overflow-x-auto bg-black/90">
              {resolvedImages.map((image, index) => (
                <LazyImage key={image.id} src={image.image_url} alt={`Thumbnail ${index + 1}`}
                  wrapperClassName={`w-12 h-12 rounded transition-all ${index === selectedImageIndex ? 'ring-2 ring-primary opacity-100' : 'opacity-50 hover:opacity-80'}`}
                  onClick={() => setSelectedImageIndex(index)} />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
