import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface Photo {
  url: string;
  caption?: string;
}

interface PhotoZoomViewerProps {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
}

export default function PhotoZoomViewer({ photos, initialIndex, onClose }: PhotoZoomViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const imageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentPhoto = photos[currentIndex];

  // Reset zoom when changing photos
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const nextPhoto = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Touch pinch zoom
  const touchStartRef = useRef<{ dist: number; scale: number } | null>(null);

  const getTouchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = getTouchDistance(e.touches);
      touchStartRef.current = { dist, scale };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartRef.current) {
      e.preventDefault();
      const dist = getTouchDistance(e.touches);
      const newScale = (dist / touchStartRef.current.dist) * touchStartRef.current.scale;
      setScale(Math.min(Math.max(newScale, 0.5), 5));
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
  };

  // Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-' || e.key === '_') handleZoomOut();
      if (e.key === '0') handleReset();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-black/50 backdrop-blur-sm">
        <button 
          onClick={onClose}
          className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="text-white text-sm font-medium">
          {currentIndex + 1} / {photos.length}
        </div>
        
        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button 
            onClick={handleZoomOut}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            disabled={scale <= 0.5}
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-white text-sm font-medium min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button 
            onClick={handleZoomIn}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            disabled={scale >= 5}
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button 
            onClick={handleReset}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image container */}
      <div 
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          ref={imageRef}
          className={`select-none ${scale > 1 ? 'cursor-move' : 'cursor-default'}`}
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img 
            src={currentPhoto.url} 
            alt={currentPhoto.caption || 'Photo'} 
            className="max-w-[90vw] max-h-[80vh] object-contain pointer-events-none"
            draggable={false}
          />
        </div>

        {/* Navigation arrows */}
        {photos.length > 1 && (
          <>
            <button 
              onClick={prevPhoto}
              className="absolute left-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors backdrop-blur-sm z-10"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button 
              onClick={nextPhoto}
              className="absolute right-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors backdrop-blur-sm z-10"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </>
        )}
      </div>

      {/* Caption */}
      {currentPhoto.caption && (
        <div className="p-4 bg-black/50 backdrop-blur-sm text-white text-center">
          {currentPhoto.caption}
        </div>
      )}

      {/* Hint */}
      <div className="p-2 bg-black/30 backdrop-blur-sm text-white/70 text-xs text-center hidden sm:block">
        Use +/- to zoom, Arrow keys to navigate, 0 to reset, Esc to close
      </div>
      <div className="p-2 bg-black/30 backdrop-blur-sm text-white/70 text-xs text-center sm:hidden">
        Pinch to zoom, Swipe to navigate
      </div>
    </div>
  );
}
