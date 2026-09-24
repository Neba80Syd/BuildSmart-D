import Link from "next/link";

const PLATFORM = [
  { label: "AI Design Studio", href: "/ai-design" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Material Estimation", href: "/estimation" },
  { label: "3D Visualization", href: "/viewer" },
];

const COMPANY = [
  { label: "About Us", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Testimonials", href: "/testimonials" },
  { label: "Blog & Insights", href: "/blog" },
  { label: "Support", href: "/support" },
];

const PROFESSIONALS = [
  { label: "For Architects", href: "/register?role=architect" },
  { label: "For Clients", href: "/register" },
  { label: "For Vendors", href: "/register?role=vendor" },
];

export function MarketingFooter() {
  return (
    <footer className="bg-[#17201e] dark:bg-[#101816] text-[#EFFCF7]">
      <div className="px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-lg py-xl">
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-sm mb-md">
              <span
                className="material-symbols-outlined text-[#A2D0BC] text-[26px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                architecture
              </span>
              <span className="text-headline-md font-bold text-[#EFFCF7]">BuildSmart AI</span>
            </div>
            <p className="text-body-sm text-[#A8B1AD] max-w-xs">
              The intelligent platform for architecture, engineering, and construction. Design
              smarter. Build better.
            </p>
            <div className="flex gap-md mt-lg">
              {["language", "linkedin", "mail"].map((icon) => (
                <a
                  key={icon}
                  href="#"
                  className="w-9 h-9 rounded-full border border-[#3F4946] flex items-center justify-center text-[#A8B1AD] hover:border-[#A2D0BC] hover:text-[#A2D0BC] transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">{icon}</span>
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-label-md font-bold uppercase tracking-wider text-[#A2D0BC] mb-md">Platform</h4>
            <ul className="space-y-sm">
              {PLATFORM.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-body-sm text-[#A8B1AD] hover:text-[#EFFCF7] transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-label-md font-bold uppercase tracking-wider text-[#A2D0BC] mb-md">Company</h4>
            <ul className="space-y-sm">
              {COMPANY.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-body-sm text-[#A8B1AD] hover:text-[#EFFCF7] transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-label-md font-bold uppercase tracking-wider text-[#A2D0BC] mb-md">Professionals</h4>
            <ul className="space-y-sm">
              {PROFESSIONALS.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-body-sm text-[#A8B1AD] hover:text-[#EFFCF7] transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2">
            <h4 className="text-label-md font-bold uppercase tracking-wider text-[#A2D0BC] mb-md">Newsletter</h4>
            <p className="text-body-sm text-[#A8B1AD] mb-md">
              Monthly insights on AI architecture, sustainable design, and smart procurement.
            </p>
            <form className="flex gap-sm" action="/blog" method="get">
              <input
                type="email"
                name="q"
                placeholder="you@example.com"
                className="flex-1 min-w-0 bg-[#1F2926] border border-[#3F4946] rounded-lg px-3 py-2 text-sm text-[#EFFCF7] placeholder:text-[#A8B1AD]/60 focus:outline-none focus:border-[#A2D0BC]"
              />
              <button className="bg-[#315C4C] hover:bg-[#264B3E] text-white text-label-md px-4 py-2 rounded-lg transition-colors">
                Subscribe
              </button>
            </form>
          </div>
        </div>

        <div className="border-t border-[#3F4946] py-lg flex flex-col md:flex-row items-center justify-between gap-md">
          <p className="text-body-sm text-[#A8B1AD]">© {new Date().getFullYear()} BuildSmart AI. Engineering the future of AEC.</p>
          <div className="flex gap-lg">
            {["Privacy", "Terms", "Cookies"].map((text) => (
              <a key={text} href="#" className="text-body-sm text-[#A8B1AD] hover:text-[#EFFCF7] transition-colors">
                {text}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
