// components/InteractiveImageCropper.tsx
'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Move, Maximize2, Minimize2, RotateCw, Upload, Check, X } from 'lucide-react';

interface InteractiveImageCropperProps {
  isOpen: boolean;
  onClose: () => void;
  onImageReady: (file: File, imageUrl: string) => void;
  aspectRatio?: number; // width/height = 4/5 = 0.8
}

export default function InteractiveImageCropper({
  isOpen,
  onClose,
  onImageReady,
  aspectRatio = 4/5 // 4:5 ratio
}: InteractiveImageCropperProps) {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3;
  const ZOOM_STEP = 0.1;
  const CROP_WIDTH = 320; // 4:5 crop area width (4/5 * height)
  const CROP_HEIGHT = 400; // 4:5 crop area height

  // Initialize canvas for preview
  useEffect(() => {
    if (!originalImage) return;
    
    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
      
      // Calculate initial scale to fit crop area
      const container = containerRef.current;
      if (container) {
        const containerWidth = container.clientWidth - 40;
        const containerHeight = container.clientHeight - 40;
        
        // Scale to fit within container while maintaining aspect ratio
        const scaleX = containerWidth / img.width;
        const scaleY = containerHeight / img.height;
        const initialScale = Math.min(scaleX, scaleY, 1);
        
        setScale(initialScale);
        
        // Center the image initially
        const scaledWidth = img.width * initialScale;
        const scaledHeight = img.height * initialScale;
        const initialX = (containerWidth - scaledWidth) / 2;
        const initialY = (containerHeight - scaledHeight) / 2;
        
        setPosition({ x: initialX, y: initialY });
      }
      
      generatePreview(img);
    };
    img.src = originalImage;
  }, [originalImage, rotation]);

  // Generate cropped preview
  const generatePreview = useCallback((img?: HTMLImageElement) => {
    if (!canvasRef.current || (!img && !imageRef.current)) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const sourceImg = img || imageRef.current;
    if (!sourceImg) return;
    
    // Set canvas to crop dimensions
    canvas.width = CROP_WIDTH;
    canvas.height = CROP_HEIGHT;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate crop coordinates in the scaled image
    const container = containerRef.current;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const cropAreaLeft = (containerRect.width - CROP_WIDTH) / 2;
    const cropAreaTop = (containerRect.height - CROP_HEIGHT) / 2;
    
    // Calculate source coordinates (accounting for scale and position)
    const sourceX = (cropAreaLeft - position.x) / scale;
    const sourceY = (cropAreaTop - position.y) / scale;
    const sourceWidth = CROP_WIDTH / scale;
    const sourceHeight = CROP_HEIGHT / scale;
    
    // Draw cropped portion
    ctx.drawImage(
      sourceImg,
      sourceX, sourceY, sourceWidth, sourceHeight, // Source rectangle
      0, 0, CROP_WIDTH, CROP_HEIGHT // Destination rectangle
    );
    
    // Update preview URL
    setPreviewUrl(canvas.toDataURL('image/jpeg', 0.9));
  }, [position, scale, CROP_WIDTH, CROP_HEIGHT]);

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (file.size > 10 * 1024 * 1024) {
      alert('Image too large (max 10MB)');
      return;
    }

    setOriginalFile(file);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setOriginalImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Panning (dragging)
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    setPosition(prev => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY
    }));
    
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (imageRef.current) {
      generatePreview();
    }
  };

  // Zoom functions
  const zoomIn = () => {
    setScale(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  };

  const zoomToFit = () => {
    if (!containerRef.current || !imageDimensions.width) return;
    
    const container = containerRef.current;
    const containerWidth = container.clientWidth - 40;
    const containerHeight = container.clientHeight - 40;
    
    const scaleX = containerWidth / imageDimensions.width;
    const scaleY = containerHeight / imageDimensions.height;
    const newScale = Math.min(scaleX, scaleY, 1);
    
    setScale(newScale);
    
    // Re-center
    const scaledWidth = imageDimensions.width * newScale;
    const scaledHeight = imageDimensions.height * newScale;
    const newX = (containerWidth - scaledWidth) / 2;
    const newY = (containerHeight - scaledHeight) / 2;
    
    setPosition({ x: newX, y: newY });
  };

  const zoomToFill = () => {
    if (!containerRef.current || !imageDimensions.width) return;
    
    const container = containerRef.current;
    const containerWidth = container.clientWidth - 40;
    const containerHeight = container.clientHeight - 40;
    
    // Scale to fill while maintaining aspect ratio
    const scaleX = containerWidth / imageDimensions.width;
    const scaleY = containerHeight / imageDimensions.height;
    const newScale = Math.max(scaleX, scaleY);
    
    setScale(Math.min(newScale, MAX_ZOOM));
    
    // Re-center
    const scaledWidth = imageDimensions.width * newScale;
    const scaledHeight = imageDimensions.height * newScale;
    const newX = (containerWidth - scaledWidth) / 2;
    const newY = (containerHeight - scaledHeight) / 2;
    
    setPosition({ x: newX, y: newY });
  };

  // Rotate
  const rotateImage = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch(e.key) {
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
          e.preventDefault();
          zoomOut();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          rotateImage();
          break;
        case '0':
          e.preventDefault();
          zoomToFit();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setPosition(prev => ({ ...prev, y: prev.y + 10 }));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setPosition(prev => ({ ...prev, y: prev.y - 10 }));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setPosition(prev => ({ ...prev, x: prev.x + 10 }));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setPosition(prev => ({ ...prev, x: prev.x - 10 }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Handle final crop and upload
  const handleCropAndUpload = async () => {
    if (!originalFile || !previewUrl) return;
    
    setIsProcessing(true);
    
    try {
      // Convert preview data URL to blob
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      
      // Create new file with cropped image
      const croppedFile = new File([blob], originalFile.name.replace(/\.[^/.]+$/, '') + '_cropped.jpg', {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
      
      // Upload to server for final processing
      const imageUrl = await uploadToServer(croppedFile);
      
      onImageReady(croppedFile, imageUrl);
      resetCropper();
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const uploadToServer = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('aspectRatio', '4:5');
    
    const response = await fetch('/api/upload-product-image', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('Upload failed');
    }
    
    const data = await response.json();
    return data.url;
  };

  const resetCropper = () => {
    setOriginalFile(null);
    setOriginalImage(null);
    setImageDimensions({ width: 0, height: 0 });
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
    setPreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Crop Product Image</h2>
            <p className="text-gray-600 text-sm mt-1">
              Pan and zoom to adjust the 4:5 crop area • Drag image to reposition
            </p>
          </div>
          <button
            onClick={() => {
              resetCropper();
              onClose();
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-3 gap-6 p-6">
          {/* Left Panel - Controls */}
          <div className="space-y-6">
            {/* Zoom Controls */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-medium text-gray-700 mb-3">Zoom & Pan</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={zoomOut}
                    className="flex items-center justify-center gap-2 p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <ZoomOut size={20} />
                    <span>Zoom Out</span>
                  </button>
                  <button
                    onClick={zoomIn}
                    className="flex items-center justify-center gap-2 p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <ZoomIn size={20} />
                    <span>Zoom In</span>
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={zoomToFit}
                    className="flex items-center justify-center gap-2 p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <Minimize2 size={20} />
                    <span>Fit to Area</span>
                  </button>
                  <button
                    onClick={zoomToFill}
                    className="flex items-center justify-center gap-2 p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <Maximize2 size={20} />
                    <span>Fill Area</span>
                  </button>
                </div>
                
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Zoom Level</span>
                    <span className="text-sm font-medium">{Math.round(scale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={MIN_ZOOM * 100}
                    max={MAX_ZOOM * 100}
                    value={scale * 100}
                    onChange={(e) => setScale(parseInt(e.target.value) / 100)}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Transform Controls */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-medium text-gray-700 mb-3">Transform</h3>
              <div className="space-y-3">
                <button
                  onClick={rotateImage}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <RotateCw size={20} />
                  <span>Rotate 90° (R)</span>
                </button>
                
                <div className="pt-3 border-t">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Pan Controls</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-center p-2 bg-white border border-gray-300 rounded">
                      <div className="font-medium">← → ↑ ↓</div>
                      <div className="text-gray-500 text-xs">Arrow keys to pan</div>
                    </div>
                    <div className="text-center p-2 bg-white border border-gray-300 rounded">
                      <div className="font-medium">Drag</div>
                      <div className="text-gray-500 text-xs">Click & drag image</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Image Info */}
            {originalFile && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-medium text-gray-700 mb-2">Image Info</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Original Size:</span>
                    <span className="font-medium">
                      {imageDimensions.width} × {imageDimensions.height}px
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Crop Size:</span>
                    <span className="font-medium">
                      {CROP_WIDTH} × {CROP_HEIGHT}px (4:5)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">File Size:</span>
                    <span className="font-medium">
                      {(originalFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Center Panel - Cropping Area */}
          <div className="col-span-2 flex flex-col">
            <div className="flex-1 relative bg-gray-900 rounded-xl overflow-hidden">
              {!originalImage ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/*"
                      className="hidden"
                      id="crop-image-input"
                    />
                    <label
                      htmlFor="crop-image-input"
                      className="inline-flex flex-col items-center cursor-pointer p-8 border-2 border-dashed border-gray-600 rounded-lg hover:border-orange-500"
                    >
                      <div className="w-20 h-20 mb-4 bg-gray-800 rounded-full flex items-center justify-center">
                        <Upload className="text-gray-400" size={32} />
                      </div>
                      <p className="text-white font-medium">Click to select an image</p>
                      <p className="text-gray-400 text-sm mt-2">or drag and drop</p>
                      <p className="text-gray-500 text-xs mt-4">JPG, PNG, WebP • Max 10MB</p>
                    </label>
                  </div>
                </div>
              ) : (
                <div
                  ref={containerRef}
                  className="relative w-full h-full overflow-hidden"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {/* Image being cropped */}
                  {originalImage && (
                    <img
                      ref={imageRef}
                      src={originalImage}
                      alt="Crop preview"
                      className="absolute select-none z-10"
                      style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                        transformOrigin: '0 0',
                        cursor: isDragging ? 'grabbing' : 'grab'
                      }}
                      onLoad={() => generatePreview()}
                    />
                  )}

                  {/* 4:5 Crop Overlay */}
                  <div className="absolute inset-0 pointer-events-none z-20">
                    {/* Semi-transparent overlay outside crop area */}
                    <div className="absolute inset-0 bg-black/50" />
                    
                    {/* Crop area window - transparent area */}
                    <div 
                      className="absolute border-4 border-white shadow-2xl"
                      style={{
                        width: `${CROP_WIDTH}px`,
                        height: `${CROP_HEIGHT}px`,
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
                      }}
                    />
                    
                    {/* Aspect ratio indicator */}
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium z-30">
                      4:5 Ratio
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Preview Panel - Always show when image is loaded */}
            {originalImage && (
              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-700">Preview (4:5 Cropped)</h3>
                  <div className="text-xs text-gray-500">
                    {CROP_WIDTH}×{CROP_HEIGHT}px • {(scale * 100).toFixed(0)}% zoom
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="w-32 h-40 border-2 border-gray-300 rounded-lg overflow-hidden flex-shrink-0">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Cropped preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <p className="text-gray-500 text-xs">Adjust image to see preview</p>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 mb-3">
                      This is how your image will appear in the menu. You can continue to adjust using the controls.
                    </p>
                    <button
                      onClick={handleCropAndUpload}
                      disabled={isProcessing || !previewUrl}
                      className="bg-orange-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <Check size={20} />
                          Use This Crop
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Keyboard Shortcuts Help */}
        <div className="px-6 py-3 bg-gray-900 text-gray-300 text-sm border-t border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">+</kbd>
                <span>Zoom In</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">-</kbd>
                <span>Zoom Out</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">R</kbd>
                <span>Rotate</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">0</kbd>
                <span>Fit to Area</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Move size={16} />
              <span>Click & drag to pan image</span>
            </div>
          </div>
        </div>
        
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}