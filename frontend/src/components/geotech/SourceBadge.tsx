import React from 'react';

interface SourceBadgeProps {
  sourceType?: string | null;
  confidence?: string | null;
  page?: number | null;
  onViewSource?: () => void;
  className?: string;
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({
  sourceType,
  confidence,
  page,
  onViewSource,
  className = '',
}) => {
  const type = (sourceType || 'MISSING').toUpperCase();

  const getBadgeStyle = () => {
    switch (type) {
      case 'REPORT':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CALCULATED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'AI_INTERPRETATION':
      case 'AI_RECOMMENDATION':
      case 'AI':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'REQUIRES_DATA':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'USER_ENTERED':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      default:
        return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const getLabel = () => {
    switch (type) {
      case 'REPORT':
        return 'REPORT';
      case 'CALCULATED':
        return 'CALCULATED';
      case 'AI_INTERPRETATION':
        return 'AI INTERPRETATION';
      case 'AI_RECOMMENDATION':
        return 'AI RECOMMENDATION';
      case 'REQUIRES_DATA':
        return 'REQUIRES DATA';
      case 'USER_ENTERED':
        return 'USER ENTERED';
      default:
        return 'MISSING';
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`px-1.5 py-0.5 text-[10px] font-bold tracking-wider rounded border uppercase font-mono ${getBadgeStyle()}`}
      >
        {getLabel()}
      </span>

      {confidence && type === 'REPORT' && (
        <span
          className={`px-1 py-0.5 text-[9px] font-semibold rounded ${
            confidence === 'HIGH'
              ? 'bg-emerald-100 text-emerald-800'
              : confidence === 'MEDIUM'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-rose-100 text-rose-800'
          }`}
        >
          {confidence}
        </span>
      )}

      {page && type === 'REPORT' && onViewSource && (
        <button
          onClick={onViewSource}
          type="button"
          className="text-[10px] text-brand-600 hover:text-brand-800 hover:underline font-medium flex items-center gap-0.5"
          title={`Click to view page ${page} source snippet`}
        >
          p.{page}
        </button>
      )}
    </div>
  );
};
