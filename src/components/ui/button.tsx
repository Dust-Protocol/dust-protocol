import * as React from "react";

interface ButtonLoadingProps {
  loading?: boolean;
  loadingText?: React.ReactNode;
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonLoadingProps {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(props, ref) {
    const { loading, disabled, loadingText, children, className, ...rest } = props;
    return (
      <button
        ref={ref}
        disabled={loading || disabled}
        className={[
          "py-2 px-4 rounded-sm bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)]",
          "hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41]",
          "text-sm font-bold text-[#00FF41] font-mono transition-all",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className ?? "",
        ].join(" ")}
        {...rest}
      >
        {loading && !loadingText ? (
          <span className="relative inline-flex items-center">
            <span className="opacity-0">{children}</span>
            <span className="absolute inset-0 flex items-center justify-center">
              <svg
                className="animate-spin w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              >
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            </span>
          </span>
        ) : loading && loadingText ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="animate-spin w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            {loadingText}
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);
