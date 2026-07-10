import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { money } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const [openJobs, pendingQuotations, customerVouchers, openVat] = await Promise.all([
    prisma.maintenanceJob.count({ where: { status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
    prisma.quotation.count({ where: { status: { in: ["DRAFT", "SENT", "PENDING"] } } }),
    prisma.voucher.aggregate({
      where: { customerId: { not: null } },
      _sum: { totalDebit: true, totalCredit: true },
    }),
    prisma.vatPeriod.findFirst({ where: { status: "OPEN" }, orderBy: { endDate: "desc" } }),
  ]);

  const customerBalance = Number(customerVouchers._sum.totalDebit ?? 0) - Number(customerVouchers._sum.totalCredit ?? 0);

  return (
    <>
      <PageHeader
        title="Maintenance & Repair Dashboard"
        subtitle="Manage jobs, quotations, invoices, vouchers, VAT and reports."
      />
      <div className="p-8">
        <div className="grid gap-6 md:grid-cols-4">
          <Card><p className="text-sm text-slate-500">Open Jobs</p><p className="mt-3 text-3xl font-bold">{openJobs}</p></Card>
          <Card><p className="text-sm text-slate-500">Pending Quotations</p><p className="mt-3 text-3xl font-bold">{pendingQuotations}</p></Card>
          <Card><p className="text-sm text-slate-500">Customer Balance</p><p className="mt-3 text-3xl font-bold">{money(customerBalance)}</p></Card>
          <Card><p className="text-sm text-slate-500">VAT Payable</p><p className="mt-3 text-3xl font-bold">{money(openVat?.netVatPayable ?? 0)}</p></Card>
        </div>
        <Card className="mt-8">
          <h3 className="text-lg font-bold">Project Status</h3>
          <p className="mt-2 text-slate-600">The database is connected. Core pages are ready for company setup, chart of accounts, customers, suppliers, items, jobs, quotations, tax invoices, purchases, vouchers, VAT and reports.</p>
        </Card>
      </div>
    </>
  );
}

