import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useLanguage } from '../utils/i18n';

interface Photo {
  url: string;
  caption?: string;
  title: string;
}

interface AdvancedPhotoGalleryProps {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
}

export default function AdvancedPhotoGallery({ photos, initialIndex, onClose }: AdvancedPhotoGalleryProps) {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const imageRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const currentPhoto = photos[currentIndex];

  // Reset zoom and position when changing photos
  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-' || e.key === '_') handleZoomOut();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, zoom]);

  const handleNext = () => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleZoomIn = () => {
    setZoom(Math.min(zoom + 0.5, 5));
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - 0.5, 1);
    setZoom(newZoom);
    if (newZoom === 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleRotate = () => {
    setRotation((rotation + 90) % 360);
  };

  // Mouse drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch gestures for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || zoom > 1) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    
    // Swipe detection
    if (Math.abs(deltaX) > 50) {
      if (deltaX > 0 && currentIndex > 0) {
        handlePrevious();
      } else if (deltaX < 0 && currentIndex < photos.length - 1) {
        handleNext();
      }
      touchStartRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
  };

  // Pinch zoom for mobile
  useEffect(() => {
    let initialDistance = 0;
    let initialZoom = 1;

    const handleTouchStartPinch = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        initialZoom = zoom;
      }
    };

    const handleTouchMovePinch = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        const scale = currentDistance / initialDistance;
        const newZoom = Math.max(1, Math.min(5, initialZoom * scale));
        setZoom(newZoom);
        if (newZoom === 1) {
          setPosition({ x: 0, y: 0 });
        }
      }
    };

    const el = imageRef.current;
    if (el) {
      el.addEventListener('touchstart', handleTouchStartPinch, { passive: false });
      el.addEventListener('touchmove', handleTouchMovePinch, { passive: false });
    }

    return () => {
      if (el) {
        el.removeEventListener('touchstart', handleTouchStartPinch);
        el.removeEventListener('touchmove', handleTouchMovePinch);
      }
    };
  }, [zoom]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black"
        onClick={(e) => {
          if (e.target === e.currentTarget && zoom === 1) onClose();
        }}
      >
        {/* Header Controls */}
        <div className="absolute top-0 left-0 right-0 z-50 p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="text-white">
              <p className="font-bold text-lg">{currentPhoto.title}</p>
              <p className="text-sm text-gray-300">
                {currentIndex + 1} {t('of')} {photos.length}
              </p>
            </div>
            
            <button
              onClick={onClose}
              className="p-3 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-full transition-apple shadow-apple-md"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Main Image */}
        <div
          ref={imageRef}
          className="w-full h-full flex items-center justify-center p-4 cursor-move"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <motion.div
            animate={{
              scale: zoom,
              x: position.x,
              y: position.y,
              rotate: rotation,
            }}
            transition={{ type: 'tween', duration: 0.2 }}
            className="max-w-full max-h-full select-none"
            style={{ cursor: zoom > 1 ? 'move' : 'default' }}
          >
            <ImageWithFallback
              src={currentPhoto.url}
              alt={currentPhoto.caption || currentPhoto.title}
              className="max-h-[80vh] max-w-full object-contain pointer-events-none"
              draggable={false}
            />
          </motion.div>
        </div>

        {/* Navigation Arrows */}
        {photos.length > 1 && (
          <>
            {currentIndex > 0 && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handlePrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-full transition-apple shadow-apple-lg z-40"
              >
                <ChevronLeft className="w-8 h-8 text-white" />
              </motion.button>
            )}
            
            {currentIndex < photos.length - 1 && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-full transition-apple shadow-apple-lg z-40"
              >
                <ChevronRight className="w-8 h-8 text-white" />
              </motion.button>
            )}
          </>
        )}

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="max-w-7xl mx-auto">
            {/* Zoom Controls */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 1}
                className="p-3 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-xl transition-apple disabled:opacity-30 disabled:cursor-not-allowed shadow-apple-md"
              >
                <ZoomOut className="w-5 h-5 text-white" />
              </button>
              
              <div className="px-6 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white font-semibold shadow-apple-md">
                {Math.round(zoom * 100)}%
              </div>
              
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 5}
                className="p-3 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-xl transition-apple disabled:opacity-30 disabled:cursor-not-allowed shadow-apple-md"
              >
                <ZoomIn className="w-5 h-5 text-white" />
              </button>
              
              <button
                onClick={handleRotate}
                className="p-3 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-xl transition-apple shadow-apple-md"
              >
                <RotateCw className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Caption */}
            {currentPhoto.caption && (
              <div className="text-center">
                <p className="text-gray-200">{currentPhoto.caption}</p>
              </div>
            )}

            {/* Thumbnail Strip */}
            {photos.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar justify-center pb-2">
                {photos.map((photo, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setCurrentIndex(idx)}
                    className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shadow-apple-sm ${
                      idx === currentIndex
                        ? 'border-primary ring-2 ring-primary/50'
                        : 'border-white/30 hover:border-white/60'
                    }`}
                  >
                    <ImageWithFallback
                      src={photo.url}
                      alt={photo.title}
                      className="w-full h-full object-cover"
                    />
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Hint Text (only on first view) */}
        {zoom === 1 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/50 text-sm pointer-events-none">
            <p className="text-center">
              <span className="hidden md:block">{t('zoomHint')}</span>
              <span className="md:hidden">{t('mobileZoomHint')}</span>
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}