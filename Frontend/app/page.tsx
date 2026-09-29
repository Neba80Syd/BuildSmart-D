import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/Frontend/components/ThemeToggle";

const FEATURES_NAV = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Testimonials", href: "/testimonials" },
  { label: "Blog", href: "/blog" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#17201e] text-on-surface dark:text-surface-container-lowest">
      {/* Top Navigation */}
      <nav className="bg-[#FAFAF8] dark:bg-inverse-surface border-b border-outline-variant dark:border-outline sticky top-0 z-50">
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto h-20">
          <Link href="/" className="flex items-center gap-sm">
            <span
              className="material-symbols-outlined text-primary dark:text-primary-fixed text-[26px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              architecture
            </span>
            <span className="text-headline-md font-bold text-primary dark:text-primary-fixed">BuildSmart AI</span>
          </Link>

          <div className="hidden md:flex items-center gap-lg">
            {FEATURES_NAV.map((item, i) => (
              <Link
                key={item.label}
                href={item.href}
                className={`${
                  i === 0
                    ? "text-primary dark:text-primary-fixed border-b-2 border-primary dark:border-primary-fixed pb-1"
                    : "text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed hover:bg-surface-container-low dark:hover:bg-tertiary-container"
                } transition-all duration-200 ease-in-out px-2 py-1 rounded text-label-md`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-md">
            <ThemeToggle />
            <Link
              href="/login"
              className="hidden md:block text-label-md text-on-surface dark:text-surface-container-lowest hover:text-primary dark:hover:text-primary-fixed transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="bg-[#315C4C] dark:bg-primary-fixed hover:bg-[#264B3E] dark:hover:bg-primary-fixed-dim text-white dark:text-on-primary-fixed text-label-md px-md py-sm rounded transition-colors shadow-[0_4px_12px_rgba(23,32,30,0.05)]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full">
        {/* Hero */}
        <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
          <Image
            src="/images/hero-villa.png"
            alt="Modern glass villa at sunset"
            fill
            priority
            className="absolute inset-0 w-full h-full object-cover z-0"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-black/40 z-0" />
          <div className="relative z-10 text-center px-margin-mobile md:px-margin-desktop max-w-4xl mx-auto pt-24 pb-32">
            <span className="inline-block bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-label-md mb-md border border-white/30 uppercase tracking-wider">
              AI-Powered Architecture
            </span>
            <h1 className="font-display text-[48px] md:text-[64px] leading-tight text-white mb-md font-bold drop-shadow-lg">
              Design Smarter. Build Better.
            </h1>
            <p className="font-body-lg text-body-lg text-gray-100 mb-xl max-w-2xl mx-auto drop-shadow">
              The intelligent platform for architectural design, construction management, and material procurement. Powered
              by AI, built for professionals.
            </p>
            <div className="flex flex-wrap gap-md justify-center">
              <Link
                href="/ai-design"
                className="bg-primary hover:bg-primary-container text-white text-label-md px-xl py-md rounded-lg transition-colors shadow-lg"
              >
                Start Designing
              </Link>
              <Link
                href="/marketplace"
                className="bg-white/10 backdrop-blur-sm border border-white text-white hover:bg-white hover:text-primary text-label-md px-xl py-md rounded-lg transition-all duration-300"
              >
                Explore Marketplace
              </Link>
            </div>
          </div>
        </section>

        {/* Core Features Bento Grid */}
        <section className="py-24 px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto">
          <div className="mb-xl text-center max-w-3xl mx-auto">
            <h2 className="text-headline-lg text-on-surface dark:text-surface-container-lowest mb-sm">Intelligent Workflows</h2>
            <p className="text-body-md text-on-surface-variant dark:text-surface-variant">
              Bridging AI design with physical construction through precise, automated tooling.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter auto-rows-[280px]">
            {/* AI Design (spans 2, blueprint decoration) */}
            <div className="md:col-span-2 bg-white dark:bg-surface-container rounded-xl border border-[#DDE2E0] dark:border-outline p-lg flex flex-col justify-between hover:shadow-elevation transition-shadow group overflow-hidden relative">
              <div className="relative z-10">
                <div className="w-12 h-12 bg-primary-container/10 dark:bg-primary-container/20 rounded-lg flex items-center justify-center mb-md border border-primary/20 dark:border-primary-fixed/20">
                  <span className="material-symbols-outlined text-primary dark:text-primary-fixed">draw</span>
                </div>
                <h3 className="text-headline-sm text-on-surface dark:text-surface-container-lowest mb-xs">AI Architectural Design</h3>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant max-w-sm">
                  Generate preliminary concepts and layout iterations instantly based on site parameters and programmatic
                  requirements.
                </p>
              </div>
              <Link
                href="/ai-design"
                className="relative z-10 text-label-md text-primary dark:text-primary-fixed font-semibold tracking-widest mt-4 inline-flex items-center gap-1.5 group-hover:gap-2.5 transition-all w-fit"
              >
                OPEN AI DESIGN STUDIO <span>→</span>
              </Link>
              <Image
                src="/images/blueprint-ai.png"
                alt="AI-generated architectural floor plan blueprint"
                width={256}
                height={256}
                className="absolute -bottom-12 -right-12 w-64 h-64 object-cover opacity-30 group-hover:opacity-60 transition-opacity duration-300 dark:opacity-20 dark:group-hover:opacity-40"
              />
            </div>

            {/* 3D Visualization */}
            <div className="bg-white dark:bg-surface-container rounded-xl border border-[#DDE2E0] dark:border-outline p-lg flex flex-col justify-between hover:shadow-elevation transition-shadow">
              <div className="w-12 h-12 bg-primary-container/10 dark:bg-primary-container/20 rounded-lg flex items-center justify-center mb-md border border-primary/20 dark:border-primary-fixed/20">
                <span className="material-symbols-outlined text-primary dark:text-primary-fixed">view_in_ar</span>
              </div>
              <div>
                <h3 className="text-headline-sm text-on-surface dark:text-surface-container-lowest mb-xs">3D Visualization</h3>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">
                  Real-time rendering of generated plans into photorealistic models.
                </p>
              </div>
            </div>

            {/* Material Estimation */}
            <div className="bg-white dark:bg-surface-container rounded-xl border border-[#DDE2E0] dark:border-outline p-lg flex flex-col justify-between hover:shadow-elevation transition-shadow">
              <div className="w-12 h-12 bg-primary-container/10 dark:bg-primary-container/20 rounded-lg flex items-center justify-center mb-md border border-primary/20 dark:border-primary-fixed/20">
                <span className="material-symbols-outlined text-primary dark:text-primary-fixed">calculate</span>
              </div>
              <div>
                <h3 className="text-headline-sm text-on-surface dark:text-surface-container-lowest mb-xs">Material Estimation</h3>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">
                  Automated quantity takeoff and precise cost forecasting.
                </p>
              </div>
            </div>

            {/* BOQ + Marketplace (spans 2, mini table on right) */}
            <div className="md:col-span-2 bg-white dark:bg-surface-container rounded-xl border border-[#DDE2E0] dark:border-outline p-lg flex flex-col justify-between hover:shadow-elevation transition-shadow relative overflow-hidden group">
              <div className="relative z-10 w-full md:w-1/2">
                <div className="w-12 h-12 bg-primary-container/10 dark:bg-primary-container/20 rounded-lg flex items-center justify-center mb-md border border-primary/20 dark:border-primary-fixed/20">
                  <span className="material-symbols-outlined text-primary dark:text-primary-fixed">receipt_long</span>
                </div>
                <h3 className="text-headline-sm text-on-surface dark:text-surface-container-lowest mb-xs">BOQ Generation &amp; Marketplace</h3>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">
                  Instantly generate Bills of Quantities and connect directly with verified vendors for material procurement.
                </p>
                <Link
                  href="/marketplace"
                  className="relative z-10 inline-flex items-center gap-1.5 text-body-sm mt-6 font-semibold text-primary dark:text-primary-fixed hover:underline"
                >
                  Explore Marketplace →
                </Link>
              </div>
              <div className="absolute inset-y-0 right-0 w-1/2 hidden md:flex items-center justify-center p-md border-l border-[#DDE2E0] dark:border-outline group-hover:bg-surface-container dark:group-hover:bg-tertiary-container transition-colors bg-[#FAFAF8] dark:bg-surface-container-highest">
                <div className="w-full bg-white dark:bg-surface-container border border-[#DDE2E0] dark:border-outline rounded shadow-sm p-sm">
                  <div className="flex justify-between border-b border-[#DDE2E0] dark:border-outline pb-2 mb-2 font-mono-technical text-xs text-on-surface-variant dark:text-surface-variant">
                    <span>Item</span>
                    <span>Qty</span>
                    <span>Unit</span>
                  </div>
                  <div className="space-y-2 font-mono-technical text-xs text-on-surface dark:text-surface-container-lowest">
                    <div className="flex justify-between">
                      <span>Struct. Steel</span>
                      <span>12.5</span>
                      <span>Ton</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Concrete</span>
                      <span>450</span>
                      <span>m³</span>
                    </div>
                    <div className="flex justify-between text-primary dark:text-primary-fixed font-bold">
                      <span>Rebar</span>
                      <span>Procure &gt;</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI-Driven Estimation */}
        <section className="py-24 px-margin-mobile md:px-margin-desktop bg-white dark:bg-surface-container-highest border-y border-outline-variant dark:border-outline">
          <div className="max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-xl items-center">
            <div>
              <h2 className="text-headline-lg text-on-surface dark:text-surface-container-lowest mb-md">AI-Driven Estimation</h2>
              <p className="text-body-lg text-on-surface-variant dark:text-surface-variant mb-lg">
                Experience unparalleled accuracy in construction budgeting. Our advanced AI models analyze your generated
                designs to produce instantaneous, highly detailed material takeoffs and cost estimations.
              </p>
              <ul className="space-y-4 text-body-md text-on-surface dark:text-surface-container-lowest">
                {[
                  "Real-time adjustments based on design changes.",
                  "Regional cost variations factored in automatically.",
                  "Comprehensive lifecycle cost analysis.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-sm">
                    <span className="material-symbols-outlined text-primary dark:text-primary-fixed">check_circle</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#FAFAF8] dark:bg-surface-container p-xl rounded-2xl border border-outline-variant dark:border-outline shadow-sm flex items-center justify-center min-h-[300px]">
              <div className="w-full bg-white dark:bg-surface-container-highest rounded-lg shadow-md overflow-hidden border border-outline-variant dark:border-outline">
                <div className="bg-primary-container text-white px-md py-sm text-label-md flex justify-between">
                  <span>Project Estimate</span>
                  <span>Ref: PRJ-992</span>
                </div>
                <div className="p-md space-y-3 font-mono-technical text-sm">
                  <div className="flex justify-between border-b border-outline-variant/50 pb-2">
                    <span>Foundation Concrete</span>
                    <span>$14,500</span>
                  </div>
                  <div className="flex justify-between border-b border-outline-variant/50 pb-2">
                    <span>Structural Steel</span>
                    <span>$32,100</span>
                  </div>
                  <div className="flex justify-between border-b border-outline-variant/50 pb-2">
                    <span>Glazing</span>
                    <span>$18,900</span>
                  </div>
                  <div className="flex justify-between font-bold pt-2 text-primary dark:text-primary-fixed">
                    <span>Total Est. Cost</span>
                    <span>$65,500</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Verified Vendor Network */}
        <section className="py-24 px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-xl items-center">
            <div className="order-2 md:order-1 bg-[#FAFAF8] dark:bg-surface-container p-xl rounded-2xl border border-outline-variant dark:border-outline shadow-sm flex items-center justify-center min-h-[300px] relative overflow-hidden">
              <div className="absolute inset-0 hero-pattern opacity-50" />
              <div className="relative z-10 grid grid-cols-2 gap-md w-full">
                {[
                  { icon: "local_shipping", name: "SteelCorp" },
                  { icon: "forest", name: "EcoTimber" },
                  { icon: "water_drop", name: "ClearGlass Co." },
                  { icon: "foundation", name: "Prime Concrete" },
                ].map((v) => (
                  <div
                    key={v.name}
                    className="bg-white dark:bg-surface-container-highest p-md rounded-lg shadow-sm border border-outline-variant dark:border-outline text-center"
                  >
                    <span className="material-symbols-outlined text-primary dark:text-primary-fixed text-3xl mb-sm block mx-auto">{v.icon}</span>
                    <span className="text-label-md font-bold block">{v.name}</span>
                    <span className="text-xs text-on-surface-variant dark:text-surface-variant block mt-1">Verified Supplier</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="order-1 md:order-2">
              <h2 className="text-headline-lg text-on-surface dark:text-surface-container-lowest mb-md">Verified Vendor Network</h2>
              <p className="text-body-lg text-on-surface-variant dark:text-surface-variant mb-lg">
                Seamlessly transition from design to procurement. Our integrated marketplace connects your generated Bill of
                Quantities directly to a curated network of highly vetted, industry-leading material suppliers.
              </p>
              <ul className="space-y-4 text-body-md text-on-surface dark:text-surface-container-lowest">
                {[
                  { icon: "star", text: "Stringent quality and reliability vetting process." },
                  { icon: "sync_alt", text: "Direct BOQ import for instant quoting." },
                  { icon: "verified_user", text: "Secure, escrow-backed transaction management." },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-sm">
                    <span className="material-symbols-outlined text-primary dark:text-primary-fixed">{item.icon}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Featured Projects */}
        <section className="py-24 px-margin-mobile md:px-margin-desktop bg-white dark:bg-inverse-surface border-t border-outline-variant dark:border-outline">
          <div className="max-w-[1440px] mx-auto">
            <div className="mb-xl text-center max-w-3xl mx-auto">
              <h2 className="text-headline-lg text-on-surface dark:text-surface-container-lowest mb-sm">Featured Projects</h2>
              <p className="text-body-md text-on-surface-variant dark:text-surface-variant">
                See how top architectural firms are leveraging BuildSmart AI to deliver sustainable, cutting-edge designs.
              </p>
            </div>
            <div className="relative w-full h-[600px] rounded-2xl overflow-hidden shadow-xl group">
              <Image
                src="/images/hero-interior.png"
                alt="Interior of a modern sustainable office building with sunlight"
                fill
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                sizes="100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 w-full p-xl">
                <span className="inline-block bg-primary text-white px-3 py-1 rounded-full text-label-md mb-md border border-white/20">
                  CASE STUDY
                </span>
                <h3 className="text-headline-lg text-white mb-sm">Sustainable Corporate Headquarters</h3>
                <p className="text-body-md text-gray-200 max-w-2xl mb-lg">
                  Designed entirely using BuildSmart AI&apos;s generative algorithms, this headquarters achieved LEED Platinum
                  certification while reducing material waste by 30% during construction.
                </p>
                <Link
                  href="/projects"
                  className="inline-block bg-white text-primary hover:bg-surface-container-low text-label-md px-lg py-sm rounded transition-colors shadow-md"
                >
                  View Full Case Study
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#FAFAF8] dark:bg-inverse-surface border-t border-outline-variant dark:border-outline">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter px-margin-mobile md:px-margin-desktop py-xl max-w-[1440px] mx-auto">
          <div>
            <div className="flex items-center gap-xs mb-sm">
              <span className="material-symbols-outlined text-primary dark:text-primary-fixed" style={{ fontVariationSettings: "'FILL' 1" }}>
                architecture
              </span>
              <span className="text-headline-sm text-primary dark:text-primary-fixed font-bold">BuildSmart AI</span>
            </div>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-md">
              Engineering the future of AEC through intelligent automation.
            </p>
          </div>

          <div className="flex flex-col gap-sm">
            <h4 className="text-label-md text-on-surface dark:text-surface-container-lowest font-bold uppercase tracking-wider mb-sm">Platform</h4>
            <Link href="/ai-design" className="text-body-sm text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed hover:underline transition-all duration-200">
              AI Design
            </Link>
            <Link href="/marketplace" className="text-body-sm text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed hover:underline transition-all duration-200">
              Marketplace
            </Link>
            <Link href="/estimation" className="text-body-sm text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed hover:underline transition-all duration-200">
              Estimation
            </Link>
          </div>

          <div className="flex flex-col gap-sm">
            <h4 className="text-label-md text-on-surface dark:text-surface-container-lowest font-bold uppercase tracking-wider mb-sm">Professionals</h4>
            <Link href="/register?role=architect" className="text-body-sm text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed hover:underline transition-all duration-200">
              Architects
            </Link>
            <Link href="/register?role=vendor" className="text-body-sm text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed hover:underline transition-all duration-200">
              Vendors
            </Link>
            <Link href="/register" className="text-body-sm text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed hover:underline transition-all duration-200">
              Contractors
            </Link>
          </div>

          <div className="flex flex-col gap-sm">
            <h4 className="text-label-md text-on-surface dark:text-surface-container-lowest font-bold uppercase tracking-wider mb-sm">Company</h4>
            <Link href="/about" className="text-body-sm text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed hover:underline transition-all duration-200">
              About Us
            </Link>
            <Link href="/services" className="text-body-sm text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed hover:underline transition-all duration-200">
              Services
            </Link>
            <Link href="/testimonials" className="text-body-sm text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed hover:underline transition-all duration-200">
              Testimonials
            </Link>
            <Link href="/blog" className="text-body-sm text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed hover:underline transition-all duration-200">
              Blog &amp; Insights
            </Link>
            <Link href="/support" className="text-body-sm text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed hover:underline transition-all duration-200">
              Contact
            </Link>
          </div>

          <div className="col-span-1 md:col-span-4 mt-xl pt-lg border-t border-[#DDE2E0] dark:border-outline flex flex-col md:flex-row justify-between items-center gap-md">
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">
              © {new Date().getFullYear()} BuildSmart AI. Engineering the future of AEC.
            </p>
            <div className="flex gap-md">
              <a href="#" className="text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed transition-colors">
                <span className="material-symbols-outlined">language</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
