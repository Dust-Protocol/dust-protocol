interface DocsBadgeProps {
  children: string;
  variant?: "green" | "amber" | "blue" | "muted";
}

const variantStyles = {
  green: "text-[#00FF41] bg-[rgba(0,255,65,0.08)] border-[rgba(0,255,65,0.2)]",
  amber: "text-[#FFB000] bg-[rgba(255,176,0,0.08)] border-[rgba(255,176,0,0.2)]",
  blue: "text-[rgba(100,160,255,0.9)] bg-[rgba(100,160,255,0.08)] border-[rgba(100,160,255,0.2)]",
  muted: "text-[rgba(255,255,255,0.45)] bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.08)]",
};

export function DocsBadge({ children, variant = "muted" }: DocsBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono tracking-wide rounded-sm border ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}
