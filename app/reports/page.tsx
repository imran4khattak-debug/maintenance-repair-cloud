import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/utils";

export default async function ReportsPage() {
  const accounts = await prisma.account.findMany({ include: { voucherLines: true }, orderBy: { code: "asc" } });
  const trial = accounts.map((a) => {
    const debit = Number(a.openingDebit) + a.voucherLines.reduce((s, l) => s + Number(l.debit), 0);
    const credit = Number(a.openingCredit) + a.voucherLines.reduce((s, l) => s + Number(l.credit), 0);
    return { ...a, debit, credit, balance: debit - credit };
  });
  const totalDebit = trial.reduce((s, a) => s + a.debit, 0);
  const totalCredit = trial.reduce((s, a) => s + a.credit, 0);
  const customers = await prisma.customer.findMany({ include: { vouchers: true }, orderBy: { name: "asc" } });
  const suppliers = await prisma.supplier.findMany({ include: { vouchers: true }, orderBy: { name: "asc" } });

  return <><PageHeader title="Reports" subtitle="Trial balance, customer statement, supplier statement and VAT summary." /><div className="space-y-6 p-8"><Card><h3 className="mb-4 text-lg font-bold">Trial Balance</h3><table className="w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="py-2">Code</th><th>Account</th><th>Type</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead><tbody>{trial.map((a) => <tr key={a.id} className="border-b last:border-0"><td className="py-2 font-mono">{a.code}</td><td>{a.name}</td><td>{a.type}</td><td className="text-right">{money(a.debit)}</td><td className="text-right">{money(a.credit)}</td></tr>)}<tr className="font-bold"><td className="py-3" colSpan={3}>Total</td><td className="text-right">{money(totalDebit)}</td><td className="text-right">{money(totalCredit)}</td></tr></tbody></table></Card><div className="grid gap-6 md:grid-cols-2"><Card><h3 className="mb-4 text-lg font-bold">Customer Balances</h3><table className="w-full text-sm"><tbody>{customers.map((c) => { const debit = c.vouchers.reduce((s,v)=>s+Number(v.totalDebit),0); const credit = c.vouchers.reduce((s,v)=>s+Number(v.totalCredit),0); return <tr key={c.id} className="border-b last:border-0"><td className="py-2">{c.name}</td><td className="text-right font-semibold">{money(Number(c.openingBalance)+debit-credit)}</td></tr>; })}</tbody></table></Card><Card><h3 className="mb-4 text-lg font-bold">Supplier Balances</h3><table className="w-full text-sm"><tbody>{suppliers.map((s) => { const debit = s.vouchers.reduce((sum,v)=>sum+Number(v.totalDebit),0); const credit = s.vouchers.reduce((sum,v)=>sum+Number(v.totalCredit),0); return <tr key={s.id} className="border-b last:border-0"><td className="py-2">{s.name}</td><td className="text-right font-semibold">{money(Number(s.openingBalance)+credit-debit)}</td></tr>; })}</tbody></table></Card></div></div></>;
}

