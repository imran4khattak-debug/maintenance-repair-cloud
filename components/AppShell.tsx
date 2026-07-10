"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const menu = [
  { href: "/", label: "Dashboard" },
  { href: "/company", label: "Company Setup" },
  { href: "/accounts", label: "Chart of Accounts" },
  { href: "/customers", label: "Customers" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/items", label: "Items & Services" },
  { href: "/jobs", label: "Maintenance Jobs" },
  { href: "/quotations", label: "Quotations" },
  { href: "/sales", label: "Sales / Tax Invoices" },
  { href: "/purchases", label: "Purchases / Supplier Bills" },
  { href: "/vouchers", label: "Payment / Receipt / JV" },
  { href: "/vat", label: "VAT Module" },
  { href: "/reports", label: "Reports" },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-20 w-72 overflow-y-auto bg-slate-950 text-white shadow-xl">
        <div className="border-b border-slate-800 px-6 py-5">
          <h1 className="text-lg font-bold">Maintenance Repair App</h1>
          <p className="mt-1 text-sm text-slate-400">Property Maintenance & Repairs</p>
        </div>
        <nav className="space-y-1 px-4 py-5 text-sm">
          {menu.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-4 py-3 transition ${
                  active
                    ? "bg-slate-800 font-semibold text-white"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="ml-72 min-h-screen flex-1">{children}</main>
    </div>
  );
}

