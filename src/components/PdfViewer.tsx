"use client";

import React, { useState, useEffect } from 'react';

interface PdfViewerProps {
  file: File | null;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ file }) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      
      // Get number of pages from PDF using FileReader
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          // Use dynamic import for pdfjs-dist
          const pdfjsLib = await import('pdfjs-dist');
          // Set worker source - use local worker file from public folder
          if (typeof window !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
          }
          
          const loadingTask = pdfjsLib.getDocument({ data: e.target?.result as ArrayBuffer });
          const pdf = await loadingTask.promise;
          setNumPages(pdf.numPages);
        } catch (error) {
          console.error('Error loading PDF:', error);
          // Fallback: assume 1 page if we can't determine
          setNumPages(1);
        }
      };
      reader.readAsArrayBuffer(file);
    }

    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [file]);

  if (!file || !fileUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-200">
        <p className="text-gray-500">No PDF file loaded</p>
      </div>
    );
  }

  const goToPage = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="w-full h-full bg-white flex flex-col">
      {/* Page Navigation */}
      {numPages > 1 && (
        <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between shadow-sm flex-shrink-0 z-10">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-1.5 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            ← Previous
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Page</span>
            <input
              type="number"
              min="1"
              max={numPages}
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e.target.value);
                if (!isNaN(page)) goToPage(page);
              }}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">of {numPages}</span>
          </div>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === numPages}
            className="px-4 py-1.5 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Next →
          </button>
        </div>
      )}

      {/* PDF Display - Fit to A4 container */}
      <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-2">
        <iframe
          src={`${fileUrl}#page=${currentPage}&zoom=page-fit`}
          className="w-full h-full border-0 bg-white"
          title="PDF Viewer"
          style={{ 
            display: 'block',
            width: '100%',
            height: '100%'
          }}
        />
      </div>
    </div>
  );
};

export default PdfViewer;

