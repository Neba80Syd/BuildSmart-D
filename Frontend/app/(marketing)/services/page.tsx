import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "BuildSmart AI Services — AI Design, Estimation, Procurement & More",
  description:
    "Explore BuildSmart AI services: generative architecture design, 3D visualisation, material estimation, BOQ, collaboration, and connected procurement.",
};

const SERVICES = [
  {
    icon: "auto_awesome",
    title: "AI Architectural Design",
    text: "Turn a brief into multiple concept directions using generative intelligence tuned for climate, site, and programme.",
  },
  {
    icon: "edit_square",
    title: "2D & 3D Floor Plans",
    text: "Create, edit, and publish intelligent floor plans with automatic spatial data for walls, rooms, and openings.",
  },
  {
    icon: "view_in_ar",
    title: "3D Visualisation",
    text: "Let clients walk through a design before it is built. Real-time 3D previews keep approvals simple and confident.",
  },
  {
    icon: "request_quote",
    title: "Material Estimation & BOQ",
    text: "Generate a detailed bill of quantities directly from your design, updated automatically as the design evolves.",
  },
  {
    icon: "storefront",
    title: "Marketplace Procurement",
    text: "Source verified materials, compare supplier prices, and move from BOQ to purchase without leaving the project.",
  },
  {
    icon: "forum",
    title: "Project Collaboration",
    text: "Messages, appointments, approvals, and real-time notifications keep clients, architects, and vendors aligned.",
  },
  {
    icon: "verified_user",
    title: "Professional Verification",
    text: "Verified architects and suppliers build a trustworthy network, with credentials, reviews, and audit trails.",
  },
  {
    icon: "monitoring",
    title: "Analytics & Reporting",
    text: "Understand project performance, marketplace trends, and business health through clear, role-aware analytics.",
  },
];

const PROCESS = [
  { icon: "lightbulb", step: "01", title: "Describe your project", text: "Start with a brief, site details, and goals. BuildSmart AI turns context into directions." },
  { icon: "architecture", step: "02", title: "Design & refine", text: "Generate concepts with AI, edit floor plans, and explore 3D versions in one workspace." },
  { icon: "optimization", step: "03", title: "Measure & estimate", text: "Quantities and costs appear alongside the design, so decisions are made with real data." },
  { icon: "inventory", step: "04", title: "Procure & deliver", text: "Send the BOQ to verified vendors, compare quotes, manage orders, and track delivery." },
];

const AUDIENCES = [
  {
    icon: "home",
    title: "For Clients",
    text: "Turn a home or commercial project into a clear design with confident budgets and a trusted professional team.",
    href: "/register",
    cta: "Start a project",
  },
  {
    icon: "architecture",
    title: "For Architects",
    text: "Accelerate concept work, improve client approval, and connect design decisions to procurement instantly.",
    href: "/register?role=architect",
    cta: "Join as architect",
  },
  {
    icon: "storefront",
    title: "For Vendors",
    text: "Receive precise project demand, showcase verified products, and manage a professional digital storefront.",
    href: "/register?role=vendor",
    cta: "Join as vendor",
  },
  {
    icon: "shield",
    title: "For Administrators",
    text: "Manage users, verification, content, finance, and platform health through a single governance console.",
    href: "/login",
    cta: "Open console",
  },
];

export default function ServicesPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[72vh] flex items-center overflow-hidden">
        <Image
          src="/images/project-eco-office.png"
          alt="Sustainable modern office building designed with BuildSmart AI"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#17201e]/90 via-[#17201e]/65 to-[#17201e]/30" />
        <div className="relative z-10 px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto py-32 w-full">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-label-md border border-white/30 uppercase tracking-wider">
              <span className="material-symbols-outlined text-[18px]">layers</span>
              BuildSmart Services
            </span>
            <h1 className="font-display text-[42px] md:text-[64px] leading-tight text-white mt-6 mb-md">
              One platform. Every stage of the build.
            </h1>
            <p className="font-body-lg text-body-lg text-white/85 max-w-2xl mb-xl">
              From the first creative spark to the final delivery schedule, BuildSmart AI connects
              design, estimation, collaboration, and procurement into one intelligent workflow.
            </p>
            <div className="flex flex-wrap gap-md">
              <Link href="/register" className="bg-primary hover:bg-primary-container text-white text-label-md px-xl py-md rounded-lg transition-colors shadow-lg">
                Start Free
              </Link>
              <Link href="/blog" className="bg-white/10 backdrop-blur-sm border border-white text-white hover:bg-white hover:text-primary text-label-md px-xl py-md rounded-lg transition-all duration-300">
                See How It Works
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Services grid */}
      <section className="py-24 px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-xl">
          <span className="text-label-md text-primary dark:text-primary-fixed uppercase tracking-wider">What we offer</span>
          <h2 className="text-headline-lg text-on-surface dark:text-surface-container-lowest mt-2">Services for every AEC professional</h2>
          <p className="text-body-md text-on-surface-variant dark:text-surface-variant mt-sm">
            Modular tools that work beautifully on their own and even better together.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {SERVICES.map((service) => (
            <div
              key={service.title}
              className="group relative bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-lg hover:-translate-y-1 hover:shadow-elevation-hover transition-all duration-300 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary-container/5 dark:bg-primary-fixed/5 rounded-bl-full group-hover:bg-primary-container/10 transition-colors" />
              <div className="w-12 h-12 rounded-lg bg-primary-container/10 dark:bg-primary-fixed/10 border border-primary/20 dark:border-primary-fixed/20 flex items-center justify-center mb-lg relative z-10 group-hover:bg-primary-container group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-primary dark:text-primary-fixed group-hover:text-white">{service.icon}</span>
              </div>
              <h3 className="text-headline-sm text-on-surface dark:text-surface-container-lowest mb-sm relative z-10">{service.title}</h3>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant relative z-10">{service.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Process */}
      <section className="py-24 px-margin-mobile md:px-margin-desktop bg-[#17201e] dark:bg-[#101816] text-[#EFFCF7]">
        <div className="max-w-[1440px] mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-xl">
            <span className="text-label-md text-[#A2D0BC] uppercase tracking-wider">How it works</span>
            <h2 className="text-headline-lg text-[#EFFCF7] mt-2">From idea to delivery in four connected steps</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-lg">
            {PROCESS.map((item) => (
              <div key={item.step} className="relative">
                <div className="w-12 h-12 rounded-full bg-[#315C4C] text-white flex items-center justify-center font-display text-[16px] mb-lg">
                  {item.step}
                </div>
                <span className="material-symbols-outlined text-[#A2D0BC] text-[30px] block mb-sm">{item.icon}</span>
                <h3 className="text-headline-sm text-[#EFFCF7] mb-sm">{item.title}</h3>
                <p className="text-body-sm text-[#A8B1AD]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Powered by image feature */}
      <section className="py-24 px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-xl items-center">
          <div className="relative h-[420px] md:h-[520px] rounded-2xl overflow-hidden shadow-elevation-hover">
            <Image
              src="/images/marketplace-hero.png"
              alt="BuildSmart marketplace connecting design to materials"
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#17201e]/70 to-transparent" />
            <div className="absolute bottom-0 p-lg text-white">
              <p className="material-symbols-outlined text-[30px]">inventory_2</p>
              <h3 className="text-headline-sm mt-sm">Design that connects to supply</h3>
            </div>
          </div>
          <div>
            <span className="text-label-md text-primary dark:text-primary-fixed uppercase tracking-wider">Connected procurement</span>
            <h2 className="text-headline-lg text-on-surface dark:text-surface-container-lowest mt-2 mb-md">
              Your bill of quantities is already speaking with the marketplace.
            </h2>
            <p className="text-body-lg text-on-surface-variant dark:text-surface-variant mb-lg">
              When the design changes, estimation and procurement respond. Vendors see real demand,
              clients see real prices, and no one is left connecting spreadsheets by hand.
            </p>
            <ul className="space-y-md">
              {[
                { icon: "sync_alt", text: "Direct BOQ export to verified suppliers for instant quoting." },
                { icon: "fact_check", text: "Transparent product attributes, stock, and vendor trust levels." },
                { icon: "receipt_long", text: "Order tracking, returns, and financial records in one place." },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-sm">
                  <span className="material-symbols-outlined text-primary dark:text-primary-fixed">{item.icon}</span>
                  <span className="text-body-md text-on-surface dark:text-surface-container-lowest">{item.text}</span>
                </li>
              ))}
            </ul>
            <Link href="/marketplace" className="btn-primary mt-lg">
              Explore Marketplace
            </Link>
          </div>
        </div>
      </section>

      {/* Audiences */}
      <section className="py-24 px-margin-mobile md:px-margin-desktop bg-white dark:bg-surface-container-highest">
        <div className="max-w-[1440px] mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-xl">
            <span className="text-label-md text-primary dark:text-primary-fixed uppercase tracking-wider">Who it&apos;s for</span>
            <h2 className="text-headline-lg text-on-surface dark:text-surface-container-lowest mt-2">Built for every role in the ecosystem</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
            {AUDIENCES.map((audience) => (
              <div key={audience.title} className="bg-[#FAFAF8] dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-lg flex flex-col">
                <div className="w-12 h-12 rounded-lg bg-primary-container/10 border border-primary/20 flex items-center justify-center mb-lg">
                  <span className="material-symbols-outlined text-primary dark:text-primary-fixed">{audience.icon}</span>
                </div>
                <h3 className="text-headline-sm text-on-surface dark:text-surface-container-lowest mb-sm">{audience.title}</h3>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant flex-1">{audience.text}</p>
                <Link href={audience.href} className="inline-flex items-center gap-1 text-label-md text-primary dark:text-primary-fixed mt-lg hover:gap-2 transition-all">
                  {audience.cta}
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto">
        <div className="relative rounded-2xl overflow-hidden">
          <Image
            src="/images/hero-interior.png"
            alt="Interior of a sustainable modern building"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[#17201e]/80" />
          <div className="relative z-10 px-margin-mobile md:px-lg py-24 text-center text-white max-w-3xl mx-auto">
            <h2 className="text-headline-lg mb-md">Ready to bring intelligence to your next project?</h2>
            <p className="text-body-lg text-white/85 mb-xl">
              Create a free account and start exploring AI design, estimation, and verified procurement today.
            </p>
            <Link href="/register" className="inline-flex bg-white text-primary hover:bg-surface-container-low text-label-md px-xl py-md rounded-lg transition-colors shadow-lg">
              Get Started Free
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
