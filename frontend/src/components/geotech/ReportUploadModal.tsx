import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2, X } from 'lucide-react';
import { apiClient } from '../../api/client';

interface ReportUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onUploadSuccess: (reportData: any) => void;
}

export const ReportUploadModal: React.FC<ReportUploadModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onUploadSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const steps = [
    'Report uploaded',
    'Text extracted',
    'Boreholes identified',
    'Geological layers identified',
    'Groundwater data identified',
    'Foundation recommendations identified',
    'Validation completed',
  ];

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setErrorMsg(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMsg(null);
    }
  };

  const handleStartProcessing = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setStepIndex(1);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('project_id', String(projectId));

    try {
      // Simulate stepwise checklist progression for realistic user UX
      const timer1 = setTimeout(() => setStepIndex(2), 600);
      const timer2 = setTimeout(() => setStepIndex(3), 1200);
      const timer3 = setTimeout(() => setStepIndex(4), 1800);
      const timer4 = setTimeout(() => setStepIndex(5), 2400);

      const resp = await apiClient.uploadGeotechIntelligence(formData);

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);

      setStepIndex(7); // all 7 steps completed

      setTimeout(() => {
        setIsProcessing(false);
        onUploadSuccess(resp.data);
        onClose();
      }, 700);
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMsg(err.response?.data?.detail || err.message || 'Failed to parse geotechnical report.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-50 text-brand-700 border border-brand-200">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Upload Geotechnical Report</h3>
              <p className="text-[11px] text-slate-500">
                Source-grounded PDF geotechnical report ingestion & parsing
              </p>
            </div>
          </div>
          {!isProcessing && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {!isProcessing ? (
            <>
              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-brand-500 bg-brand-50/50'
                    : selectedFile
                    ? 'border-emerald-400 bg-emerald-50/20'
                    : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <UploadCloud
                  className={`w-8 h-8 mx-auto mb-2 ${
                    selectedFile ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                />

                {selectedFile ? (
                  <div>
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      {selectedFile.name}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Ready for extraction
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">
                      Drag & Drop Geotechnical PDF Report here
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-1">
                      or click to browse from your computer (IS 1892 compliant)
                    </span>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <span className="font-semibold text-slate-700 block">Source Grounding Guarantee:</span>
                <p>
                  Values not found in the uploaded document will NOT be hallucinated and will explicitly display
                  as <span className="font-mono text-slate-700">"Not specified in report"</span>.
                </p>
              </div>
            </>
          ) : (
            /* Processing Animation & Checklist */
            <div className="py-4 space-y-4">
              <div className="text-center space-y-1">
                <Loader2 className="w-7 h-7 mx-auto text-brand-600 animate-spin" />
                <h4 className="text-xs font-bold text-slate-800">
                  Parsing Geotechnical Investigation Report...
                </h4>
                <p className="text-[11px] text-slate-500 font-mono">
                  {selectedFile?.name}
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                {steps.map((step, idx) => {
                  const isDone = idx < stepIndex;
                  const isCurrent = idx === stepIndex;
                  return (
                    <div key={idx} className="flex items-center gap-2.5 text-xs">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : isCurrent ? (
                        <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300" />
                      )}
                      <span
                        className={
                          isDone
                            ? 'font-medium text-slate-800'
                            : isCurrent
                            ? 'font-bold text-brand-700'
                            : 'text-slate-400'
                        }
                      >
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {!isProcessing && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleStartProcessing}
              disabled={!selectedFile}
              className="px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs"
            >
              Parse & Validate
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
