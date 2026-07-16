import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

function money(value: unknown) {
  return Number(value || 0).toFixed(2);
}

function localDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${day}/${month}/${year}`;
}

function voucherTitle(type: string) {
  if (type === "RECEIPT") return "Receipt Voucher";
  if (type === "PAYMENT") return "Payment Voucher";
  if (type === "JOURNAL") return "Journal Voucher";
  return "Voucher";
}

export default async function VoucherPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const company = await prisma.company.findFirst({
    orderBy: {
      createdAt: "asc",
    },
  });

  const voucher = await prisma.voucher.findUnique({
    where: {
      id,
    },
    include: {
      customer: true,
      supplier: true,
      lines: {
        include: {
          account: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!voucher || !["RECEIPT", "PAYMENT", "JOURNAL"].includes(voucher.voucherType)) {
    notFound();
  }

  const partyName =
    voucher.customer?.name ||
    voucher.supplier?.name ||
    voucher.partyType ||
    "-";

  const partyDetails =
    voucher.customer?.mobile ||
    voucher.supplier?.mobile ||
    voucher.customer?.email ||
    voucher.supplier?.email ||
    "-";

  return (
    <main className="min-h-screen bg-slate-200 p-6 text-slate-950 print:bg-white print:p-0">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          .no-print {
            display: none !important;
          }

          .print-page {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            width: 100% !important;
            min-height: auto !important;
          }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-5xl items-center justify-between">
        <Link
          href="/vouchers"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
        >
          Back to Vouchers
        </Link>

        <div className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
          Press Ctrl + P to Print / Save PDF
        </div>
      </div>

      <section className="print-page mx-auto min-h-[297mm] max-w-5xl rounded-xl border border-slate-200 bg-white p-10 shadow-sm">
        <header className="border-b-4 border-slate-950 pb-6">
          <div className="flex items-start justify-between gap-8">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight">
                {company?.name || "Maintenance Repair App"}
              </h1>

              <div className="mt-3 max-w-xl space-y-1 text-sm text-slate-600">
                <p>{company?.activity || "Property Maintenance & Repairs"}</p>
                <p>{company?.address || "-"}</p>
                <p>
                  Phone: {company?.phone || "-"} | Email:{" "}
                  {company?.email || "-"}
                </p>
                <p>TRN: {company?.trnNumber || "-"}</p>
                <p>License No: {company?.licenseNumber || "-"}</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm font-semibold uppercase text-slate-500">
                {voucherTitle(voucher.voucherType)}
              </p>
              <h2 className="mt-2 text-3xl font-black">{voucher.voucherNo}</h2>
              <p className="mt-2 text-sm text-slate-600">
                Date: {localDate(voucher.voucherDate)}
              </p>
            </div>
          </div>
        </header>

        <section className="mt-8 grid grid-cols-2 gap-8">
          <div className="rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold uppercase text-slate-500">
              Party Details
            </h3>

            <div className="mt-3 space-y-1 text-sm">
              <p className="text-lg font-bold text-slate-950">{partyName}</p>
              <p>Type: {voucher.partyType || "-"}</p>
              <p>Contact: {partyDetails}</p>
              <p>Customer TRN: {voucher.customer?.trnNumber || "-"}</p>
              <p>Supplier TRN: {voucher.supplier?.trnNumber || "-"}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold uppercase text-slate-500">
              Voucher Details
            </h3>

            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Voucher No</span>
                <span className="font-semibold">{voucher.voucherNo}</span>
              </div>

              <div className="flex justify-between">
                <span>Voucher Date</span>
                <span className="font-semibold">
                  {localDate(voucher.voucherDate)}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Voucher Type</span>
                <span className="font-semibold">{voucher.voucherType}</span>
              </div>

              <div className="flex justify-between">
                <span>Status</span>
                <span className="font-semibold">{voucher.status}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-950 text-white">
                <th className="border border-slate-950 px-3 py-3 text-left">
                  #
                </th>
                <th className="border border-slate-950 px-3 py-3 text-left">
                  Account
                </th>
                <th className="border border-slate-950 px-3 py-3 text-left">
                  Description
                </th>
                <th className="border border-slate-950 px-3 py-3 text-right">
                  Debit
                </th>
                <th className="border border-slate-950 px-3 py-3 text-right">
                  Credit
                </th>
              </tr>
            </thead>

            <tbody>
              {voucher.lines.map((line, index) => (
                <tr key={line.id}>
                  <td className="border border-slate-300 px-3 py-3">
                    {index + 1}
                  </td>
                  <td className="border border-slate-300 px-3 py-3">
                    <p className="font-semibold">{line.account.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {line.account.code}
                    </p>
                  </td>
                  <td className="border border-slate-300 px-3 py-3">
                    {line.description || voucher.narration || "-"}
                  </td>
                  <td className="border border-slate-300 px-3 py-3 text-right">
                    {Number(line.debit) > 0 ? money(line.debit) : "-"}
                  </td>
                  <td className="border border-slate-300 px-3 py-3 text-right">
                    {Number(line.credit) > 0 ? money(line.credit) : "-"}
                  </td>
                </tr>
              ))}

              <tr className="bg-slate-50 font-bold">
                <td className="border border-slate-300 px-3 py-3" colSpan={3}>
                  Total
                </td>
                <td className="border border-slate-300 px-3 py-3 text-right">
                  {money(voucher.totalDebit)}
                </td>
                <td className="border border-slate-300 px-3 py-3 text-right">
                  {money(voucher.totalCredit)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mt-8 rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold uppercase text-slate-500">
            Narration
          </h3>
          <p className="mt-3 text-sm text-slate-700">
            {voucher.narration || "-"}
          </p>
        </section>

        <footer className="mt-16 grid grid-cols-3 gap-8 text-center text-sm">
          <div>
            <div className="border-t border-slate-400 pt-3">Prepared By</div>
          </div>

          <div>
            <div className="border-t border-slate-400 pt-3">Checked By</div>
          </div>

          <div>
            <div className="border-t border-slate-400 pt-3">Approved By</div>
          </div>
        </footer>
      </section>
    </main>
  );
}