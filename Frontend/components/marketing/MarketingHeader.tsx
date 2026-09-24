"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/Frontend/components/ThemeToggle";

const NAV = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Testimonials", href: "/testimonials" },
  { label: "Blog", href: "/blog" },
];

export function MarketingHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-300 ${
        scrolled
          ? "bg-[#FAFAF8]/90 dark:bg-[#17201e]/90 backdrop-blur-xl border-outline-variant dark:border-outline shadow-sm"
          : "bg-[#FAFAF8] dark:bg-[#17201e] border-transparent"
      }`}
    >
      <div className="flex items-center justify-between h-20 px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto">
        <Link href="/" className="flex items-center gap-sm group">
          <span
            className="material-symbols-outlined text-primary dark:text-primary-fixed text-[28px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            architecture
          </span>
          <span className="text-headline-md font-bold text-primary dark:text-primary-fixed tracking-tight">
            BuildSmart<span className="text-primary-container dark:text-secondary-fixed"> AI</span>
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative px-3 py-2 text-label-md rounded-lg transition-colors ${
                isActive(item.href)
                  ? "text-primary dark:text-primary-fixed font-bold"
                  : "text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed hover:bg-surface-container-low dark:hover:bg-tertiary-container"
              }`}
            >
              {item.label}
              {isActive(item.href) && (
                <span className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full bg-primary dark:bg-primary-fixed" />
              )}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-md">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden md:inline-flex text-label-md text-on-surface dark:text-surface-container-lowest hover:text-primary dark:hover:text-primary-fixed transition-colors"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="hidden md:inline-flex bg-primary-container dark:bg-primary-fixed hover:bg-[#264B3E] dark:hover:bg-primary-fixed-dim text-white dark:text-on-primary-fixed text-label-md px-xl py-sm rounded-full transition-all shadow-[0_4px_16px_rgba(24,68,54,0.18)]"
          >
            Get Started
          </Link>
          <button
            aria-label="Toggle navigation menu"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-outline-variant dark:border-outline text-on-surface dark:text-surface-container-lowest bg-white/60 dark:bg-surface-container/60"
          >
            <span className="material-symbols-outlined">{open ? "close" : "menu"}</span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`lg:hidden overflow-hidden transition-[max-height,opacity] duration-300 ${
          open ? "max-h-[460px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav className="px-margin-mobile pb-md flex flex-col gap-1 bg-[#FAFAF8] dark:bg-[#17201e] border-t border-outline-variant dark:border-outline">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-3 rounded-lg text-body-md font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-primary-container/10 dark:bg-primary-fixed/10 text-primary dark:text-primary-fixed"
                  : "text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-low dark:hover:bg-tertiary-container"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <div className="flex gap-sm pt-2">
            <Link href="/login" className="flex-1 text-center btn-secondary">Login</Link>
            <Link href="/register" className="flex-1 text-center btn-primary">Get Started</Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
