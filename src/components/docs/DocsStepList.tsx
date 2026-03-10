import { ReactNode } from "react";

interface Step {
  title: string;
  children: ReactNode;
}

interface DocsStepListProps {
  steps: Step[];
}

export function DocsStepList({ steps }: DocsStepListProps) {
  return (
    <ol className="relative my-6 space-y-0">
      {steps.map((step, i) => (
        <li key={i} className="relative flex gap-6 pb-8 last:pb-0">
          {/* connector line */}
          {i < steps.length - 1 && (
            <div className="absolute left-[19px] top-10 bottom-0 w-px bg-[rgba(255,255,255,0.06)]" />
          )}
          {/* number bubble */}
          <div className="shrink-0 w-10 h-10 rounded-sm border border-[rgba(0,255,65,0.2)] bg-[rgba(0,255,65,0.04)] flex items-center justify-center text-[11px] font-mono text-[#00FF41] mt-0.5">
            {String(i + 1).padStart(2, "0")}
          </div>
          <div className="flex-1 min-w-0 pt-1.5">
            <p className="text-[13px] font-mono font-semibold text-white mb-1.5">{step.title}</p>
            <div className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed [&_code]:font-mono [&_code]:text-xs [&_code]:bg-[rgba(255,255,255,0.06)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-sm">
              {step.children}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
