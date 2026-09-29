import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About BuildSmart AI — Design Smarter. Build Better.",
  description:
    "BuildSmart AI unites AI-powered design, material estimation, and procurement in one platform for clients, architects, and vendors.",
};

const VALUES = [
  {
    icon: "architecture",
    title: "Design Intelligence",
    text: "We believe artificial intelligence should accelerate human creativity, not replace it. Every tool is built to give professionals more time to design.",
  },
  {
    icon: "eco",
    title: "Sustainable by Default",
    text: "From passive cooling strategies to low-carbon materials, sustainability is woven into our models, workflows, and product recommendations.",
  },
  {
    icon: "verified_user",
    title: "Trust & Verification",
    text: "Professionals and vendors are verified before they join. Projects, reviews, and transactions are protected by a transparent, auditable platform.",
  },
  {
    icon: "sync_alt",
    title: "Connected Workflows",
    text: "Design, estimation, procurement, and delivery should feel like one continuous process — not a series of disconnected handoffs.",
  },
  {
    icon: "groups",
    title: "Built for Collaboration",
    text: "Clients, architects, vendors, and project teams share a single source of truth, reducing miscommunication and costly revisions.",
  },
  {
    icon: "insights",
    title: "Data-Driven Decisions",
    text: "We turn project data into useful insight so every stakeholder can make faster, more confident decisions.",
  },
];

const MILESTONES = [
  { year: "2024", title: "The BuildSmart vision", text: "The journey begins with a simple belief: architecture and construction need better digital tools." },
  { year: "2025", title: "AI design studio launches", text: "Architects gain generative concept tools, 3D visualisation, and intelligent floor-plan editing." },
  { year: "2026", title: "Connected marketplace", text: "Verified vendors, direct BOQ procurement, and transparent pricing link design directly to supply." },
  { year: "Today", title: "An intelligent AEC platform", text: "From first idea to delivered project, BuildSmart AI keeps professionals moving forward." },
];

const TEAM = [
  { initials: "EV", name: "Elena Voss", role: "Co-Founder & Principal Architect", focus: "Architecture · Sustainability" },
  { initials: "JH", name: "Jordan Hale", role: "Co-Founder & Product Lead", focus: "Client Experience · Design Systems" },
  { initials: "MH", name: "Marcus Hale", role: "Head of Supply Network", focus: "Materials · Procurement" },
  { initials: "AK", name: "Amina Kone", role: "Head of AI Engineering", focus: "Machine Learning · Generative Design" },
];

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[78vh] flex items-center overflow-hidden">
        <Image
          src="/images/hero-villa.png"
          alt="Modern glass villa at sunset designed with BuildSmart AI"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25" />
        <div className="relative z-10 px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto py-32 w-full">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-label-md border border-white/30 uppercase tracking-wider">
              <span className="material-symbols-outlined text-[18px]">flag</span>
              About BuildSmart AI
            </span>
            <h1 className="font-display text-[42px] md:text-[64px] leading-tight text-white mt-6 mb-md">
              We are building the intelligent heart of the AEC industry.
            </h1>
            <p className="font-body-lg text-body-lg text-white/85 max-w-2xl mb-xl">
              BuildSmart AI makes architecture more creative, construction more predictable, and
              procurement more connected — for clients, architects, and vendors alike.
            </p>
            <div className="flex flex-wrap gap-md">
              <Link href="/services" className="bg-primary hover:bg-primary-container text-white text-label-md px-xl py-md rounded-lg transition-colors shadow-lg">
                Explore Services
              </Link>
              <Link href="/blog" className="bg-white/10 backdrop-blur-sm border border-white text-white hover:bg-white hover:text-primary text-label-md px-xl py-md rounded-lg transition-all duration-300">
                Read Our Story
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-24 px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-xl items-center">
          <div className="order-2 lg:order-1 relative h-[420px] md:h-[520px] rounded-2xl overflow-hidden shadow-elevation-hover">
            <Image
              src="/images/project-villa.png"
              alt="Modern family home with tropical garden"
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#17201e]/60 to-transparent" />
            <div className="absolute bottom-0 p-lg text-white">
              <p className="font-display text-[34px] leading-none">24%</p>
              <p className="text-body-sm text-white/80 mt-sm">average reduction in material waste on BuildSmart projects</p>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <span className="text-label-md text-primary dark:text-primary-fixed uppercase tracking-wider">Our Mission</span>
            <h2 className="text-headline-lg text-on-surface dark:text-surface-container-lowest mt-2 mb-md">
              Making complex construction feel simple, human, and sustainable.
            </h2>
            <p className="text-body-lg text-on-surface-variant dark:text-surface-variant mb-lg">
              BuildSmart AI exists to close the gap between a brilliant architectural idea and the
              finished building. By combining generative design, real-time estimation, and a
              curated supply network, we help teams make confident decisions before construction
              begins.
            </p>
            <div className="grid sm:grid-cols-3 gap-md">
              {[
                { icon: "hub", label: "One connected platform" },
                { icon: "efficient", label: "Less wasted effort" },
                { icon: "savings", label: "More predictable cost" },
              ].map((item) => (
                <div key={item.label} className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-md text-center">
                  <span className="material-symbols-outlined text-primary dark:text-primary-fixed text-[28px] block mb-sm">{item.icon}</span>
                  <span className="text-body-sm font-semibold text-on-surface dark:text-surface-container-lowest">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-[#17201e] dark:bg-[#101816] text-[#EFFCF7]">
        <div className="px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-lg text-center">
          {[
            { value: "3,400+", label: "Projects delivered" },
            { value: "1,800+", label: "Verified professionals" },
            { value: "120+", label: "Cities served" },
            { value: "4.9/5", label: "Average platform rating" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-display text-[40px] md:text-[52px] text-[#A2D0BC]">{stat.value}</p>
              <p className="text-body-sm text-[#A8B1AD] mt-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="py-24 px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-xl">
          <span className="text-label-md text-primary dark:text-primary-fixed uppercase tracking-wider">What drives us</span>
          <h2 className="text-headline-lg text-on-surface dark:text-surface-container-lowest mt-2">Values that shape every pixel and decision</h2>
          <p className="text-body-md text-on-surface-variant dark:text-surface-variant mt-sm">
            Six principles guide how we design, build, and support the people using BuildSmart AI.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {VALUES.map((value) => (
            <div
              key={value.title}
              className="group bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-lg hover:-translate-y-1 hover:shadow-elevation-hover transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-lg bg-primary-container/10 dark:bg-primary-fixed/10 border border-primary/20 dark:border-primary-fixed/20 flex items-center justify-center mb-lg group-hover:bg-primary-container group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-primary dark:text-primary-fixed group-hover:text-white">{value.icon}</span>
              </div>
              <h3 className="text-headline-sm text-on-surface dark:text-surface-container-lowest mb-sm">{value.title}</h3>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{value.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Story / image split */}
      <section className="py-24 px-margin-mobile md:px-margin-desktop bg-white dark:bg-surface-container-highest">
        <div className="max-w-[1440px] mx-auto grid lg:grid-cols-2 gap-xl items-center">
          <div>
            <span className="text-label-md text-primary dark:text-primary-fixed uppercase tracking-wider">Our approach</span>
            <h2 className="text-headline-lg text-on-surface dark:text-surface-container-lowest mt-2 mb-lg">
              Technology should disappear into great work.
            </h2>
            <div className="space-y-lg">
              {[
                { icon: "view_in_ar", title: "From conversation to concept", text: "Describe your project and let generative intelligence open new creative directions." },
                { icon: "monitoring", title: "Every decision shows consequences", text: "Budget, quantity, and supply impact are visible as the design evolves." },
                { icon: "package_2", title: "Supply follows design", text: "Verified materials and vendor quotes are directly connected to your bill of quantities." },
              ].map((item) => (
                <div key={item.title} className="flex gap-md">
                  <span className="material-symbols-outlined text-primary dark:text-primary-fixed text-[28px] flex-shrink-0">{item.icon}</span>
                  <div>
                    <h3 className="text-headline-sm text-on-surface dark:text-surface-container-lowest mb-xs">{item.title}</h3>
                    <p className="text-body-md text-on-surface-variant dark:text-surface-variant">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative h-[420px] md:h-[520px] rounded-2xl overflow-hidden shadow-elevation-hover">
            <Image
              src="/images/blueprint-ai.png"
              alt="Architectural blueprint concept on a digital screen"
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </div>
        </div>
      </section>

      {/* Journey */}
      <section className="py-24 px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-xl">
          <span className="text-label-md text-primary dark:text-primary-fixed uppercase tracking-wider">Our journey</span>
          <h2 className="text-headline-lg text-on-surface dark:text-surface-container-lowest mt-2">From idea to intelligent AEC platform</h2>
        </div>
        <div className="relative grid md:grid-cols-4 gap-lg">
          <div className="hidden md:block absolute left-0 right-0 top-6 h-px bg-outline-variant dark:bg-outline" />
          {MILESTONES.map((item, index) => (
            <div key={item.year} className="relative">
              <div className="w-12 h-12 rounded-full bg-primary-container dark:bg-primary-fixed text-white dark:text-on-primary-fixed flex items-center justify-center font-display text-[15px] z-10 relative border-4 border-[#FAFAF8] dark:border-[#17201e]">
                {index + 1}
              </div>
              <p className="text-label-md text-primary dark:text-primary-fixed mt-md mb-xs">{item.year}</p>
              <h3 className="text-headline-sm text-on-surface dark:text-surface-container-lowest mb-sm">{item.title}</h3>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="py-24 px-margin-mobile md:px-margin-desktop bg-white dark:bg-surface-container-highest">
        <div className="max-w-[1440px] mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-xl">
            <span className="text-label-md text-primary dark:text-primary-fixed uppercase tracking-wider">Leadership</span>
            <h2 className="text-headline-lg text-on-surface dark:text-surface-container-lowest mt-2">The people behind the platform</h2>
            <p className="text-body-md text-on-surface-variant dark:text-surface-variant mt-sm">
              Architects, engineers, designers, and technologists working at the intersection of craft and code.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
            {TEAM.map((member) => (
              <div key={member.name} className="bg-[#FAFAF8] dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-lg text-center hover:-translate-y-1 hover:shadow-elevation-hover transition-all duration-300">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#315C4C] to-[#A2D0BC] text-white flex items-center justify-center font-display text-[22px] mb-md shadow-lg">
                  {member.initials}
                </div>
                <h3 className="text-headline-sm text-on-surface dark:text-surface-container-lowest">{member.name}</h3>
                <p className="text-label-md text-primary dark:text-primary-fixed mt-xs">{member.role}</p>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-sm">{member.focus}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 overflow-hidden">
        <Image
          src="/images/project-eco-office.png"
          alt="Modern sustainable office building"
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#17201e]/75" />
        <div className="relative z-10 px-margin-mobile md:px-margin-desktop max-w-4xl mx-auto text-center text-white">
          <h2 className="text-headline-lg md:text-headline-lg mb-md">Ready to design and build smarter?</h2>
          <p className="text-body-lg text-white/85 mb-xl">
            Join thousands of clients, architects, and vendors already transforming how projects come to life.
          </p>
          <div className="flex flex-wrap justify-center gap-md">
            <Link href="/register" className="bg-white text-primary hover:bg-surface-container-low text-label-md px-xl py-md rounded-lg transition-colors shadow-lg">
              Create Free Account
            </Link>
            <Link href="/marketplace" className="bg-white/10 border border-white/60 text-white hover:bg-white hover:text-primary text-label-md px-xl py-md rounded-lg transition-all">
              Browse Marketplace
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
