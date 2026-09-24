'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Floating entry point that exposes the Copilot contextually from any
// architect-facing page (projects, design studio, 2D/3D, estimation, BOQ,
// marketplace, etc.). Shown only on architect routes.
export default function CopilotFab() {
  const pathname = usePathname();

  const onArchitectPage = pathname.startsWith('/architect');
  if (!onArchitectPage) return null;

  const isCopilot = pathname.includes('/architect/gemini');
  const label = isCopilot ? 'Open full Copilot' : 'Get AI help on this page';

  return (
    <Link
      href="/architect/gemini"
      aria-label="Open BuildSmart AI Copilot"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-primary-container text-white dark:bg-primary dark:text-on-primary shadow-lg hover:bg-[#264B3E] dark:hover:bg-primary-fixed transition-colors"
      title={label}
    >
      <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
      <span className="text-label-md font-semibold hidden sm:inline">AI Copilot</span>
    </Link>
  );
}
