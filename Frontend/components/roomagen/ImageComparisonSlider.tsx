'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ImageComparisonSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  aspectRatio?: string;
}

export function ImageComparisonSlider({
  beforeImage,
  afterImage,
  beforeLabel = 'Original Sketch',
  afterLabel = 'AI Floor Plan',
  aspectRatio = 'aspect-[4/3] md:aspect-[16/10]',
}: ImageComparisonSliderProps) {
  const [sliderPos, setSliderPos] = useState<number>(50); // percentage 0 - 100
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'slider' | 'sideBySide'>('slider');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));
    setSliderPos(percent);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  }, [isDragging, handleMove]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  }, [isDragging, handleMove]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      setSliderPos((p) => Math.max(0, p - 5));
    } else if (e.key === 'ArrowRight') {
      setSliderPos((p) => Math.min(100, p + 5));
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, []);

  return (
    <div className={`relative flex flex-col rounded-xl overflow-hidden border border-outline-variant dark:border-outline bg-surface-container-low dark:bg-surface-dim ${isFullscreen ? 'fixed inset-4 z-50 shadow-2xl m-auto max-w-6xl max-h-[90vh]' : ''}`}>
      {/* Viewer Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface-container-high/60 dark:bg-surface-variant/40 border-b border-outline-variant dark:border-outline backdrop-blur-sm z-20">
        <div className="flex items-center gap-2">
          <span className="text-label-md font-medium text-on-surface dark:text-inverse-on-surface">
            Comparison View
          </span>
          <div className="inline-flex rounded-lg border border-outline-variant dark:border-outline p-0.5 bg-surface dark:bg-surface-container-low">
            <button
              onClick={() => setViewMode('slider')}
              className={`px-2.5 py-1 text-label-sm rounded-md transition-colors ${viewMode === 'slider' ? 'bg-primary-container text-white font-medium' : 'text-on-surface-variant hover:text-on-surface'}`}
              title="Interactive Slider Mode"
            >
              Slider
            </button>
            <button
              onClick={() => setViewMode('sideBySide')}
              className={`px-2.5 py-1 text-label-sm rounded-md transition-colors ${viewMode === 'sideBySide' ? 'bg-primary-container text-white font-medium' : 'text-on-surface-variant hover:text-on-surface'}`}
              title="Side-by-Side Comparison"
            >
              Side by Side
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-variant transition-colors"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <span className="material-symbols-outlined text-[18px]">zoom_out</span>
          </button>
          <span className="text-label-sm text-on-surface-variant px-1 select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-variant transition-colors"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <span className="material-symbols-outlined text-[18px]">zoom_in</span>
          </button>
          <button
            onClick={() => setZoom(1)}
            className="px-2 py-1 text-label-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-variant transition-colors"
            title="Reset Zoom"
          >
            Reset
          </button>
          <div className="w-px h-4 bg-outline-variant dark:bg-outline mx-1" />
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-variant transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'sideBySide' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 overflow-auto flex-1 bg-surface-container-lowest dark:bg-surface-dim">
          <div className="flex flex-col gap-1.5">
            <span className="text-label-sm font-semibold text-on-surface-variant dark:text-surface-variant px-1">
              {beforeLabel}
            </span>
            <div className={`relative ${aspectRatio} rounded-lg overflow-hidden border border-outline-variant/60 bg-black/5 dark:bg-white/5 flex items-center justify-center`}>
              <img
                src={beforeImage}
                alt={beforeLabel}
                className="max-w-full max-h-full object-contain transition-transform"
                style={{ transform: `scale(${zoom})` }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-label-sm font-semibold text-primary dark:text-primary-fixed-dim px-1">
              {afterLabel}
            </span>
            <div className={`relative ${aspectRatio} rounded-lg overflow-hidden border border-outline-variant/60 bg-black/5 dark:bg-white/5 flex items-center justify-center`}>
              <img
                src={afterImage}
                alt={afterLabel}
                className="max-w-full max-h-full object-contain transition-transform"
                style={{ transform: `scale(${zoom})` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className={`relative ${aspectRatio} select-none overflow-hidden cursor-ew-resize bg-surface-container-lowest dark:bg-surface-dim flex items-center justify-center`}
          onMouseDown={() => setIsDragging(true)}
          onMouseMove={handleMouseMove}
          onTouchStart={() => setIsDragging(true)}
          onTouchMove={handleTouchMove}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          aria-label="Comparison slider. Use left and right arrow keys to adjust."
        >
          {/* Base Layer: AI Generated Output (After) */}
          <div
            className="absolute inset-0 flex items-center justify-center p-2"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          >
            <img
              src={afterImage}
              alt={afterLabel}
              className="max-w-full max-h-full object-contain pointer-events-none"
              draggable={false}
            />
          </div>
          <span className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full text-label-sm font-semibold bg-primary-container text-white shadow-sm pointer-events-none">
            {afterLabel}
          </span>

          {/* Top Layer: Original Sketch (Before) with Clip Path */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
          >
            <div
              className="absolute inset-0 flex items-center justify-center p-2"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            >
              <img
                src={beforeImage}
                alt={beforeLabel}
                className="max-w-full max-h-full object-contain pointer-events-none"
                draggable={false}
              />
            </div>
            <span className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full text-label-sm font-semibold bg-black/70 text-white shadow-sm pointer-events-none">
              {beforeLabel}
            </span>
          </div>

          {/* Divider Handle Bar */}
          <div
            className="absolute top-0 bottom-0 z-20 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)] pointer-events-none"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white dark:bg-surface-dim border-2 border-primary shadow-lg flex items-center justify-center pointer-events-none">
              <span className="material-symbols-outlined text-[16px] text-primary">
                sync_alt
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
