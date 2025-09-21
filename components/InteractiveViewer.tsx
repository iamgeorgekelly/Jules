import React, { useState, useRef, useEffect, useCallback } from 'react';

interface InteractiveViewerProps {
  imageUrls: string[];
  productName: string;
}

const InteractiveViewer: React.FC<InteractiveViewerProps> = ({ imageUrls, productName }) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startFrameRef = useRef(0);
  
  const isPanningRef = useRef(false);
  const panStartRef = useRef({x: 0, y: 0});

  const containerRef = useRef<HTMLDivElement>(null);

  const totalFrames = imageUrls.length;

  useEffect(() => {
    // Preload images for smoother rotation
    imageUrls.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, [imageUrls]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.button === 0) { // Left click for rotation
        isDraggingRef.current = true;
        startXRef.current = e.clientX;
        startFrameRef.current = currentFrame;
        (e.target as HTMLElement).style.cursor = 'grabbing';
    } else if (e.button === 1) { // Middle click for panning
        isPanningRef.current = true;
        panStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
        (e.target as HTMLElement).style.cursor = 'move';
    }
  }, [currentFrame, offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - startXRef.current;
      // Sensitivity: how many pixels of drag per frame change. Lower is faster.
      const sensitivity = 15;
      const frameOffset = Math.round(dx / sensitivity);
      const newFrame = (startFrameRef.current - frameOffset) % totalFrames;
      setCurrentFrame(newFrame >= 0 ? newFrame : newFrame + totalFrames);
    }
    if(isPanningRef.current){
        setOffset({
            x: e.clientX - panStartRef.current.x,
            y: e.clientY - panStartRef.current.y,
        });
    }
  }, [totalFrames]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
    (e.target as HTMLElement).style.cursor = 'grab';
  }, []);
  
  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
     (e.target as HTMLElement).style.cursor = 'grab';
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    let newScale = scale - e.deltaY * 0.001 * zoomFactor * scale;
    newScale = Math.min(Math.max(0.5, newScale), 5); // Clamp scale
    
    if (Math.abs(newScale - 1) < 0.05) {
      newScale = 1;
      setOffset({ x: 0, y: 0 }); // Reset offset when scale is near 1
    }

    setScale(newScale);
  }, [scale]);

  const handleDoubleClick = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  return (
    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 space-y-3">
        <h3 className="font-medium text-slate-200 text-center">{productName}</h3>
        <div
            ref={containerRef}
            className="w-full h-64 md:h-80 bg-slate-700/50 rounded-md cursor-grab overflow-hidden relative touch-none select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}
            onContextMenu={(e) => e.preventDefault()} // Prevent context menu on right/middle click
        >
        {imageUrls.length > 0 && (
          <img
            src={imageUrls[currentFrame]}
            alt={`Turntable view for ${productName}, frame ${currentFrame + 1}`}
            className="w-full h-full object-contain pointer-events-none"
            style={{ 
                transform: `scale(${scale}) translate(${offset.x}px, ${offset.y}px)`,
                transition: isPanningRef.current ? 'none' : 'transform 0.1s ease-out',
            }}
            draggable="false"
          />
        )}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded-full pointer-events-none">
          Drag to rotate | Scroll to zoom | Double-click to reset
        </div>
      </div>
    </div>
  );
};

export default InteractiveViewer;
