"use client";

/**
 * The three settings sections.
 *
 * Links rather than local state, following `StageTabs` in ActionBoard.tsx: each
 * section is its own route with its own server-side reads, so switching tabs
 * has to be a navigation. It also means a superadmin can send somebody a link
 * to the section they mean.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

export const SETTINGS_SECTIONS = [
  { label: "System Config", href: "/superadmin/settings/system" },
  { label: "Chatbot Config", href: "/superadmin/settings/chatbot" },
  { label: "Content", href: "/superadmin/settings/cms" },
] as const;

export default function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-5 pb-4 md:px-8"
    >
      {SETTINGS_SECTIONS.map((section) => {
        const isActive = pathname === section.href;
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-sky-800 text-white"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
