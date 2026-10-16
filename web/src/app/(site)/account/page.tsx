import type { Metadata } from "next";
import { AccountView } from "./account-view";

export const metadata: Metadata = { title: "Mijn account", robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-16 sm:px-6">
      <AccountView />
    </div>
  );
}
