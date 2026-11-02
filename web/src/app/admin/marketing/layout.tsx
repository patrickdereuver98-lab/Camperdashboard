import type { Metadata } from "next";
import { MarketingNav } from "./nav";

export const metadata: Metadata = { title: "Marketing" };

/**
 * Marketing- en contentdashboard (plan docs/marketing/plan.md): VrijStaan zelf promoten. Alleen rol admin; de
 * database (has_admin_role, RLS) geeft anderen lege lijsten en weigert de feitenbank.
 */
export default function MarketingLayout({ children }: LayoutProps<"/admin/marketing">) {
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <MarketingNav />
      {children}
    </div>
  );
}
