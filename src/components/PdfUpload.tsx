"use client";

import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { API_BASE_URL, MAX_FILE_SIZE, ACCEPTED_FILE_TYPES } from '@/src/lib/constants';
import { formatFileSize, isValidFileType, isValidFileSize, getErrorMessage } from '@/src/lib/utils';
import { useLanguage } from '@/src/contexts/LanguageContext';
import mockAnalysisTranslations from '@/src/lib/locales/mockAnalysis.json';
import PdfViewer from './PdfViewer';

// Translate mock analysis based on language
const translateMockAnalysis = (analysis: AnalysisResult, language: 'en' | 'tr'): AnalysisResult => {
  try {
    const translated = mockAnalysisTranslations[language];
    
    if (translated) {
      return {
        ...analysis,
        summary: translated.summary,
        missingSections: translated.missingSections,
        suggestions: translated.suggestions,
        scoring: {
          structure: { ...analysis.scoring.structure, reason: translated.scoring.structure.reason },
          language: { ...analysis.scoring.language, reason: translated.scoring.language.reason },
          relevance: { ...analysis.scoring.relevance, reason: translated.scoring.relevance.reason },
          technical: { ...analysis.scoring.technical, reason: translated.scoring.technical.reason },
          clarity: { ...analysis.scoring.clarity, reason: translated.scoring.clarity.reason }
        },
        interviewQuestions: translated.interviewQuestions
      };
    }
  } catch (error) {
    console.error('Failed to translate mock analysis:', error);
  }
  return analysis;
};

interface ParsedCvData {
  name: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  experience: string | null;
  education: string | null;
  rawText: string;
}

interface ScoringItem {
  score: number;
  reason: string;
}

interface AnalysisResult {
  summary: string;
  missingSections: string[];
  suggestions: string[];
  scoring: {
    structure: ScoringItem;
    language: ScoringItem;
    relevance: ScoringItem;
    technical: ScoringItem;
    clarity: ScoringItem;
  };
  interviewQuestions: {
    technical: string[];
    behavioral: string[];
    roleSpecific: string[];
  };
}

const PdfUpload = () => {
  const { t, language } = useLanguage();
  const [parsedData, setParsedData] = useState<ParsedCvData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisSource, setAnalysisSource] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showUploadArea, setShowUploadArea] = useState(true);
  const [showInterviewQuestions, setShowInterviewQuestions] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) {
      return;
    }
    const file = acceptedFiles[0];

    // Validate file type
    if (!isValidFileType(file, ACCEPTED_FILE_TYPES)) {
      setError(t('error.invalidFileType'));
      return;
    }

    // Validate file size
    if (!isValidFileSize(file, MAX_FILE_SIZE)) {
      setError(t('error.fileTooLarge', { size: formatFileSize(MAX_FILE_SIZE) }));
      return;
    }

    const formData = new FormData();
    formData.append('pdf', file);

    setLoading(true);
    setError(null);
    setParsedData(null);
    setAnalysis(null);
    setUploadSuccess(false);
    setUploadedFile(file);

    // 3 saniye bekleme simülasyonu
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      const response = await fetch(`${API_BASE_URL}/upload-pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setParsedData(data.parsedData);
      setUploadSuccess(true);
      setShowUploadArea(false); // Upload alanını gizle

      // Trigger AI analysis
      setAnalysisLoading(true);
      try {
        const aiResponse = await fetch(`${API_BASE_URL}/analyze-cv`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parsedData: data.parsedData }),
        });

        if (!aiResponse.ok) {
          const errorMessage = await getErrorMessage(aiResponse);
          throw new Error(errorMessage);
        }

        const aiData = await aiResponse.json();
        // Translate mock analysis if needed
        const analysis = aiData.analysis;
        setAnalysisSource(aiData.source);
        
        // Log debug info if available
        if (aiData.debug) {
          console.log('🔍 AI Analysis Debug Info:', aiData.debug);
        }
        if (aiData.error) {
          console.error('❌ AI Analysis Error:', aiData.error);
        }
        
        if (aiData.source === 'mock' || aiData.source === 'fallback-mock' || aiData.source === 'fallback-parse' || aiData.source === 'error-fallback') {
          // Translate mock analysis based on current language
          const translatedAnalysis = translateMockAnalysis(analysis, language);
          setAnalysis(translatedAnalysis);
        } else {
          setAnalysis(analysis);
        }
      } catch (aiErr) {
        console.error('Error analyzing CV:', aiErr);
        setError(aiErr instanceof Error ? aiErr.message : 'AI analysis failed');
      } finally {
        setAnalysisLoading(false);
      }
    } catch (error) {
      console.error('Error uploading PDF:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while processing the PDF');
      setParsedData(null);
    } finally {
      setLoading(false);
    }
  }, []);
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({ 
    onDrop, 
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: MAX_FILE_SIZE,
    multiple: false
  });

  // Update analysis when language changes (for mock analysis only)
  useEffect(() => {
    if (analysis && analysisSource && 
        (analysisSource === 'mock' || analysisSource === 'fallback-mock' || 
         analysisSource === 'fallback-parse' || analysisSource === 'error-fallback')) {
      const translatedAnalysis = translateMockAnalysis(analysis, language);
      setAnalysis(translatedAnalysis);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Upload area
  if (showUploadArea) {
    return (
      <div className="flex flex-col items-center justify-center w-full bg-gray-100 py-4 sm:py-6 px-2 sm:px-4 space-y-4 min-h-[60vh]">
        {loading && (
          <div className="w-full max-w-2xl rounded-lg border border-blue-200 bg-blue-50 px-4 py-6 text-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-blue-600 font-semibold text-lg">{t('upload.processing')}</p>
            </div>
          </div>
        )}

        {!loading && (
          <>
            <div
              {...getRootProps()}
              className={`border-dashed border-2 sm:border-4 rounded-lg p-6 sm:p-8 md:p-10 text-center transition-colors duration-200 w-full max-w-2xl ${
                'border-gray-400 cursor-pointer hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
              }`}
              role="button"
              tabIndex={0}
              aria-label="Upload PDF file"
            >
              <input {...getInputProps()} disabled={loading} aria-label="PDF file input" />
              {isDragActive ? (
                <div className="flex flex-col items-center space-y-2">
                  <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-gray-600 font-medium">{t('upload.dropHere')}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2">
                  <svg className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-gray-600 text-sm sm:text-base">{t('upload.dragDrop')}</p>
                  <p className="text-xs sm:text-sm text-gray-500">{t('upload.maxSize', { size: formatFileSize(MAX_FILE_SIZE) })}</p>
                </div>
              )}
            </div>

            {fileRejections.length > 0 && (
              <div className="w-full max-w-2xl p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg">
                <p className="font-semibold">{t('upload.fileRejected')}</p>
                {fileRejections.map(({ file, errors }) => (
                  <div key={file.name}>
                    <p className="text-sm">{file.name} ({formatFileSize(file.size)})</p>
                    <ul className="list-disc list-inside text-sm mt-1">
                      {errors.map((e) => (
                        <li key={e.code}>{e.message}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="w-full max-w-2xl p-3 sm:p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                <p className="font-semibold text-sm sm:text-base">{t('error.title')}</p>
                <p className="text-xs sm:text-sm mt-1">{error}</p>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Results view - Left: PDF, Right: Analysis
  return (
    <div className="w-full min-h-screen bg-gray-100 flex flex-col">
      {/* Back button and success message */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setShowUploadArea(true);
              setParsedData(null);
              setAnalysis(null);
              setUploadedFile(null);
              setUploadSuccess(false);
            }}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('common.back')}
          </button>
          
          {uploadSuccess && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-green-800">
              <p className="font-semibold text-sm">{t('upload.success')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main content area - CV and Analysis side by side */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[40%_60%] gap-4 px-4 pt-4 pb-4">
        {/* Left: PDF Viewer - A4 size, centered */}
        <div className="w-full h-full overflow-auto flex items-start justify-center pt-4">
          <div className="w-full max-w-[210mm] aspect-[210/297] bg-white shadow-lg">
            <PdfViewer file={uploadedFile} />
          </div>
        </div>

        {/* Right: Analysis - Scrollable, larger */}
        <div className="w-full h-full overflow-y-auto bg-white">
            {analysisLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-blue-600 font-semibold">{t('analysis.analyzing')}</p>
                </div>
              </div>
            ) : parsedData && analysis ? (
            <div className="p-4 sm:p-6 space-y-6">
                {/* Debug: Show analysis source */}
                {analysisSource && (
                  <div className={`text-xs px-3 py-2 rounded mb-4 ${
                    analysisSource === 'gemini' 
                      ? 'bg-green-100 text-green-800 border border-green-300' 
                      : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                  }`}>
                    <div className="font-semibold mb-1">Analysis Source:</div>
                    <div>{analysisSource === 'gemini' 
                      ? '✅ Using Google Gemini AI' 
                      : `⚠️ Using ${analysisSource} (Mock Data - AI not available)`}</div>
                    {analysisSource !== 'gemini' && (
                      <div className="mt-2 text-xs text-yellow-700">
                        <strong>Tip:</strong> Check backend terminal for error details. Make sure GEMINI_API_KEY is set in backend/.env file and backend is restarted.
                      </div>
                    )}
                  </div>
                )}
                
                {/* Contact Info */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold mb-3">{t('cvData.name')}</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">{t('cvData.name')}:</span> {parsedData.name || t('cvData.notFound')}</p>
                    <p><span className="font-medium">{t('cvData.email')}:</span> {parsedData.email ? <a href={`mailto:${parsedData.email}`} className="text-blue-600 hover:underline">{parsedData.email}</a> : t('cvData.notFound')}</p>
                    <p><span className="font-medium">{t('cvData.phone')}:</span> {parsedData.phone ? <a href={`tel:${parsedData.phone}`} className="text-blue-600 hover:underline">{parsedData.phone}</a> : t('cvData.notFound')}</p>
                  </div>
                </div>

                {/* Skills */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold mb-3">{t('cvData.skills')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {parsedData.skills.length > 0 ? (
                      parsedData.skills.map((skill, idx) => (
                        <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 text-sm">{t('cvData.noSkills')}</span>
                    )}
                  </div>
                </div>

                {/* CV Scoring - 3 columns */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">{t('analysis.scoring')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-800">
                    {Object.entries(analysis.scoring).map(([key, value]) => {
                      const scoreColor = value.score >= 80 ? 'text-green-600' : value.score >= 60 ? 'text-yellow-600' : 'text-red-600';
                      const bgColor = value.score >= 80 ? 'bg-green-50' : value.score >= 60 ? 'bg-yellow-50' : 'bg-red-50';
                      return (
                        <div key={key} className={`flex flex-col rounded border border-gray-200 p-3 ${bgColor}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold capitalize text-xs sm:text-sm">{key}</span>
                            <span className={`font-bold text-base sm:text-lg ${scoreColor}`}>{value.score}/100</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2 mb-2">
                            <div 
                              className={`h-1.5 sm:h-2 rounded-full ${value.score >= 80 ? 'bg-green-500' : value.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${value.score}%` }}
                            ></div>
                          </div>
                          <span className="text-gray-600 text-xs">{value.reason}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Missing Sections */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">{t('analysis.missingSections')}</h3>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 bg-gray-50 p-3 rounded">
                    {analysis.missingSections.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Suggestions */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">{t('analysis.suggestions')}</h3>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 bg-gray-50 p-3 rounded">
                    {analysis.suggestions.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : parsedData ? (
              <div className="p-6 text-center">
                <p className="text-gray-500">{t('analysis.analyzing')}</p>
              </div>
            ) : null}
          </div>
        </div>

      {/* Interview Questions - Completely separate section below, independent container with spacing */}
      {parsedData && analysis && (
        <div className="w-full px-4 py-6 bg-gray-100 border-t-2 border-gray-300 mt-6">
          <button
            onClick={() => setShowInterviewQuestions(!showInterviewQuestions)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-between shadow-md"
          >
            <span className="text-lg">{t('analysis.interviewQuestions')}</span>
            <svg 
              className={`w-6 h-6 transition-transform duration-300 ${showInterviewQuestions ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div 
            className={`overflow-hidden transition-all duration-500 ease-in-out ${
              showInterviewQuestions ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="mt-4 bg-white rounded-lg shadow-lg p-6 space-y-8">
              {/* Technical Questions */}
              <div>
                <h4 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">{t('analysis.technical')}</h4>
                <ul className="space-y-3">
                  {analysis.interviewQuestions.technical.map((q, idx) => (
                    <li key={`t-${idx}`} className="flex items-start">
                      <span className="text-blue-600 mr-3 font-semibold">{idx + 1}.</span>
                      <span className="text-gray-700 leading-relaxed">{q}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Behavioral Questions */}
              <div>
                <h4 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">{t('analysis.behavioral')}</h4>
                <ul className="space-y-3">
                  {analysis.interviewQuestions.behavioral.map((q, idx) => (
                    <li key={`b-${idx}`} className="flex items-start">
                      <span className="text-blue-600 mr-3 font-semibold">{idx + 1}.</span>
                      <span className="text-gray-700 leading-relaxed">{q}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Role Specific Questions */}
              <div>
                <h4 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">{t('analysis.roleSpecific')}</h4>
                <ul className="space-y-3">
                  {analysis.interviewQuestions.roleSpecific.map((q, idx) => (
                    <li key={`r-${idx}`} className="flex items-start">
                      <span className="text-blue-600 mr-3 font-semibold">{idx + 1}.</span>
                      <span className="text-gray-700 leading-relaxed">{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PdfUpload;
