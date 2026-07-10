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

function amountInWords(amount: number) {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertBelowThousand(num: number) {
    let words = "";

    if (num >= 100) {
      words += `${ones[Math.floor(num / 100)]} Hundred `;
      num %= 100;
    }

    if (num >= 20) {
      words += `${tens[Math.floor(num / 10)]} `;
      num %= 10;
    }

    if (num > 0) {
      words += `${ones[num]} `;
    }

    return words.trim();
  }

  let number = Math.floor(amount);

  if (number === 0) {
    return "Zero";
  }

  let words = "";

  if (number >= 1000000) {
    words += `${convertBelowThousand(Math.floor(number / 1000000))} Million `;
    number %= 1000000;
  }

  if (number >= 1000) {
    words += `${convertBelowThousand(Math.floor(number / 1000))} Thousand `;
    number %= 1000;
  }

  if (number > 0) {
    words += convertBelowThousand(number);
  }

  return words.trim();
}

export default async function SalesInvoicePrintPage({
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

  const invoice = await prisma.voucher.findUnique({
    where: {
      id,
    },
    include: {
      customer: true,
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

  if (!invoice || invoice.voucherType !== "SALES_INVOICE") {
    notFound();
  }

  const receivableLine = invoice.lines.find(
    (line) => line.account.code === "1130"
  );

  const outputVatLine = invoice.lines.find(
    (line) => line.account.code === "2130"
  );

  const incomeLines = invoice.lines.filter(
    (line) => Number(line.credit) > 0 && line.account.code !== "2130"
  );

  const subtotal = incomeLines.reduce(
    (sum, line) => sum + Number(line.credit),
    0
  );

  const vatAmount = outputVatLine ? Number(outputVatLine.credit) : 0;

  const totalAmount = receivableLine
    ? Number(receivableLine.debit)
    : Number(invoice.totalDebit);

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
          href="/sales"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
        >
          Back to Sales
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
                Tax Invoice
              </p>
              <h2 className="mt-2 text-3xl font-black">{invoice.voucherNo}</h2>
              <p className="mt-2 text-sm text-slate-600">
                Date: {localDate(invoice.voucherDate)}
              </p>
            </div>
          </div>
        </header>

        <section className="mt-8 grid grid-cols-2 gap-8">
          <div className="rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold uppercase text-slate-500">
              Bill To
            </h3>

            <div className="mt-3 space-y-1 text-sm">
              <p className="text-lg font-bold text-slate-950">
                {invoice.customer?.name || "-"}
              </p>
              <p>{invoice.customer?.address || "-"}</p>
              <p>Mobile: {invoice.customer?.mobile || "-"}</p>
              <p>Email: {invoice.customer?.email || "-"}</p>
              <p>TRN: {invoice.customer?.trnNumber || "-"}</p>
              <p>License No: {invoice.customer?.licenseNumber || "-"}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold uppercase text-slate-500">
              Invoice Details
            </h3>

            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Invoice No</span>
                <span className="font-semibold">{invoice.voucherNo}</span>
              </div>

              <div className="flex justify-between">
                <span>Invoice Date</span>
                <span className="font-semibold">
                  {localDate(invoice.voucherDate)}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Status</span>
                <span className="font-semibold">{invoice.status}</span>
              </div>

              <div className="flex justify-between">
                <span>VAT Code</span>
                <span className="font-semibold">
                  {outputVatLine?.vatCode || "ZERO"}
                </span>
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
                  Description
                </th>
                <th className="border border-slate-950 px-3 py-3 text-right">
                  Qty
                </th>
                <th className="border border-slate-950 px-3 py-3 text-right">
                  Rate
                </th>
                <th className="border border-slate-950 px-3 py-3 text-right">
                  VAT Code
                </th>
                <th className="border border-slate-950 px-3 py-3 text-right">
                  Amount
                </th>
              </tr>
            </thead>

            <tbody>
              {incomeLines.map((line, index) => (
                <tr key={line.id}>
                  <td className="border border-slate-300 px-3 py-3">
                    {index + 1}
                  </td>
                  <td className="border border-slate-300 px-3 py-3">
                    <p className="font-semibold">
                      {line.description ||
                        invoice.narration ||
                        line.account.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Account: {line.account.code} - {line.account.name}
                    </p>
                  </td>
                  <td className="border border-slate-300 px-3 py-3 text-right">
                    1
                  </td>
                  <td className="border border-slate-300 px-3 py-3 text-right">
                    {money(line.credit)}
                  </td>
                  <td className="border border-slate-300 px-3 py-3 text-right">
                    {line.vatCode || "-"}
                  </td>
                  <td className="border border-slate-300 px-3 py-3 text-right font-semibold">
                    {money(line.credit)}
                  </td>
                </tr>
              ))}

              {incomeLines.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="border border-slate-300 px-3 py-8 text-center text-slate-500"
                  >
                    No invoice lines found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="mt-8 grid grid-cols-2 gap-8">
          <div>
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold uppercase text-slate-500">
                Amount in Words
              </h3>
              <p className="mt-3 font-semibold">
                AED {amountInWords(totalAmount)} Only
              </p>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold uppercase text-slate-500">
                Notes
              </h3>
              <p className="mt-3 text-sm text-slate-700">
                {invoice.narration || "Thank you for your business."}
              </p>
            </div>
          </div>

          <div>
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex justify-between border-b py-2">
                <span>Subtotal</span>
                <span className="font-semibold">{money(subtotal)}</span>
              </div>

              <div className="flex justify-between border-b py-2">
                <span>VAT</span>
                <span className="font-semibold">{money(vatAmount)}</span>
              </div>

              <div className="flex justify-between py-4 text-xl font-black">
                <span>Total</span>
                <span>{money(totalAmount)}</span>
              </div>
            </div>
          </div>
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