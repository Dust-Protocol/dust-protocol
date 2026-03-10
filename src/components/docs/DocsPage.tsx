"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { docsNav } from "./docs-nav";

interface DocsPageProps {
  title: string;
  subtitle?: string;
  badge?: string;
  children: ReactNode;
  currentHref: string;
}

export function DocsPage({ title, subtitle, badge, children, currentHref }: DocsPageProps) {
  const allItems = docsNav.flatMap((s) => s.items);
  const idx = allItems.findIndex((i) => i.href === currentHref);
  const prev = idx > 0 ? allItems[idx - 1] : null;
  const next = idx < allItems.length - 1 ? allItems[idx + 1] : null;

  return (
    <article className="max-w-3xl mx-auto py-10 px-6 lg:px-0">
      {/* Header */}
      <header className="mb-8">
        {badge && (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono tracking-widest border border-[rgba(0,255,65,0.2)] text-[rgba(0,255,65,0.7)] bg-[rgba(0,255,65,0.04)] rounded-sm mb-4">
            {badge}
          </span>
        )}
        <h1 className="text-2xl font-mono font-bold text-white tracking-tight mb-3">{title}</h1>
        {subtitle && (
          <p className="text-sm text-[rgba(255,255,255,0.5)] leading-relaxed max-w-2xl">{subtitle}</p>
        )}
        <div className="mt-5 h-px bg-[rgba(255,255,255,0.06)]" />
      </header>

      {/* Body */}
      <div className="prose-docs">{children}</div>

      {/* Prev / Next */}
      {(prev || next) && (
        <div className="mt-14 pt-8 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between gap-4">
          {prev ? (
            <Link
              href={prev.href}
              className="flex items-center gap-2 text-[11px] font-mono text-[rgba(255,255,255,0.4)] hover:text-white transition-colors group"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5 group-hover:text-[#00FF41] transition-colors" />
              <span>{prev.label}</span>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={next.href}
              className="flex items-center gap-2 text-[11px] font-mono text-[rgba(255,255,255,0.4)] hover:text-white transition-colors group"
            >
              <span>{next.label}</span>
              <ArrowRightIcon className="w-3.5 h-3.5 group-hover:text-[#00FF41] transition-colors" />
            </Link>
          ) : (
            <div />
          )}
        </div>
      )}
    </article>
  );
}
