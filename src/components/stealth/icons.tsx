/**
 * Custom SVG Icons for Private Wallet
 * Clean, minimal icons with consistent stroke width and sizing
 */

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

export const ShieldIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const ShieldCheckIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const LockIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const UnlockIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

export const SendIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 2L11 13" />
    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
  </svg>
);

export const InboxIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

export const SettingsIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const HistoryIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 3v5h5" />
    <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
    <path d="M12 7v5l4 2" />
  </svg>
);

export const HomeIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

export const CopyIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const CheckIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const CheckCircleIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export const AlertCircleIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export const InfoIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

export const WalletIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
  </svg>
);

export const RefreshIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

export const ArrowLeftIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export const ArrowUpRightIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="7 7 17 7 17 17" />
  </svg>
);

export const ArrowDownLeftIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="17" y1="7" x2="7" y2="17" />
    <polyline points="17 17 7 17 7 7" />
  </svg>
);

export const UserIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const TagIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

export const TrashIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export const SparklesIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    <path d="M5 19l.5 1.5L7 21l-1.5.5L5 23l-.5-1.5L3 21l1.5-.5L5 19z" />
    <path d="M19 11l.5 1.5L21 13l-1.5.5L19 15l-.5-1.5L17 13l1.5-.5L19 11z" />
  </svg>
);

export const EyeIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export const PlusIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const DownloadIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const KeyIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

export const ZapIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

export const ServerIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

export const GridIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

export const LinkIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

export const ActivityIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

export const QRIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="8" height="8" rx="1" />
    <rect x="14" y="2" width="8" height="8" rx="1" />
    <rect x="2" y="14" width="8" height="8" rx="1" />
    <rect x="14" y="14" width="4" height="4" rx="0.5" />
    <line x1="22" y1="14" x2="22" y2="18" />
    <line x1="18" y1="22" x2="22" y2="22" />
    <rect x="5" y="5" width="2" height="2" fill={color} stroke="none" />
    <rect x="17" y="5" width="2" height="2" fill={color} stroke="none" />
    <rect x="5" y="17" width="2" height="2" fill={color} stroke="none" />
  </svg>
);

export const ExternalLinkIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

export const LogOutIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export const ChevronRightIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export const MenuIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

export const XIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const MoreHorizontalIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

export const ArchiveIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </svg>
);

export const FileTextIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

export const StarIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export const ImageIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

export const ChevronDownIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const ChevronUpIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

export const MailIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

export const MessageCircleIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

export const UploadIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

export const BoxIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

export const SearchIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export const TONIcon = ({ size = 24 }: IconProps) => (
  <svg width={size} height={size * 24 / 36} viewBox="0 0 36 24" fill="none">
    <path d="M0.551196 8.60858C0.440796 8.95898 0.304797 9.4318 0.216797 9.7902C0.277608 9.54236 0.390929 9.31046 0.549097 9.1102C0.707264 8.90993 0.906588 8.74596 1.13359 8.62939C1.5799 8.05462 2.15209 7.58987 2.80615 7.27089C3.46021 6.9519 4.1787 6.78719 4.9064 6.7894V6.7758C2.1968 5.9974 1.356 6.8886 1.1208 7.3078C0.898239 7.72513 0.708081 8.15892 0.552002 8.60539" fill="#2A72E5" />
    <path d="M3.35917 4.44479L2.95917 4.82719C3.41757 4.45119 4.17356 4.53839 5.33756 5.10319C5.58991 4.65111 5.91018 4.24046 6.28717 3.88559C5.73517 3.48559 5.17596 3.1328 4.82076 3.2976C4.30557 3.64361 3.81651 4.02704 3.35756 4.44479" fill="#2A72E5" />
    <path d="M8.9288 1.30791C8.5152 1.45991 7.96398 1.6631 7.55438 1.8303C7.76881 2.05788 7.96141 2.3051 8.1296 2.5687C8.74655 2.23423 9.38846 1.94804 10.0496 1.7127C9.9384 1.2503 9.9112 1.01909 10.0496 0.960693C9.7112 1.06389 9.25838 1.19111 8.92318 1.30791" fill="#2A72E5" />
    <path d="M15.6479 0.0439941C15.0183 0.0951941 14.18 0.173592 13.552 0.247192C13.224 0.327192 13.0791 0.44559 12.9167 0.93999C13.7727 0.777434 14.637 0.662079 15.5056 0.594409C15.6337 0.414309 15.8023 0.266722 15.9978 0.163501C16.1932 0.0602801 16.4101 0.00428694 16.6312 0L15.6479 0.0439941Z" fill="#2A72E5" />
    <path d="M22.6407 0.423275C22.0519 0.333675 21.2663 0.221683 20.6751 0.152083C20.0839 0.0818689 19.4869 0.223602 18.9904 0.552083C19.8926 0.598769 20.7917 0.693305 21.684 0.835286C22.3503 0.548151 23.0915 0.483335 23.7976 0.650472C23.4504 0.581672 22.9895 0.480875 22.6407 0.423275Z" fill="#2A72E5" />
    <path d="M28.9504 2.41689C28.5136 2.21449 27.9303 1.94889 27.4871 1.76489C26.6147 1.40326 25.6507 1.32462 24.7311 1.54008C25.4507 1.76233 26.1544 2.03282 26.8375 2.3497C28.0433 2.20302 29.262 2.48813 30.2776 3.15449C29.8816 2.92649 29.3551 2.61769 28.9479 2.41689" fill="#2A72E5" />
    <path d="M35.2112 8.97527C34.9163 8.13179 34.5097 7.33161 34.0024 6.59607L33.6904 6.16648C33.1547 5.4014 32.4474 4.77236 31.625 4.32976C30.8026 3.88716 29.8879 3.6433 28.9543 3.61768C29.4046 3.95977 29.8102 4.357 30.1615 4.80007C33.3447 5.25047 35.536 8.04886 35.7432 11.9297C35.7169 10.9236 35.5375 9.92733 35.2112 8.97527Z" fill="#2A72E5" />
    <path d="M30.6616 20.8657C31.2703 20.4714 31.847 20.0298 32.3864 19.5449C32.5896 19.3473 32.8664 19.0865 33.0576 18.8793C37.028 14.2785 35.224 7.6393 30.9608 6.4353C31.0067 6.64564 31.0313 6.86004 31.0344 7.07529C31.0344 7.11369 31.0344 7.1553 31.0344 7.1897C31.0301 7.40069 31.0052 7.61076 30.96 7.81689C35.52 9.87529 35.0728 18.0897 30.2336 21.1337L30.6616 20.8689" fill="#2A72E5" />
    <path d="M24.6984 23.2848C25.292 23.1312 26.0808 22.9112 26.6696 22.7312C32.5096 20.5368 33.4383 11.5776 30.1615 9.42236C29.8099 9.8541 29.4045 10.2391 28.9552 10.568C31.7272 13.6248 28.8864 22.2608 23.684 23.5008L24.6984 23.2848Z" fill="#2A72E5" />
    <path d="M17.9048 24.0001C18.4552 23.9953 19.1896 23.9873 19.74 23.9657C24.5888 23.4649 28.04 14.5601 26.8392 11.7737C26.1553 12.0718 25.4514 12.322 24.7328 12.5225C24.7216 16.0841 19.9272 24.0425 16.4888 23.9529C16.9136 23.9681 17.48 23.9993 17.9048 24.0001Z" fill="#2A72E5" />
    <path d="M10.872 23.0825C11.4136 23.2129 12.1376 23.3801 12.6824 23.4913C14.7056 23.6401 19.8024 16.7713 21.6816 13.1409C20.7856 13.2566 19.884 13.3247 18.9808 13.3449C17.512 14.7705 13.6368 19.2545 12.8752 20.1393C10.9136 22.4161 10.1848 22.8481 9.91919 22.8097L10.872 23.0825Z" fill="#2A72E5" />
    <path d="M4.96156 20.5104C5.54898 20.9041 6.1615 21.259 6.79518 21.5728L6.84718 21.5984C6.95598 21.0192 11.7776 15.2592 15.5 13.1984C14.6319 13.1051 13.7696 12.9646 12.9168 12.7776C8.46956 14.4824 3.92957 19.6976 4.71117 20.3376L4.96156 20.5104Z" fill="#2A72E5" />
    <path d="M1.74322 17.3944C1.95362 17.6776 2.23762 18.0536 2.46322 18.3224C1.46162 16.796 5.68481 12.8432 10.0552 11.9224C9.3932 11.6674 8.75139 11.3628 8.13521 11.0112C4.11361 11.448 0.286417 14.2984 1.07362 16.2688C1.26642 16.6144 1.52483 17.0744 1.74723 17.3952" fill="#2A72E5" />
    <path d="M0.00159912 11.804C0.00159912 11.8688 0.00159912 11.9328 0.00159912 11.9968C0.0191991 12.3312 0.047204 12.776 0.081604 13.108C-0.026396 10.94 3.2656 9.53922 6.288 9.63842C5.9107 9.27247 5.59033 8.85206 5.33758 8.3912C2.78239 8.0632 1.3856 8.72242 0.663196 9.33202C0.243019 10.0892 0.015535 10.9382 0.000793457 11.804" fill="#2A72E5" />
  </svg>
);

export const ETHIcon = ({ size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <path d="M16 2L6 16.5L16 22L26 16.5L16 2Z" fill="#627EEA" />
    <path d="M16 2L6 16.5L16 12.5V2Z" fill="#627EEA" opacity="0.6" />
    <path d="M16 2L26 16.5L16 12.5V2Z" fill="#627EEA" />
    <path d="M16 24L6 18.5L16 30L26 18.5L16 24Z" fill="#627EEA" />
    <path d="M16 24L6 18.5L16 30V24Z" fill="#627EEA" opacity="0.6" />
    <path d="M16 24L26 18.5L16 30V24Z" fill="#627EEA" />
    <path d="M16 22L6 16.5L16 12.5V22Z" fill="#627EEA" opacity="0.2" />
    <path d="M16 22L26 16.5L16 12.5V22Z" fill="#627EEA" opacity="0.5" />
  </svg>
);

export const SwapIcon = ({ size = 24, color = "currentColor" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 16l-4-4 4-4" />
    <path d="M3 12h18" />
    <path d="M17 8l4 4-4 4" />
  </svg>
);

export const USDCIcon = ({ size = 24 }: IconProps) => (
  <img src="/chains/usdc.svg" width={size} height={size} alt="USDC" style={{ borderRadius: '50%' }} />
);

export const TokenIcon = ({ symbol, size = 24 }: { symbol: string; size?: number }) => {
  const upper = symbol.toUpperCase();
  if (upper === 'ETH' || upper === 'WETH') return <ETHIcon size={size} />;
  if (upper === 'USDC') return <USDCIcon size={size} />;
  if (upper === 'TON' || upper === 'WTON') return <TONIcon size={size} />;
  if (upper === 'FLOW') return <FlowIcon size={size} />;
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-[rgba(255,255,255,0.1)] flex items-center justify-center flex-shrink-0"
    >
      <span className="text-[12px] font-bold text-white leading-none">{symbol.charAt(0)}</span>
    </div>
  );
};

export const ArbitrumIcon = ({ size = 24 }: IconProps) => (
  <img src="/chains/arbitrum.svg" width={size} height={size} alt="Arbitrum" style={{ borderRadius: '50%' }} />
);

export const OptimismIcon = ({ size = 24 }: IconProps) => (
  <img src="/chains/optimism.svg" width={size} height={size} alt="Optimism" style={{ borderRadius: '50%' }} />
);

export const BaseIcon = ({ size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 111 111" fill="none">
    <circle cx="55.5" cy="55.5" r="55.5" fill="#0052FF" />
    <path d="M55.39 94.44c21.41 0 38.78-17.18 39.31-38.52H68.2c-.52 11.35-9.96 20.42-21.43 20.42-11.87 0-21.49-9.72-21.49-21.72 0-11.87 9.49-21.55 21.28-21.72 11.63-.17 21.22 8.88 21.87 20.33h26.49C94.41 32.04 77.03 15 55.6 15 33.17 15 15 33.39 15 55.72c0 22.33 18.17 38.72 40.39 38.72z" fill="white" />
  </svg>
);

export const FlowIcon = ({ size = 24 }: IconProps) => (
  <img src="/chains/flow.svg" width={size} height={size} alt="Flow" style={{ borderRadius: '50%' }} />
);

const ICON_BY_FAMILY: Record<string, React.FC<IconProps>> = {
  ethereum: ETHIcon,
  thanos: TONIcon,
  arbitrum: ArbitrumIcon,
  optimism: OptimismIcon,
  base: BaseIcon,
  flow: FlowIcon,
};

export const ChainIcon = ({ size = 24, chainId }: IconProps & { chainId?: number }) => {
  if (chainId) {
    try {
      const { getChainConfig } = require('@/config/chains');
      const config = getChainConfig(chainId);
      const Icon = ICON_BY_FAMILY[config.iconFamily] ?? ETHIcon;
      return <Icon size={size} />;
    } catch {
      // Unsupported chain — fall through to default
    }
  }
  return <ETHIcon size={size} />;
};
