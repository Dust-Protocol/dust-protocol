"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { docsNav } from "./docs-nav";

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 hidden lg:flex flex-col gap-6 py-8 pr-6 border-r border-[rgba(255,255,255,0.06)] sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
      {docsNav.map((section) => (
        <div key={section.group}>
          <p className="text-[9px] font-mono tracking-[0.2em] text-[rgba(255,255,255,0.25)] uppercase mb-2 px-3">
            {section.group}
          </p>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center px-3 py-2 text-[11px] font-mono tracking-wide rounded-sm transition-all border-l-2 ${
                      active
                        ? "text-[#00FF41] bg-[rgba(0,255,65,0.05)] border-[#00FF41]"
                        : "text-[rgba(255,255,255,0.45)] hover:text-white border-transparent hover:bg-[rgba(255,255,255,0.03)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </aside>
  );
}
