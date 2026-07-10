import Link from "next/link";
import { revalidatePath } from "next/cache";
import PageHeader from "@/components/PageHeader";
import { Button, Card, Input, Label, Select } from "@/components/Card";
import { prisma } from "@/lib/prisma";

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}

function cleanNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  const number = Number(text || 0);
  return Number.isNaN(number) ? 0 : number;
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

function money(value: unknown) {
  return Number(value || 0).toFixed(2);
}

function vatRateFromCode(vatCode: string) {
  if (vatCode === "STD5") {
    return 0.05;
  }

  return 0;
}

async function createSalesInvoice(formData: FormData) {
  "use server";

  const customerId = String(formData.get("customerId") ?? "").trim();
  const incomeAccountId = String(formData.get("incomeAccountId") ?? "").trim();
  const itemServiceId = String(formData.get("itemServiceId") ?? "").trim();
  const amountBeforeVat = cleanNumber(formData.get("amountBeforeVat"));
  const vatCode = String(formData.get("vatCode") || "STD5");
  const voucherDate = cleanDate(formData.get("voucherDate"));
  const narration = cleanText(formData.get("narration"));

  if (!customerId) {
    throw new Error("Customer is required.");
  }

  if (!incomeAccountId) {
    throw new Error("Income account is required.");
  }

  if (amountBeforeVat <= 0) {
    throw new Error("Amount before VAT must be greater than zero.");
  }

  const accountsReceivable = await prisma.account.findUnique({
    where: {
      code: "1130",
    },
  });

  const outputVatAccount = await prisma.account.findUnique({
    where: {
      code: "2130",
    },
  });

  if (!accountsReceivable) {
    throw new Error(
      "Accounts Receivable account 1130 is missing. Go to Chart of Accounts and click Seed Default COA."
    );
  }

  if (!outputVatAccount) {
    throw new Error(
      "Output VAT account 2130 is missing. Go to Chart of Accounts and click Seed Default COA."
    );
  }

  const selectedItem = itemServiceId
    ? await prisma.itemService.findUnique({
        where: {
          id: itemServiceId,
        },
      })
    : null;

  const vatRate = vatRateFromCode(vatCode);
  const vatAmount = Number((amountBeforeVat * vatRate).toFixed(2));
  const totalAmount = Number((amountBeforeVat + vatAmount).toFixed(2));

  const count = await prisma.voucher.count({
    where: {
      voucherType: "SALES_INVOICE",
    },
  });

  const voucherNo = `SI-${String(count + 1).padStart(5, "0")}`;

  const description =
    narration ||
    selectedItem?.name ||
    "Sales invoice / maintenance service income";

  await prisma.voucher.create({
    data: {
      voucherNo,
      voucherType: "SALES_INVOICE",
      voucherDate,
      partyType: "CUSTOMER",
      customerId,
      narration: description,
      totalDebit: totalAmount,
      totalCredit: totalAmount,
      status: "POSTED",
      lines: {
        create: [
          {
            accountId: accountsReceivable.id,
            description: "Accounts receivable - customer",
            debit: totalAmount,
            credit: 0,
            vatCode,
            vatAmount,
          },
          {
            accountId: incomeAccountId,
            description,
            debit: 0,
            credit: amountBeforeVat,
            vatCode,
            vatAmount,
          },
          ...(vatAmount > 0
            ? [
                {
                  accountId: outputVatAccount.id,
                  description: "Output VAT payable",
                  debit: 0,
                  credit: vatAmount,
                  vatCode,
                  vatAmount,
                },
              ]
            : []),
        ],
      },
    },
  });

  revalidatePath("/sales");
}

export default async function SalesPage() {
  const today = new Date().toISOString().slice(0, 10);

  const customers = await prisma.customer.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const itemServices = await prisma.itemService.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const incomeAccounts = await prisma.account.findMany({
    where: {
      type: "INCOME",
      isPosting: true,
      isActive: true,
    },
    orderBy: {
      code: "asc",
    },
  });

  const accountsReceivable = await prisma.account.findUnique({
    where: {
      code: "1130",
    },
  });

  const outputVatAccount = await prisma.account.findUnique({
    where: {
      code: "2130",
    },
  });

  const invoices = await prisma.voucher.findMany({
    where: {
      voucherType: "SALES_INVOICE",
    },
    orderBy: {
      voucherDate: "desc",
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

  const totalInvoices = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.totalDebit),
    0
  );

  const totalOutputVat = invoices.reduce((sum, invoice) => {
    const outputVatLines = invoice.lines.filter(
      (line) => line.account.code === "2130"
    );

    return (
      sum +
      outputVatLines.reduce((lineSum, line) => lineSum + Number(line.credit), 0)
    );
  }, 0);

  const netSales = totalInvoices - totalOutputVat;

  const setupReady =
    customers.length > 0 &&
    incomeAccounts.length > 0 &&
    Boolean(accountsReceivable) &&
    Boolean(outputVatAccount);

  return (
    <>
      <PageHeader
        title="Sales / Tax Invoices"
        subtitle="Create customer tax invoices with receivable, income and output VAT entries."
      />

      <div className="space-y-6 p-8">
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <p className="text-sm text-slate-500">Total Invoices</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {invoices.length}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Net Sales</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(netSales)}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Output VAT</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(totalOutputVat)}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Customer Receivable</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(totalInvoices)}
            </p>
          </Card>
        </div>

        {!setupReady ? (
          <Card className="border-amber-200 bg-amber-50">
            <h2 className="text-lg font-semibold text-amber-900">
              Required setup before sales invoice
            </h2>

            <div className="mt-3 grid gap-2 text-sm text-amber-800 md:grid-cols-2">
              <p>Customer created: {customers.length > 0 ? "Yes" : "No"}</p>
              <p>
                Income account available:{" "}
                {incomeAccounts.length > 0 ? "Yes" : "No"}
              </p>
              <p>
                Accounts receivable 1130 exists:{" "}
                {accountsReceivable ? "Yes" : "No"}
              </p>
              <p>
                Output VAT account 2130 exists:{" "}
                {outputVatAccount ? "Yes" : "No"}
              </p>
            </div>
          </Card>
        ) : null}

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            Create Sales / Tax Invoice
          </h2>

          <form
            action={createSalesInvoice}
            className="mt-5 grid gap-5 md:grid-cols-5"
          >
            <div>
              <Label>Date</Label>
              <Input name="voucherDate" type="date" defaultValue={today} />
            </div>

            <div>
              <Label>Customer</Label>
              <Select name="customerId" required>
                <option value="">Select Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Item / Service</Label>
              <Select name="itemServiceId">
                <option value="">Optional</option>
                {itemServices.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Income Account</Label>
              <Select name="incomeAccountId" required>
                <option value="">Select Income Account</option>
                {incomeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Amount Before VAT</Label>
              <Input
                name="amountBeforeVat"
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
              />
            </div>

            <div>
              <Label>VAT Code</Label>
              <Select name="vatCode" defaultValue="STD5">
                <option value="STD5">STD5 - 5%</option>
                <option value="ZERO">ZERO - 0%</option>
                <option value="EXEMPT">EXEMPT - 0%</option>
                <option value="OUT">OUT OF SCOPE</option>
              </Select>
            </div>

            <div className="md:col-span-3">
              <Label>Description / Invoice Ref</Label>
              <Input
                name="narration"
                placeholder="Example: AC repair invoice, maintenance job ref, service details"
              />
            </div>

            <div className="flex items-end">
              <Button type="submit">Create Sales Invoice</Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            Sales Invoices List
          </h2>

          <div className="mt-5 overflow-x-auto rounded-lg">
            <table className="min-w-[1200px] w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2 whitespace-nowrap">Invoice No</th>
                  <th className="py-2 whitespace-nowrap">Date</th>
                  <th className="py-2 whitespace-nowrap">Customer</th>
                  <th className="py-2 whitespace-nowrap">Narration</th>
                  <th className="py-2 text-right whitespace-nowrap">Net</th>
                  <th className="py-2 text-right whitespace-nowrap">
                    Output VAT
                  </th>
                  <th className="py-2 pr-6 text-right whitespace-nowrap">
                    Total
                  </th>
                  <th className="py-2 pl-6 whitespace-nowrap">Status</th>
                  <th className="py-2 pl-6 text-right whitespace-nowrap">
                    Print
                  </th>
                </tr>
              </thead>

              <tbody>
                {invoices.map((invoice) => {
                  const outputVat = invoice.lines
                    .filter((line) => line.account.code === "2130")
                    .reduce((sum, line) => sum + Number(line.credit), 0);

                  const net = Number(invoice.totalDebit) - outputVat;

                  return (
                    <tr key={invoice.id} className="border-b last:border-0">
                      <td className="py-3 font-mono">{invoice.voucherNo}</td>
                      <td className="py-3">
                        {invoice.voucherDate.toISOString().slice(0, 10)}
                      </td>
                      <td className="py-3 font-medium text-slate-900">
                        {invoice.customer?.name || "-"}
                      </td>
                      <td className="py-3">{invoice.narration || "-"}</td>
                      <td className="py-3 text-right">{money(net)}</td>
                      <td className="py-3 text-right">{money(outputVat)}</td>
                      <td className="py-3 pr-6 text-right font-semibold">
                        {money(invoice.totalDebit)}
                      </td>
                      <td className="py-3 pl-6">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {invoice.status}
                        </span>
                      </td>
                      <td className="py-3 pl-6 text-right">
                        <Link
                          href={`/sales/${invoice.id}/print`}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold hover:bg-slate-100"
                        >
                          Print
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      No sales invoices found. Create your first sales invoice
                      above.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            Accounting Entry Logic
          </h2>

          <div className="mt-4 overflow-x-auto rounded-lg">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2">Account</th>
                  <th className="py-2">Debit</th>
                  <th className="py-2">Credit</th>
                  <th className="py-2">Purpose</th>
                </tr>
              </thead>

              <tbody>
                <tr className="border-b">
                  <td className="py-3">1130 - Accounts Receivable</td>
                  <td className="py-3">Total invoice amount</td>
                  <td className="py-3">-</td>
                  <td className="py-3">Amount receivable from customer</td>
                </tr>

                <tr className="border-b">
                  <td className="py-3">Selected Income Account</td>
                  <td className="py-3">-</td>
                  <td className="py-3">Amount before VAT</td>
                  <td className="py-3">Maintenance, repair or service income</td>
                </tr>

                <tr>
                  <td className="py-3">2130 - Output VAT Payable</td>
                  <td className="py-3">-</td>
                  <td className="py-3">VAT amount</td>
                  <td className="py-3">VAT payable to FTA</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}