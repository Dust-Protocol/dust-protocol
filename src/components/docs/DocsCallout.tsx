import { ReactNode } from "react";

interface DocsCalloutProps {
  type?: "info" | "warning" | "tip";
  title?: string;
  children: ReactNode;
}

const styles = {
  info: {
    border: "border-[rgba(0,255,65,0.2)]",
    bg: "bg-[rgba(0,255,65,0.04)]",
    title: "text-[#00FF41]",
    dot: "bg-[#00FF41]",
  },
  warning: {
    border: "border-[rgba(255,176,0,0.25)]",
    bg: "bg-[rgba(255,176,0,0.04)]",
    title: "text-[#FFB000]",
    dot: "bg-[#FFB000]",
  },
  tip: {
    border: "border-[rgba(100,160,255,0.2)]",
    bg: "bg-[rgba(100,160,255,0.04)]",
    title: "text-[rgba(100,160,255,0.9)]",
    dot: "bg-[rgba(100,160,255,0.9)]",
  },
};

export function DocsCallout({ type = "info", title, children }: DocsCalloutProps) {
  const s = styles[type];
  return (
    <div className={`my-6 rounded-sm border ${s.border} ${s.bg} px-5 py-4`}>
      {title && (
        <p className={`flex items-center gap-2 text-[11px] font-mono tracking-widest uppercase mb-2 ${s.title}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          {title}
        </p>
      )}
      <div className="text-sm text-[rgba(255,255,255,0.7)] leading-relaxed [&_code]:font-mono [&_code]:text-xs [&_code]:bg-[rgba(255,255,255,0.06)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-sm">
        {children}
      </div>
    </div>
  );
}
