"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { docsNav } from "./docs-nav";

export function DocsMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const currentLabel =
    docsNav
      .flatMap((s) => s.items)
      .find((i) => i.href === pathname)?.label ?? "Docs";

  return (
    <div className="lg:hidden border-b border-[rgba(255,255,255,0.06)] bg-[#06080F] sticky top-14 z-30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-3 text-[11px] font-mono tracking-wider text-[rgba(255,255,255,0.6)] hover:text-white transition-colors"
      >
        <span className="text-[rgba(255,255,255,0.3)] mr-2">DOCS /</span>
        <span className="text-white">{currentLabel.toUpperCase()}</span>
        <ChevronDownIcon
          className="w-4 h-4 ml-auto text-[rgba(255,255,255,0.3)] transition-transform duration-150"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {open && (
        <div className="border-t border-[rgba(255,255,255,0.06)] pb-2">
          {docsNav.map((section) => (
            <div key={section.group} className="mt-3">
              <p className="text-[9px] font-mono tracking-[0.2em] text-[rgba(255,255,255,0.25)] uppercase px-6 mb-1">
                {section.group}
              </p>
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex px-8 py-2.5 text-[11px] font-mono tracking-wide transition-all ${
                      active
                        ? "text-[#00FF41] bg-[rgba(0,255,65,0.04)]"
                        : "text-[rgba(255,255,255,0.45)] hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
