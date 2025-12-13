"use client";

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

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
  const [parsedData, setParsedData] = useState<ParsedCvData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) {
      return;
    }
    const file = acceptedFiles[0];
    const formData = new FormData();
    formData.append('pdf', file);

    setLoading(true);
    setError(null);
    setParsedData(null);
    setAnalysis(null);
    setUploadSuccess(false);

    try {
      const response = await fetch('http://localhost:5000/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Failed to upload PDF';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
        const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setParsedData(data.parsedData);
      setUploadSuccess(true);

      // Trigger AI analysis
      setAnalysisLoading(true);
      try {
        const aiResponse = await fetch('http://localhost:5000/analyze-cv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parsedData: data.parsedData }),
        });

        if (!aiResponse.ok) {
          const text = await aiResponse.text();
          throw new Error(text || 'Failed to analyze CV');
        }

        const aiData = await aiResponse.json();
        setAnalysis(aiData.analysis);
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
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'] } });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 space-y-4">
      <div
        {...getRootProps()}
        className={`border-dashed border-4 rounded-lg p-10 text-center transition-colors duration-200 ${
          loading 
            ? 'border-gray-300 cursor-not-allowed opacity-50' 
            : 'border-gray-400 cursor-pointer hover:border-blue-500'
        }`}
      >
        <input {...getInputProps()} disabled={loading} />
        {loading ? (
          <p className="text-blue-600 font-semibold">Processing PDF... Please wait</p>
        ) : isDragActive ? (
          <p className="text-gray-600">Drop the PDF file here...</p>
        ) : (
            <p className="text-gray-600">Drag and drop a PDF file here, or click to select</p>
        )}
      </div>

      {uploadSuccess && (
        <div className="w-full max-w-2xl rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800 shadow-sm">
          CV başarıyla yüklendi ve analiz ediliyor...
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg w-full max-w-2xl">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {parsedData && (
        <div className="mt-4 p-4 bg-white rounded-lg shadow-md w-full max-w-4xl text-left space-y-4">
          <h3 className="text-lg font-semibold mb-4">Extracted CV Data:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <p><strong>Name:</strong> {parsedData.name}</p>
          <p><strong>Email:</strong> {parsedData.email}</p>
          <p><strong>Phone:</strong> {parsedData.phone}</p>
          <p><strong>Skills:</strong> {parsedData.skills.join(', ')}</p>
          </div>
          <div>
            <strong>Experience:</strong>
            <pre className="whitespace-pre-wrap text-sm text-gray-800">{parsedData.experience}</pre>
          </div>
          <div>
            <strong>Education:</strong>
            <pre className="whitespace-pre-wrap text-sm text-gray-800">{parsedData.education}</pre>
          </div>

          {analysisLoading && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800 shadow-sm">
              AI analizi yapılıyor...
            </div>
          )}

          {analysis && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-gray-50">
                <h4 className="text-md font-semibold mb-2">AI Summary</h4>
                <p className="text-sm text-gray-800">{analysis.summary}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Missing Sections</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {analysis.missingSections.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Suggestions</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {analysis.suggestions.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Scoring</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-800">
                  {Object.entries(analysis.scoring).map(([key, value]) => (
                    <div key={key} className="flex flex-col rounded border border-gray-200 p-3">
                      <span className="font-semibold capitalize">{key}</span>
                      <span className="text-blue-700 font-bold">Score: {value.score}/100</span>
                      <span className="text-gray-600 text-sm">{value.reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Interview Questions</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-800">
                  <div>
                    <h5 className="font-semibold mb-1">Technical</h5>
                    <ul className="list-disc list-inside space-y-1">
                      {analysis.interviewQuestions.technical.map((q, idx) => <li key={`t-${idx}`}>{q}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold mb-1">Behavioral</h5>
                    <ul className="list-disc list-inside space-y-1">
                      {analysis.interviewQuestions.behavioral.map((q, idx) => <li key={`b-${idx}`}>{q}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold mb-1">Role Specific</h5>
                    <ul className="list-disc list-inside space-y-1">
                      {analysis.interviewQuestions.roleSpecific.map((q, idx) => <li key={`r-${idx}`}>{q}</li>)}
                    </ul>
                  </div>
                </div>
              </div>

              <div>
          <h3 className="text-lg font-semibold mt-4 mb-2">Raw Text:</h3>
          <pre className="whitespace-pre-wrap text-sm text-gray-800">{parsedData.rawText}</pre>
              </div>
            </div>
          )}
        </div>
      )}
      <p className="mt-4 text-gray-500">Only .pdf files are accepted</p>
    </div>
  );
};

export default PdfUpload;
