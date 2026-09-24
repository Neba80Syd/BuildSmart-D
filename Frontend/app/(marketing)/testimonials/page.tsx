import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "BuildSmart AI Testimonials — What Clients, Architects & Vendors Say",
  description:
    "Read stories from clients, architects, and vendors who use BuildSmart AI to design faster, estimate accurately, and procure verified materials.",
};

const FEATURED = {
  quote:
    "BuildSmart AI changed how we present projects. Our clients now walk through a design before it is built, and the BOQ updates automatically the moment anything changes. The marketplace turned our supply chain from a spreadsheet hunt into a connected, transparent flow.",
  name: "Amara N.",
  role: "Property Developer, Douala",
  initials: "AN",
  image: "/images/project-eco-office.png",
  tags: ["Faster client approvals", "Accurate estimates", "Verified vendors"],
};

const TESTIMONIALS = [
  {
    quote:
      "I sketched a concept in the morning and had three viable directions with energy and site context by lunch. It gives me the artistic headroom to focus on what matters.",
    name: "Josh K.",
    role: "Architect",
    initials: "JK",
    tag: "Architects",
    rating: 5,
  },
  {
    quote:
      "The material estimate is always in sync with my design. I no longer run around with printed plans trying to explain quantities — vendors see exactly what I need.",
    name: "Elena M.",
    role: "Architect, Yaoundé",
    initials: "EM",
    tag: "Architects",
    rating: 5,
  },
  {
    quote:
      "As a client, I felt involved from day one. The 3D preview and real pricing made our budget conversations constructive instead of stressful.",
    name: "Daniel O.",
    role: "Homeowner",
    initials: "DO",
    tag: "Clients",
    rating: 5,
  },
  {
    quote:
      "I receive project demand directly instead of competing for generic enquiries. The verification badge gives buyers confidence before they even message me.",
    name: "Marcus T.",
    role: "Supplier",
    initials: "MT",
    tag: "Vendors",
    rating: 5,
  },
  {
    quote:
      "The collaboration space keeps my team aligned. Appointments, approvals, and notifications replaced a dozen disconnected chat threads.",
    name: "Sofia L.",
    role: "Project Manager",
    initials: "SL",
    tag: "Teams",
    rating: 5,
  },
  {
    quote:
      "We manage hundreds of buyers and products. Having a single marketplace view with verification, stock, and order tracking has been transformative for us.",
    name: "Paul A.",
    role: "Operations Lead",
    initials: "PA",
    tag: "Vendors",
    rating: 5,
  },
  {
    quote:
      "From first concept to procurement, everything is in one place. Our delivery cycle shortened, and our stakeholders finally share the same source of truth.",
    name: "Nadia B.",
    role: "Client, Corporate Office Project",
    initials: "NB",
    tag: "Teams",
    rating: 5,
  },
  {
    quote:
      "The marketplace is my first stop when planning a project. I compare real prices, stock, and certifications without calling ten suppliers individually.",
    name: "Samuel N.",
    role: "Contractor",
    initials: "SN",
    tag: "Clients",
    rating: 5,
  },
  {
    quote:
      "The verification process is meaningful. It rewards professionals who deliver and makes the whole network more trustworthy.",
    name: "Grace F.",
    role: "Vendor Manager",
    initials: "GF",
    tag: "Vendors",
    rating: 5,
  },
];

const METRICS = [
  { value: "4.9 / 5", label: "Average experience rating" },
  { value: "120+", label: "Active projects reviewed" },
  { value: "35%", label: "Faster procurement cycles" },
  { value: "92%", label: "Say they would recommend it" },
];

const AUDIENCE_TABS = [
  { label: "Clients", icon: "home", text: "Homeowners and project owners who want transparent budgets, easy approvals, and a team they trust." },
  { label: "Architects", icon: "architecture", text: "Designers who use AI to move from brief to build-ready ideas with less repetitive work." },
  { label: "Vendors", icon: "storefront", text: "Suppliers who get precise demand, a professional storefront, and a verification-backed reputation." },
  { label: "Teams", icon: "groups", text: "Project teams who keep clients, consultants, and procurement aligned on one source of truth." },
];

const quoteMark = (
  <span className="material-symbols-outlined text-[42px] leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>
    format_quote
  </span>
);

export default function TestimonialsPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[68vh] flex items-center overflow-hidden">
        <Image
          src="/images/hero-interior.png"
          alt="Bright sustainable interior from a BuildSmart AI project"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#17201e]/92 via-[#17201e]/70 to-[#17201e]/35" />
        <div className="relative z-10 px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto py-24 w-full">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-label-md border border-white/30 uppercase tracking-wider">
              <span className="material-symbols-outlined text-[18px]">reviews</span>
              BuildSmart Stories
            </span>
            <h1 className="font-display text-[42px] md:text-[64px] leading-tight text-white mt-6 mb-md">
              Trusted by people who build.
            </h1>
            <p className="font-body-lg text-body-lg text-white/85 max-w-2xl mb-xl">
              Clients, architects, vendors, and project teams share how BuildSmart AI helps them
              design faster, estimate confidently, and build with better partners.
            </p>
            <div className="flex flex-wrap gap-md">
              <Link
                href="/register"
                className="bg-primary hover:bg-primary-container text-white text-label-md px-xl py-md rounded-lg transition-colors shadow-lg"
              >
                Start Your Story
              </Link>
              <Link
                href="/marketplace"
                className="bg-white/10 backdrop-blur-sm border border-white text-white hover:bg-white hover:text-primary text-label-md px-xl py-md rounded-lg transition-all duration-300"
              >
                Explore Marketplace
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="py-16 px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-gutter">
          {METRICS.map((m) => (
            <div key={m.label} className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-lg text-center hover:shadow-elevation transition-all">
              <p className="font-display text-[38px] md:text-[48px] font-bold text-primary dark:text-primary-fixed leading-none">{m.value}</p>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-md">{m.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured story */}
      <section className="py-8 pb-20 px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-xl items-stretch rounded-2xl overflow-hidden border border-outline-variant dark:border-outline bg-white dark:bg-surface-container shadow-elevation">
          <div className="relative min-h-[320px] lg:min-h-[480px]">
            <Image
              src={FEATURED.image}
              alt="Featured sustainable office project developed with BuildSmart AI"
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#17201e]/70 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-lg flex items-center gap-3 text-white">
              <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur border border-white/40 flex items-center justify-center font-bold text-headline-sm">
                {FEATURED.initials}
              </div>
              <div>
                <p className="font-bold text-body-lg">{FEATURED.name}</p>
                <p className="text-body-sm text-white/80">{FEATURED.role}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-center p-lg md:p-xl">
            <span className="text-primary dark:text-primary-fixed">{quoteMark}</span>
            <p className="text-body-lg text-on-surface dark:text-surface-container-lowest mt-md mb-lg leading-relaxed">
              {FEATURED.quote}
            </p>
            <div className="flex flex-wrap gap-sm">
              {FEATURED.tags.map((tag) => (
                <span key={tag} className="text-label-md text-primary dark:text-primary-fixed bg-primary-container/10 dark:bg-primary-fixed/10 border border-primary/20 dark:border-primary-fixed/20 px-3 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* By audience */}
      <section className="py-24 px-margin-mobile md:px-margin-desktop bg-[#17201e] dark:bg-[#101816] text-[#EFFCF7]">
        <div className="max-w-[1440px] mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-xl">
            <span className="text-label-md text-[#A2D0BC] uppercase tracking-wider">Who benefits</span>
            <h2 className="text-headline-lg text-[#EFFCF7] mt-2">Real results across the whole project</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
            {AUDIENCE_TABS.map((tab) => (
              <div key={tab.label} className="bg-[#1F2926] border border-[#3F4946] rounded-xl p-lg hover:border-[#A2D0BC] transition-colors">
                <span className="material-symbols-outlined text-[#A2D0BC] text-[32px] block mb-lg">{tab.icon}</span>
                <h3 className="text-headline-sm text-[#EFFCF7] mb-sm">{tab.label}</h3>
                <p className="text-body-sm text-[#A8B1AD]">{tab.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial masonry grid */}
      <section className="py-24 px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-xl">
          <span className="text-label-md text-primary dark:text-primary-fixed uppercase tracking-wider">Testimonials</span>
          <h2 className="text-headline-lg text-on-surface dark:text-surface-container-lowest mt-2">In their own words</h2>
          <p className="text-body-md text-on-surface-variant dark:text-surface-variant mt-sm">
            Honest feedback from the clients, professionals, and suppliers who use BuildSmart AI every day.
          </p>
        </div>

        <div className="columns-1 sm:columns-2 lg:columns-3 gap-gutter [column-fill:_balance]">
          {TESTIMONIALS.map((t) => (
            <div
              key={`${t.name}-${t.role}`}
              className="break-inside-avoid mb-gutter bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-lg hover:shadow-elevation-hover hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="flex items-center gap-1 mb-md">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <span key={i} className="material-symbols-outlined text-[18px] text-[#E8B44C] dark:text-[#F3C871]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    star
                  </span>
                ))}
              </div>
              <p className="text-body-md text-on-surface dark:text-surface-container-lowest leading-relaxed mb-lg">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center justify-between gap-3 border-t border-outline-variant dark:border-outline pt-md">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-primary-container/15 dark:bg-primary-fixed/15 border border-primary/25 dark:border-primary-fixed/25 flex items-center justify-center text-label-md font-bold text-primary dark:text-primary-fixed shrink-0">
                    {t.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-body-md text-on-surface dark:text-surface-container-lowest truncate">{t.name}</p>
                    <p className="text-body-sm text-on-surface-variant dark:text-outline-variant truncate">{t.role}</p>
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-primary dark:text-primary-fixed bg-primary-container/10 dark:bg-primary-fixed/10 px-2 py-1 rounded whitespace-nowrap">
                  {t.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto">
        <div className="relative rounded-2xl overflow-hidden">
          <Image
            src="/images/project-villa.png"
            alt="Modern villa project completed with BuildSmart AI"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[#17201e]/82" />
          <div className="relative z-10 px-margin-mobile md:px-lg py-24 text-center text-white max-w-3xl mx-auto">
            <span className="material-symbols-outlined text-[42px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              comments
            </span>
            <h2 className="text-headline-lg mt-sm mb-md">Be the next success story.</h2>
            <p className="text-body-lg text-white/85 mb-xl">
              Join the community of clients, architects, and vendors building smarter with BuildSmart AI.
            </p>
            <div className="flex flex-wrap gap-md justify-center">
              <Link href="/register" className="inline-flex bg-white text-primary hover:bg-surface-container-low text-label-md px-xl py-md rounded-lg transition-colors shadow-lg">
                Get Started Free
              </Link>
              <Link href="/services" className="inline-flex bg-white/10 backdrop-blur-sm border border-white text-white hover:bg-white hover:text-primary text-label-md px-xl py-md rounded-lg transition-all">
                See the Platform
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
