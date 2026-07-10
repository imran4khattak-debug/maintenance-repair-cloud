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

async function nextVoucherNo(voucherType: string, prefix: string) {
  const count = await prisma.voucher.count({
    where: {
      voucherType,
    },
  });

  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
}

async function createReceiptVoucher(formData: FormData) {
  "use server";

  const customerId = String(formData.get("customerId") ?? "").trim();
  const cashBankAccountId = String(formData.get("cashBankAccountId") ?? "").trim();
  const voucherDate = cleanDate(formData.get("voucherDate"));
  const amount = cleanNumber(formData.get("amount"));
  const narration = cleanText(formData.get("narration"));

  if (!customerId) {
    throw new Error("Customer is required.");
  }

  if (!cashBankAccountId) {
    throw new Error("Cash / Bank account is required.");
  }

  if (amount <= 0) {
    throw new Error("Receipt amount must be greater than zero.");
  }

  const receivableAccount = await prisma.account.findUnique({
    where: {
      code: "1130",
    },
  });

  if (!receivableAccount) {
    throw new Error(
      "Accounts Receivable account 1130 is missing. Go to Chart of Accounts and click Seed Default COA."
    );
  }

  const voucherNo = await nextVoucherNo("RECEIPT", "RV");

  await prisma.voucher.create({
    data: {
      voucherNo,
      voucherType: "RECEIPT",
      voucherDate,
      partyType: "CUSTOMER",
      customerId,
      narration,
      totalDebit: amount,
      totalCredit: amount,
      status: "POSTED",
      lines: {
        create: [
          {
            accountId: cashBankAccountId,
            description: narration || "Customer receipt",
            debit: amount,
            credit: 0,
          },
          {
            accountId: receivableAccount.id,
            description: "Accounts receivable - customer",
            debit: 0,
            credit: amount,
          },
        ],
      },
    },
  });

  revalidatePath("/vouchers");
}

async function createPaymentVoucher(formData: FormData) {
  "use server";

  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const cashBankAccountId = String(formData.get("cashBankAccountId") ?? "").trim();
  const voucherDate = cleanDate(formData.get("voucherDate"));
  const amount = cleanNumber(formData.get("amount"));
  const narration = cleanText(formData.get("narration"));

  if (!supplierId) {
    throw new Error("Supplier is required.");
  }

  if (!cashBankAccountId) {
    throw new Error("Cash / Bank account is required.");
  }

  if (amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const payableAccount = await prisma.account.findUnique({
    where: {
      code: "2110",
    },
  });

  if (!payableAccount) {
    throw new Error(
      "Accounts Payable account 2110 is missing. Go to Chart of Accounts and click Seed Default COA."
    );
  }

  const voucherNo = await nextVoucherNo("PAYMENT", "PV");

  await prisma.voucher.create({
    data: {
      voucherNo,
      voucherType: "PAYMENT",
      voucherDate,
      partyType: "SUPPLIER",
      supplierId,
      narration,
      totalDebit: amount,
      totalCredit: amount,
      status: "POSTED",
      lines: {
        create: [
          {
            accountId: payableAccount.id,
            description: "Accounts payable - supplier",
            debit: amount,
            credit: 0,
          },
          {
            accountId: cashBankAccountId,
            description: narration || "Supplier payment",
            debit: 0,
            credit: amount,
          },
        ],
      },
    },
  });

  revalidatePath("/vouchers");
}

async function createJournalVoucher(formData: FormData) {
  "use server";

  const debitAccountId = String(formData.get("debitAccountId") ?? "").trim();
  const creditAccountId = String(formData.get("creditAccountId") ?? "").trim();
  const voucherDate = cleanDate(formData.get("voucherDate"));
  const amount = cleanNumber(formData.get("amount"));
  const narration = cleanText(formData.get("narration"));

  if (!debitAccountId) {
    throw new Error("Debit account is required.");
  }

  if (!creditAccountId) {
    throw new Error("Credit account is required.");
  }

  if (debitAccountId === creditAccountId) {
    throw new Error("Debit and credit account cannot be the same.");
  }

  if (amount <= 0) {
    throw new Error("Journal amount must be greater than zero.");
  }

  const voucherNo = await nextVoucherNo("JOURNAL", "JV");

  await prisma.voucher.create({
    data: {
      voucherNo,
      voucherType: "JOURNAL",
      voucherDate,
      partyType: "JOURNAL",
      narration,
      totalDebit: amount,
      totalCredit: amount,
      status: "POSTED",
      lines: {
        create: [
          {
            accountId: debitAccountId,
            description: narration || "Journal debit",
            debit: amount,
            credit: 0,
          },
          {
            accountId: creditAccountId,
            description: narration || "Journal credit",
            debit: 0,
            credit: amount,
          },
        ],
      },
    },
  });

  revalidatePath("/vouchers");
}

export default async function VouchersPage() {
  const today = new Date().toISOString().slice(0, 10);

  const customers = await prisma.customer.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const suppliers = await prisma.supplier.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const accounts = await prisma.account.findMany({
    where: {
      isPosting: true,
      isActive: true,
    },
    orderBy: {
      code: "asc",
    },
  });

  const cashBankAccounts = accounts.filter(
    (account) => account.code === "1110" || account.code === "1120"
  );

  const receivableAccount = await prisma.account.findUnique({
    where: {
      code: "1130",
    },
  });

  const payableAccount = await prisma.account.findUnique({
    where: {
      code: "2110",
    },
  });

  const vouchers = await prisma.voucher.findMany({
    where: {
      voucherType: {
        in: ["RECEIPT", "PAYMENT", "JOURNAL"],
      },
    },
    orderBy: {
      voucherDate: "desc",
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

  const receiptTotal = vouchers
    .filter((voucher) => voucher.voucherType === "RECEIPT")
    .reduce((sum, voucher) => sum + Number(voucher.totalDebit), 0);

  const paymentTotal = vouchers
    .filter((voucher) => voucher.voucherType === "PAYMENT")
    .reduce((sum, voucher) => sum + Number(voucher.totalCredit), 0);

  const journalTotal = vouchers
    .filter((voucher) => voucher.voucherType === "JOURNAL")
    .reduce((sum, voucher) => sum + Number(voucher.totalDebit), 0);

  const cashBankNet = receiptTotal - paymentTotal;

  const setupReady =
    cashBankAccounts.length > 0 &&
    Boolean(receivableAccount) &&
    Boolean(payableAccount);

  return (
    <>
      <PageHeader
        title="Payment / Receipt / JV"
        subtitle="Create receipt, payment and journal vouchers with automatic double-entry posting."
      />

      <div className="space-y-6 p-8">
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <p className="text-sm text-slate-500">Receipts</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(receiptTotal)}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Payments</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(paymentTotal)}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Journal Amount</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(journalTotal)}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Cash / Bank Net</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(cashBankNet)}
            </p>
          </Card>
        </div>

        {!setupReady ? (
          <Card className="border-amber-200 bg-amber-50">
            <h2 className="text-lg font-semibold text-amber-900">
              Required setup before vouchers
            </h2>

            <div className="mt-3 grid gap-2 text-sm text-amber-800 md:grid-cols-2">
              <p>
                Cash / Bank account available:{" "}
                {cashBankAccounts.length > 0 ? "Yes" : "No"}
              </p>
              <p>
                Accounts receivable 1130 exists:{" "}
                {receivableAccount ? "Yes" : "No"}
              </p>
              <p>
                Accounts payable 2110 exists: {payableAccount ? "Yes" : "No"}
              </p>
              <p>
                Customers / Suppliers can be added from their master pages.
              </p>
            </div>
          </Card>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-3">
          <Card>
            <h2 className="text-lg font-semibold text-slate-900">
              Receipt Voucher
            </h2>

            <form action={createReceiptVoucher} className="mt-5 space-y-4">
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
                <Label>Received In</Label>
                <Select name="cashBankAccountId" required>
                  <option value="">Select Cash / Bank</option>
                  {cashBankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label>Amount</Label>
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue="0"
                />
              </div>

              <div>
                <Label>Narration</Label>
                <Input
                  name="narration"
                  placeholder="Receipt against invoice or customer payment"
                />
              </div>

              <Button type="submit">Create Receipt</Button>
            </form>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-900">
              Payment Voucher
            </h2>

            <form action={createPaymentVoucher} className="mt-5 space-y-4">
              <div>
                <Label>Date</Label>
                <Input name="voucherDate" type="date" defaultValue={today} />
              </div>

              <div>
                <Label>Supplier</Label>
                <Select name="supplierId" required>
                  <option value="">Select Supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label>Paid From</Label>
                <Select name="cashBankAccountId" required>
                  <option value="">Select Cash / Bank</option>
                  {cashBankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label>Amount</Label>
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue="0"
                />
              </div>

              <div>
                <Label>Narration</Label>
                <Input
                  name="narration"
                  placeholder="Payment against supplier bill"
                />
              </div>

              <Button type="submit">Create Payment</Button>
            </form>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-900">
              Journal Voucher
            </h2>

            <form action={createJournalVoucher} className="mt-5 space-y-4">
              <div>
                <Label>Date</Label>
                <Input name="voucherDate" type="date" defaultValue={today} />
              </div>

              <div>
                <Label>Debit Account</Label>
                <Select name="debitAccountId" required>
                  <option value="">Select Debit Account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label>Credit Account</Label>
                <Select name="creditAccountId" required>
                  <option value="">Select Credit Account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label>Amount</Label>
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue="0"
                />
              </div>

              <div>
                <Label>Narration</Label>
                <Input
                  name="narration"
                  placeholder="Adjustment or journal narration"
                />
              </div>

              <Button type="submit">Create JV</Button>
            </form>
          </Card>
        </div>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            Vouchers List
          </h2>

          <div className="mt-5 overflow-x-auto rounded-lg">
            <table className="min-w-[1100px] w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2 whitespace-nowrap">Voucher No</th>
                  <th className="py-2 whitespace-nowrap">Date</th>
                  <th className="py-2 whitespace-nowrap">Type</th>
                  <th className="py-2 whitespace-nowrap">Party</th>
                  <th className="py-2 whitespace-nowrap">Narration</th>
                  <th className="py-2 text-right whitespace-nowrap">Debit</th>
                  <th className="py-2 text-right whitespace-nowrap">Credit</th>
                  <th className="py-2 pl-6 whitespace-nowrap">Status</th>
                </tr>
              </thead>

              <tbody>
                {vouchers.map((voucher) => {
                  const partyName =
                    voucher.customer?.name ||
                    voucher.supplier?.name ||
                    voucher.partyType ||
                    "-";

                  return (
                    <tr key={voucher.id} className="border-b last:border-0">
                      <td className="py-3 font-mono">{voucher.voucherNo}</td>
                      <td className="py-3">
                        {voucher.voucherDate.toISOString().slice(0, 10)}
                      </td>
                      <td className="py-3">{voucher.voucherType}</td>
                      <td className="py-3 font-medium text-slate-900">
                        {partyName}
                      </td>
                      <td className="py-3">{voucher.narration || "-"}</td>
                      <td className="py-3 text-right">
                        {money(voucher.totalDebit)}
                      </td>
                      <td className="py-3 text-right">
                        {money(voucher.totalCredit)}
                      </td>
                      <td className="py-3 pl-6">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {voucher.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {vouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No vouchers found. Create receipt, payment or JV above.
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
            <table className="min-w-[950px] w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2">Voucher</th>
                  <th className="py-2">Debit</th>
                  <th className="py-2">Credit</th>
                </tr>
              </thead>

              <tbody>
                <tr className="border-b">
                  <td className="py-3 font-medium">Receipt Voucher</td>
                  <td className="py-3">Cash / Bank</td>
                  <td className="py-3">1130 - Accounts Receivable</td>
                </tr>

                <tr className="border-b">
                  <td className="py-3 font-medium">Payment Voucher</td>
                  <td className="py-3">2110 - Accounts Payable</td>
                  <td className="py-3">Cash / Bank</td>
                </tr>

                <tr>
                  <td className="py-3 font-medium">Journal Voucher</td>
                  <td className="py-3">Selected debit account</td>
                  <td className="py-3">Selected credit account</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}