import { MarketingHeader } from "@/Frontend/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/Frontend/components/marketing/MarketingFooter";

export const dynamic = "force-dynamic";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#17201e] text-on-surface dark:text-surface-container-lowest">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
