import { useEffect, useRef, useState, memo } from 'react';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LazyImageProps {
  src?: string | null;
  alt?: string;
  /** Classes applied to the <img> itself */
  className?: string;
  /** Classes applied to the wrapper that holds the blur placeholder */
  wrapperClassName?: string;
  /** object-fit behaviour of the image */
  fit?: 'cover' | 'contain';
  /** Distance from the viewport at which loading starts */
  rootMargin?: string;
  /** Skip the IntersectionObserver and load immediately (e.g. LCP image) */
  eager?: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  /** Optional tiny base64/blur data URI used as the placeholder backdrop */
  placeholderSrc?: string;
}

/**
 * Viewport-aware image with a blur-up placeholder.
 *
 * - Nothing is requested until the element is within `rootMargin` of the viewport.
 * - While loading, a shimmering blurred placeholder occupies the exact box, so
 *   there is zero layout shift.
 * - Decodes off the main thread and cross-fades in when ready.
 */
export const LazyImage = memo(({
  src,
  alt = '',
  className,
  wrapperClassName,
  fit = 'cover',
  rootMargin = '200px',
  eager = false,
  onClick,
  placeholderSrc,
}: LazyImageProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(eager);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Reset visual state whenever the source changes (signed URLs refresh often)
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  useEffect(() => {
    if (eager || inView) return;
    const el = wrapperRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, inView, rootMargin]);

  return (
    <div
      ref={wrapperRef}
      onClick={onClick}
      className={cn(
        'relative overflow-hidden bg-muted/60 isolate',
        onClick && 'cursor-pointer',
        wrapperClassName,
      )}
    >
      {/* Blur / shimmer placeholder — sits underneath until the image decodes */}
      {!loaded && !failed && (
        <div className="absolute inset-0 z-0" aria-hidden="true">
          {placeholderSrc ? (
            <img
              src={placeholderSrc}
              alt=""
              className="h-full w-full scale-110 object-cover blur-md"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-muted via-muted/40 to-muted animate-pulse" />
          )}
          <div className="absolute inset-0 lazy-shimmer" />
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
          <ImageIcon className="h-1/3 w-1/3 max-h-8 max-w-8 text-muted-foreground" />
        </div>
      )}

      {inView && src && !failed && (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={eager ? 'high' : 'low'}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            'relative z-[1] h-full w-full transition-[opacity,filter] duration-500 ease-out',
            fit === 'cover' ? 'object-cover' : 'object-contain',
            loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm',
            className,
          )}
        />
      )}
    </div>
  );
});

LazyImage.displayName = 'LazyImage';
