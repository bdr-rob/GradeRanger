import { useState } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AIReport } from '@/types/cards';

interface Props {
  report: AIReport | null;
  loading?: boolean;
  onRetry?: () => void;
}

function GradeDial({ grade, confidence }: { grade: number; confidence: number }) {
  const maxGrade = 10;
  const pct = (grade / maxGrade) * 100;
  const color =
    grade >= 9 ? '#22c55e' : grade >= 8 ? '#47682d' : grade >= 7 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 50}`}
            strokeDashoffset={`${2 * Math.PI * 50 * (1 - pct / 100)}`}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-[#14314F]">{grade.toFixed(1)}</span>
          <span className="text-xs text-gray-400">/ 10</span>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        AI confidence: <span className="font-semibold">{Math.round(confidence * 100)}%</span>
      </p>
    </div>
  );
}

function DimensionBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 9 ? 'bg-green-500' : score >= 8 ? 'bg-[#47682d]' : score >= 7 ? 'bg-yellow-500' : 'bg-red-400';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-[#14314F]">{score.toFixed(1)}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${(score / 10) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function AIReportViewer({ report, loading, onRetry }: Props) {
  const [showAnnotated, setShowAnnotated] = useState(false);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Loader2 className="h-8 w-8 animate-spin text-[#47682d]" />
        <p className="text-sm text-gray-500">AI analysis is running…</p>
        <p className="text-xs text-gray-400">Usually completes in under 30 seconds</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <AlertCircle className="h-8 w-8 text-gray-300" />
        <p className="text-sm text-gray-500">No AI report yet. Analysis will start automatically after uploading images.</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Run analysis
          </Button>
        )}
      </div>
    );
  }

  if (report.status === 'pending' || report.status === 'processing') {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Loader2 className="h-8 w-8 animate-spin text-[#47682d]" />
        <p className="text-sm text-gray-500">
          {report.status === 'pending' ? 'Analysis queued…' : 'Analyzing card…'}
        </p>
      </div>
    );
  }

  if (report.status === 'failed') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-gray-700 font-medium">Analysis could not be completed</p>
        <p className="text-xs text-gray-500">
          {(report.raw_response as any)?.error_message ?? 'An unexpected error occurred.'}
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try again
          </Button>
        )}
      </div>
    );
  }

  // Complete report
  const overallGrade = report.overall_grade ?? 0;
  const confidence = report.confidence_score ?? 0;
  const centering = ((report.centering_lr ?? 0) + (report.centering_tb ?? 0)) / 2;
  const corners = report.corner_score ?? 0;
  const edges = report.edge_score ?? 0;
  const surface = report.surface_score ?? 0;

  const radarData = [
    { subject: 'Centering', score: centering },
    { subject: 'Corners', score: corners },
    { subject: 'Edges', score: edges },
    { subject: 'Surface', score: surface },
  ];

  // Ximilar returns a real verbal condition (Poor..Gem Mint) — prefer it over
  // the locally-computed heuristic, which only exists as a fallback for
  // older reports (e.g. from the previous Claude-based grading) that predate
  // the condition_label column.
  const gradeLabel =
    report.condition_label ??
    (overallGrade >= 9.5
      ? 'Gem Mint'
      : overallGrade >= 9
      ? 'Mint'
      : overallGrade >= 8
      ? 'Near Mint-Mint'
      : overallGrade >= 7
      ? 'Near Mint'
      : overallGrade >= 6
      ? 'Excellent-Near Mint'
      : 'Good or Below');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-[#14314F]">AI Preliminary Grade</h3>
          <p className="text-xs text-amber-600 mt-0.5">
            This is an estimate only — not a certified grade.
          </p>
        </div>
        <Badge className="bg-[#47682d] text-white">{gradeLabel}</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Grade Dial */}
        <div className="flex flex-col items-center gap-4">
          <GradeDial grade={overallGrade} confidence={confidence} />
          <div className="w-full space-y-2">
            <DimensionBar label="Centering" score={centering} />
            <DimensionBar label="Corners" score={corners} />
            <DimensionBar label="Edges" score={edges} />
            <DimensionBar label="Surface" score={surface} />
          </div>
        </div>

        {/* Radar Chart */}
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#47682d"
                fill="#47682d"
                fillOpacity={0.25}
              />
              <Tooltip formatter={(v: number) => v.toFixed(1)} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Written Summary */}
      {report.written_summary && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-1">Analysis summary</p>
          <p className="text-sm text-gray-600 leading-relaxed">{report.written_summary}</p>
        </div>
      )}

      {/* Annotated images */}
      {(report.annotated_front_url || report.annotated_back_url) && (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAnnotated((v) => !v)}
            className="mb-3"
          >
            {showAnnotated ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showAnnotated ? 'Hide' : 'Show'} annotated images
          </Button>
          {showAnnotated && (
            <div className="flex gap-3 flex-col sm:flex-row">
              {report.annotated_front_url && (
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Front (annotated)</p>
                  <img src={report.annotated_front_url} alt="Annotated front" className="rounded-lg border w-full object-contain max-h-56" />
                </div>
              )}
              {report.annotated_back_url && (
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Back (annotated)</p>
                  <img src={report.annotated_back_url} alt="Annotated back" className="rounded-lg border w-full object-contain max-h-56" />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
