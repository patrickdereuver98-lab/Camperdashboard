import type { Metadata } from "next";
import { AdminShell } from "./shell";

export const metadata: Metadata = {
  title: { default: "Beheer", template: "%s | Beheer VrijStaan" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
