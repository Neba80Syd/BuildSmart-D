'use client';

import { useEffect, useState } from 'react';

/**
 * Client-side light/dark theme toggle. Mirrors the Stitch design references
 * (class-based dark mode on <html>), persisting the choice in localStorage.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefers;
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed transition-colors p-2 rounded-full flex items-center justify-center hover:bg-surface-container-low dark:hover:bg-tertiary-container"
    >
      <span className="material-symbols-outlined">{dark ? 'light_mode' : 'dark_mode'}</span>
    </button>
  );
}
