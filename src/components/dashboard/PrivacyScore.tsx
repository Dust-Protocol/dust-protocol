"use client";

interface PrivacyScoreProps {
  oldestNoteAgeMs: number;
  noteCount: number;
}

type ScoreLevel = "LOW" | "MODERATE" | "GOOD" | "EXCELLENT";

function computeScore(ageMs: number, count: number): ScoreLevel {
  const ageHours = ageMs / (1000 * 60 * 60);
  const ageScore: ScoreLevel = ageHours < 1 ? "LOW" : ageHours < 24 ? "MODERATE" : ageHours < 168 ? "GOOD" : "EXCELLENT";
  const countScore: ScoreLevel = count < 2 ? "LOW" : count < 4 ? "MODERATE" : count < 8 ? "GOOD" : "EXCELLENT";
  const levels: ScoreLevel[] = ["LOW", "MODERATE", "GOOD", "EXCELLENT"];
  return levels[Math.min(levels.indexOf(ageScore), levels.indexOf(countScore))];
}

const SCORE_CONFIG: Record<ScoreLevel, { color: string; barWidth: string; label: string }> = {
  LOW: { color: "#ef4444", barWidth: "25%", label: "LOW" },
  MODERATE: { color: "#FFB000", barWidth: "50%", label: "MODERATE" },
  GOOD: { color: "#00FF41", barWidth: "75%", label: "GOOD" },
  EXCELLENT: { color: "#00FF41", barWidth: "100%", label: "EXCELLENT" },
};

export function PrivacyScore({ oldestNoteAgeMs, noteCount }: PrivacyScoreProps) {
  if (noteCount === 0) return null;

  const level = computeScore(oldestNoteAgeMs, noteCount);
  const config = SCORE_CONFIG[level];

  return (
    <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-[rgba(255,255,255,0.4)] uppercase">
          Privacy Score
        </span>
        <span className="text-[10px] font-mono font-bold" style={{ color: config.color }}>
          {config.label}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: config.barWidth, backgroundColor: config.color }}
        />
      </div>
    </div>
  );
}
