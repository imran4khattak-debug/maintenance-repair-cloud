import { revalidatePath } from "next/cache";
import PageHeader from "@/components/PageHeader";
import { Button, Card, Input, Label } from "@/components/Card";
import { prisma } from "@/lib/prisma";

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}

function cleanDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return new Date();
  }

  const date = new Date(`${text}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}

function cleanEndDate(value: FormDataEntryValue | null) {
  const date = cleanDate(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function money(value: unknown) {
  return Number(value || 0).toFixed(2);
}

function dateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

async function calculateVatTotals(startDate: Date, endDate: Date) {
  const lines = await prisma.voucherLine.findMany({
    where: {
      account: {
        code: {
          in: ["1160", "2130"],
        },
      },
      voucher: {
        status: "POSTED",
        voucherDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    },
    include: {
      account: true,
      voucher: {
        include: {
          customer: true,
          supplier: true,
        },
      },
    },
  });

  const inputVat = lines
    .filter((line) => line.account.code === "1160")
    .reduce((sum, line) => sum + Number(line.debit), 0);

  const outputVat = lines
    .filter((line) => line.account.code === "2130")
    .reduce((sum, line) => sum + Number(line.credit), 0);

  const netVatPayable = outputVat - inputVat;

  return {
    inputVat,
    outputVat,
    netVatPayable,
    lines,
  };
}

async function createVatPeriod(formData: FormData) {
  "use server";

  const name = cleanText(formData.get("name"));
  const startDate = cleanDate(formData.get("startDate"));
  const endDate = cleanEndDate(formData.get("endDate"));
  const dueDateText = cleanText(formData.get("dueDate"));
  const dueDate = dueDateText
    ? cleanDate(formData.get("dueDate"))
    : addDays(endDate, 28);

  if (!name) {
    throw new Error("VAT period name is required.");
  }

  if (startDate > endDate) {
    throw new Error("Start date cannot be after end date.");
  }

  await prisma.vatPeriod.create({
    data: {
      name,
      startDate,
      endDate,
      dueDate,
      status: "OPEN",
      outputVat: 0,
      inputVat: 0,
      netVatPayable: 0,
    },
  });

  revalidatePath("/vat");
}

async function closeVatPeriod(formData: FormData) {
  "use server";

  const periodId = String(formData.get("periodId") ?? "").trim();

  if (!periodId) {
    throw new Error("VAT period is required.");
  }

  const period = await prisma.vatPeriod.findUnique({
    where: {
      id: periodId,
    },
  });

  if (!period) {
    throw new Error("VAT period not found.");
  }

  if (period.status === "CLOSED") {
    return;
  }

  const outputVatAccount = await prisma.account.findUnique({
    where: {
      code: "2130",
    },
  });

  const inputVatAccount = await prisma.account.findUnique({
    where: {
      code: "1160",
    },
  });

  const vatPayableAccount = await prisma.account.findUnique({
    where: {
      code: "2140",
    },
  });

  if (!outputVatAccount) {
    throw new Error(
      "Output VAT account 2130 is missing. Go to Chart of Accounts and click Seed Default COA."
    );
  }

  if (!inputVatAccount) {
    throw new Error(
      "Input VAT account 1160 is missing. Go to Chart of Accounts and click Seed Default COA."
    );
  }

  if (!vatPayableAccount) {
    throw new Error(
      "VAT Payable account 2140 is missing. Go to Chart of Accounts and click Seed Default COA."
    );
  }

  const totals = await calculateVatTotals(period.startDate, period.endDate);

  const outputVat = Number(totals.outputVat.toFixed(2));
  const inputVat = Number(totals.inputVat.toFixed(2));
  const netVatPayable = Number((outputVat - inputVat).toFixed(2));

  await prisma.vatPeriod.update({
    where: {
      id: period.id,
    },
    data: {
      outputVat,
      inputVat,
      netVatPayable,
      status: "CLOSED",
    },
  });

  const inputOffset = Math.min(inputVat, outputVat);
  const payableAmount = Math.max(netVatPayable, 0);

  if (outputVat > 0) {
    const count = await prisma.voucher.count({
      where: {
        voucherType: "VAT_SETTLEMENT",
      },
    });

    const voucherNo = `VAT-${String(count + 1).padStart(5, "0")}`;

    await prisma.voucher.create({
      data: {
        voucherNo,
        voucherType: "VAT_SETTLEMENT",
        voucherDate: period.endDate,
        partyType: "VAT",
        narration: `VAT settlement for ${period.name}`,
        totalDebit: outputVat,
        totalCredit: outputVat,
        status: "POSTED",
        lines: {
          create: [
            {
              accountId: outputVatAccount.id,
              description: `Close output VAT for ${period.name}`,
              debit: outputVat,
              credit: 0,
            },
            ...(inputOffset > 0
              ? [
                  {
                    accountId: inputVatAccount.id,
                    description: `Offset input VAT for ${period.name}`,
                    debit: 0,
                    credit: inputOffset,
                  },
                ]
              : []),
            ...(payableAmount > 0
              ? [
                  {
                    accountId: vatPayableAccount.id,
                    description: `VAT payable to FTA for ${period.name}`,
                    debit: 0,
                    credit: payableAmount,
                  },
                ]
              : []),
          ],
        },
      },
    });
  }

  revalidatePath("/vat");
}

async function reopenVatPeriod(formData: FormData) {
  "use server";

  const periodId = String(formData.get("periodId") ?? "").trim();

  if (!periodId) {
    return;
  }

  await prisma.vatPeriod.update({
    where: {
      id: periodId,
    },
    data: {
      status: "OPEN",
    },
  });

  revalidatePath("/vat");
}

export default async function VatPage() {
  const today = new Date();
  const year = today.getFullYear();

  const defaultStart = new Date(year, 0, 1);
  const defaultEnd = new Date(year, 2, 31);
  defaultEnd.setHours(23, 59, 59, 999);

  const allTimeStart = new Date("2000-01-01T00:00:00");
  const allTimeEnd = new Date("2099-12-31T23:59:59");

  const allTimeTotals = await calculateVatTotals(allTimeStart, allTimeEnd);

  const periods = await prisma.vatPeriod.findMany({
    orderBy: {
      startDate: "desc",
    },
  });

  const periodSummaries = await Promise.all(
    periods.map(async (period) => {
      const totals = await calculateVatTotals(period.startDate, period.endDate);

      return {
        period,
        inputVat: totals.inputVat,
        outputVat: totals.outputVat,
        netVatPayable: totals.netVatPayable,
      };
    })
  );

  const recentVatLines = await prisma.voucherLine.findMany({
    where: {
      account: {
        code: {
          in: ["1160", "2130", "2140"],
        },
      },
      voucher: {
        status: "POSTED",
      },
    },
    include: {
      account: true,
      voucher: {
        include: {
          customer: true,
          supplier: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  const vatPayable = allTimeTotals.outputVat - allTimeTotals.inputVat;

  const outputVatAccount = await prisma.account.findUnique({
    where: {
      code: "2130",
    },
  });

  const inputVatAccount = await prisma.account.findUnique({
    where: {
      code: "1160",
    },
  });

  const vatPayableAccount = await prisma.account.findUnique({
    where: {
      code: "2140",
    },
  });

  const setupReady =
    Boolean(outputVatAccount) &&
    Boolean(inputVatAccount) &&
    Boolean(vatPayableAccount);

  return (
    <>
      <PageHeader
        title="VAT Module"
        subtitle="Manage VAT periods, input VAT, output VAT and VAT payable."
      />

      <div className="space-y-6 p-8">
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <p className="text-sm text-slate-500">Output VAT</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(allTimeTotals.outputVat)}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Input VAT</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(allTimeTotals.inputVat)}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">VAT Payable</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(Math.max(vatPayable, 0))}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">
              VAT Refundable / Carry Forward
            </p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(Math.max(vatPayable * -1, 0))}
            </p>
          </Card>
        </div>

        {!setupReady ? (
          <Card className="border-amber-200 bg-amber-50">
            <h2 className="text-lg font-semibold text-amber-900">
              Required VAT accounts missing
            </h2>

            <div className="mt-3 grid gap-2 text-sm text-amber-800 md:grid-cols-3">
              <p>1160 Input VAT: {inputVatAccount ? "Yes" : "No"}</p>
              <p>2130 Output VAT: {outputVatAccount ? "Yes" : "No"}</p>
              <p>2140 VAT Payable: {vatPayableAccount ? "Yes" : "No"}</p>
            </div>

            <p className="mt-3 text-sm text-amber-800">
              Go to Chart of Accounts and click Seed Default COA.
            </p>
          </Card>
        ) : null}

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            Create VAT Period
          </h2>

          <form
            action={createVatPeriod}
            className="mt-5 grid gap-5 md:grid-cols-5"
          >
            <div>
              <Label>VAT Period Name</Label>
              <Input
                name="name"
                required
                defaultValue={`VAT Q1 ${year}`}
                placeholder="Example: VAT Q1 2026"
              />
            </div>

            <div>
              <Label>Start Date</Label>
              <Input
                name="startDate"
                type="date"
                defaultValue={dateInputValue(defaultStart)}
              />
            </div>

            <div>
              <Label>End Date</Label>
              <Input
                name="endDate"
                type="date"
                defaultValue={dateInputValue(defaultEnd)}
              />
            </div>

            <div>
              <Label>Due Date</Label>
              <Input
                name="dueDate"
                type="date"
                defaultValue={dateInputValue(addDays(defaultEnd, 28))}
              />
            </div>

            <div className="flex items-end">
              <Button type="submit">Create VAT Period</Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            VAT Periods
          </h2>

          <div className="mt-5 overflow-x-auto rounded-lg">
            <table className="min-w-[1200px] w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2 whitespace-nowrap">Period</th>
                  <th className="py-2 whitespace-nowrap">Start</th>
                  <th className="py-2 whitespace-nowrap">End</th>
                  <th className="py-2 whitespace-nowrap">Due Date</th>
                  <th className="py-2 text-right whitespace-nowrap">
                    Output VAT
                  </th>
                  <th className="py-2 text-right whitespace-nowrap">
                    Input VAT
                  </th>
                  <th className="py-2 text-right whitespace-nowrap">Payable</th>
                  <th className="py-2 pr-6 text-right whitespace-nowrap">
                    Refundable
                  </th>
                  <th className="py-2 pl-6 whitespace-nowrap">Status</th>
                  <th className="py-2 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>

              <tbody>
                {periodSummaries.map((summary) => {
                  const period = summary.period;
                  const payable = Math.max(summary.netVatPayable, 0);
                  const refundable = Math.max(summary.netVatPayable * -1, 0);

                  return (
                    <tr key={period.id} className="border-b last:border-0">
                      <td className="py-3 font-medium text-slate-900">
                        {period.name}
                      </td>
                      <td className="py-3">
                        {dateInputValue(period.startDate)}
                      </td>
                      <td className="py-3">{dateInputValue(period.endDate)}</td>
                      <td className="py-3">{dateInputValue(period.dueDate)}</td>
                      <td className="py-3 text-right">
                        {money(summary.outputVat)}
                      </td>
                      <td className="py-3 text-right">
                        {money(summary.inputVat)}
                      </td>
                      <td className="py-3 text-right font-semibold">
                        {money(payable)}
                      </td>
                      <td className="py-3 pr-6 text-right font-semibold">
                        {money(refundable)}
                      </td>
                      <td className="py-3 pl-6">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            period.status === "CLOSED"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {period.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {period.status === "OPEN" ? (
                          <form action={closeVatPeriod}>
                            <input
                              type="hidden"
                              name="periodId"
                              value={period.id}
                            />
                            <button
                              type="submit"
                              className="rounded-lg bg-slate-950 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                            >
                              Close / Settle
                            </button>
                          </form>
                        ) : (
                          <form action={reopenVatPeriod}>
                            <input
                              type="hidden"
                              name="periodId"
                              value={period.id}
                            />
                            <button
                              type="submit"
                              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold hover:bg-slate-100"
                            >
                              Reopen
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {periodSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      No VAT periods found. Create your first VAT period above.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            Recent VAT Transactions
          </h2>

          <div className="mt-5 overflow-x-auto rounded-lg">
            <table className="min-w-[1150px] w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2 whitespace-nowrap">Date</th>
                  <th className="py-2 whitespace-nowrap">Voucher</th>
                  <th className="py-2 whitespace-nowrap">Type</th>
                  <th className="py-2 whitespace-nowrap">Party</th>
                  <th className="py-2 whitespace-nowrap">Account</th>
                  <th className="py-2 text-right whitespace-nowrap">Debit</th>
                  <th className="py-2 pr-6 text-right whitespace-nowrap">
                    Credit
                  </th>
                  <th className="py-2 pl-6 whitespace-nowrap">VAT Code</th>
                </tr>
              </thead>

              <tbody>
                {recentVatLines.map((line) => {
                  const party =
                    line.voucher.customer?.name ||
                    line.voucher.supplier?.name ||
                    line.voucher.partyType ||
                    "-";

                  return (
                    <tr key={line.id} className="border-b last:border-0">
                      <td className="py-3">
                        {dateInputValue(line.voucher.voucherDate)}
                      </td>
                      <td className="py-3 font-mono">
                        {line.voucher.voucherNo}
                      </td>
                      <td className="py-3">{line.voucher.voucherType}</td>
                      <td className="py-3 font-medium text-slate-900">
                        {party}
                      </td>
                      <td className="py-3">
                        {line.account.code} - {line.account.name}
                      </td>
                      <td className="py-3 text-right">{money(line.debit)}</td>
                      <td className="py-3 pr-6 text-right">
                        {money(line.credit)}
                      </td>
                      <td className="py-3 pl-6">{line.vatCode || "-"}</td>
                    </tr>
                  );
                })}

                {recentVatLines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No VAT transactions found yet. Create sales invoices and
                      supplier bills with VAT.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            VAT Accounting Logic
          </h2>

          <div className="mt-4 overflow-x-auto rounded-lg">
            <table className="min-w-[950px] w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2">Transaction</th>
                  <th className="py-2">Input / Output</th>
                  <th className="py-2">Account</th>
                  <th className="py-2">Effect</th>
                </tr>
              </thead>

              <tbody>
                <tr className="border-b">
                  <td className="py-3 font-medium">Supplier Bill</td>
                  <td className="py-3">Input VAT</td>
                  <td className="py-3">1160 - Input VAT Recoverable</td>
                  <td className="py-3">Debit</td>
                </tr>

                <tr className="border-b">
                  <td className="py-3 font-medium">Sales Invoice</td>
                  <td className="py-3">Output VAT</td>
                  <td className="py-3">2130 - Output VAT Payable</td>
                  <td className="py-3">Credit</td>
                </tr>

                <tr>
                  <td className="py-3 font-medium">VAT Settlement</td>
                  <td className="py-3">Net VAT</td>
                  <td className="py-3">2140 - VAT Payable to FTA</td>
                  <td className="py-3">Credit payable amount</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}