'use client';
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react';

interface PDFViewerProps {
  pdfUrl: string;
}

export default function PDFViewer({ pdfUrl }: PDFViewerProps) {
  const [scale, setScale] = useState(1);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simple PDF viewer using iframe as fallback
  // In a production environment, you might want to use react-pdf or PDF.js
  useEffect(() => {
    // For now, we'll use a simple iframe approach
    // This works for most browsers and doesn't require additional dependencies
    setLoading(false);
  }, [pdfUrl]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleFitWidth = () => {
    setScale(1);
  };

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <X size={48} className="mx-auto mb-4 text-red-500" />
          <h3 className="text-lg font-semibold mb-2">Failed to load PDF</h3>
          <p className="text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-100 flex flex-col overflow-hidden">
      {/* PDF Content - Full height without header */}
      <div className="flex-1 overflow-hidden flex items-center justify-center p-2">
        {loading ? (
          <div className="text-center text-gray-600">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 mx-auto mb-2"></div>
            <p className="text-xs">Loading PDF...</p>
          </div>
        ) : (
          <div className="bg-white shadow-lg rounded" style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
              className="border-0 rounded"
              style={{
                width: '400px',
                height: '250px',
                minWidth: '250px',
                minHeight: '150px',
                maxWidth: '100%',
                maxHeight: '100%'
              }}
              title="Menu PDF"
              onError={() => setError('Failed to load PDF file')}
            />
          </div>
        )}
      </div>

      {/* Simple controls at bottom */}
      <div className="bg-white border-t border-gray-200 p-2 flex items-center justify-center gap-2 shrink-0">
        <button
          onClick={handleZoomOut}
          className="p-1 hover:bg-gray-100 rounded text-gray-600"
          title="Zoom out"
        >
          <ZoomOut size={14} />
        </button>
        <span className="text-xs text-gray-600 min-w-[40px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-1 hover:bg-gray-100 rounded text-gray-600"
          title="Zoom in"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={handleFitWidth}
          className="p-1 hover:bg-gray-100 rounded text-gray-600"
          title="Fit to width"
        >
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  );
}
