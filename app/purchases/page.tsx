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
  if (vatCode === "STD5") return 0.05;
  return 0;
}

async function createSupplierBill(formData: FormData) {
  "use server";

  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const expenseAccountId = String(formData.get("expenseAccountId") ?? "").trim();
  const amountBeforeVat = cleanNumber(formData.get("amountBeforeVat"));
  const vatCode = String(formData.get("vatCode") || "STD5");
  const voucherDate = cleanDate(formData.get("voucherDate"));
  const narration = cleanText(formData.get("narration"));

  if (!supplierId) {
    throw new Error("Supplier is required.");
  }

  if (!expenseAccountId) {
    throw new Error("Expense account is required.");
  }

  if (amountBeforeVat <= 0) {
    throw new Error("Amount before VAT must be greater than zero.");
  }

  const inputVatAccount = await prisma.account.findUnique({
    where: { code: "1160" },
  });

  const supplierPayableAccount = await prisma.account.findUnique({
    where: { code: "2110" },
  });

  if (!inputVatAccount) {
    throw new Error(
      "Input VAT account 1160 is missing. Go to Chart of Accounts and click Seed Default COA."
    );
  }

  if (!supplierPayableAccount) {
    throw new Error(
      "Accounts Payable account 2110 is missing. Go to Chart of Accounts and click Seed Default COA."
    );
  }

  const vatRate = vatRateFromCode(vatCode);
  const vatAmount = Number((amountBeforeVat * vatRate).toFixed(2));
  const totalAmount = Number((amountBeforeVat + vatAmount).toFixed(2));

  const count = await prisma.voucher.count({
    where: { voucherType: "SUPPLIER_BILL" },
  });

  const voucherNo = `PB-${String(count + 1).padStart(5, "0")}`;

  await prisma.voucher.create({
    data: {
      voucherNo,
      voucherType: "SUPPLIER_BILL",
      voucherDate,
      partyType: "SUPPLIER",
      supplierId,
      narration,
      totalDebit: totalAmount,
      totalCredit: totalAmount,
      status: "POSTED",
      lines: {
        create: [
          {
            accountId: expenseAccountId,
            description: narration || "Supplier bill expense",
            debit: amountBeforeVat,
            credit: 0,
            vatCode,
            vatAmount,
          },
          ...(vatAmount > 0
            ? [
                {
                  accountId: inputVatAccount.id,
                  description: "Input VAT recoverable",
                  debit: vatAmount,
                  credit: 0,
                  vatCode,
                  vatAmount,
                },
              ]
            : []),
          {
            accountId: supplierPayableAccount.id,
            description: "Accounts payable - supplier",
            debit: 0,
            credit: totalAmount,
            vatCode,
            vatAmount,
          },
        ],
      },
    },
  });

  revalidatePath("/purchases");
}

export default async function PurchasesPage() {
  const today = new Date().toISOString().slice(0, 10);

  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const expenseAccounts = await prisma.account.findMany({
    where: {
      type: "EXPENSE",
      isPosting: true,
      isActive: true,
    },
    orderBy: { code: "asc" },
  });

  const inputVatAccount = await prisma.account.findUnique({
    where: { code: "1160" },
  });

  const supplierPayableAccount = await prisma.account.findUnique({
    where: { code: "2110" },
  });

  const bills = await prisma.voucher.findMany({
    where: { voucherType: "SUPPLIER_BILL" },
    orderBy: { voucherDate: "desc" },
    include: {
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

  const totalBills = bills.reduce(
    (sum, bill) => sum + Number(bill.totalCredit),
    0
  );

  const totalInputVat = bills.reduce((sum, bill) => {
    const inputVatLines = bill.lines.filter(
      (line) => line.account.code === "1160"
    );

    return (
      sum +
      inputVatLines.reduce((lineSum, line) => lineSum + Number(line.debit), 0)
    );
  }, 0);

  const totalNetPurchase = totalBills - totalInputVat;

  const setupReady =
    suppliers.length > 0 &&
    expenseAccounts.length > 0 &&
    inputVatAccount &&
    supplierPayableAccount;

  return (
    <>
      <PageHeader
        title="Purchases / Supplier Bills"
        subtitle="Post supplier bills with expense, input VAT and accounts payable entries."
      />

      <div className="space-y-6 p-8">
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <p className="text-sm text-slate-500">Total Bills</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {bills.length}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Net Purchase</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(totalNetPurchase)}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Input VAT</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(totalInputVat)}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Supplier Payable</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(totalBills)}
            </p>
          </Card>
        </div>

        {!setupReady ? (
          <Card className="border-amber-200 bg-amber-50">
            <h2 className="text-lg font-semibold text-amber-900">
              Required setup before supplier bill
            </h2>

            <div className="mt-3 grid gap-2 text-sm text-amber-800 md:grid-cols-2">
              <p>Supplier created: {suppliers.length > 0 ? "Yes" : "No"}</p>
              <p>
                Expense account available:{" "}
                {expenseAccounts.length > 0 ? "Yes" : "No"}
              </p>
              <p>
                Input VAT account 1160 exists:{" "}
                {inputVatAccount ? "Yes" : "No"}
              </p>
              <p>
                Supplier payable account 2110 exists:{" "}
                {supplierPayableAccount ? "Yes" : "No"}
              </p>
            </div>
          </Card>
        ) : null}

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            Create Supplier Bill
          </h2>

          <form
            action={createSupplierBill}
            className="mt-5 grid gap-5 md:grid-cols-5"
          >
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
              <Label>Expense Account</Label>
              <Select name="expenseAccountId" required>
                <option value="">Select Expense Account</option>
                {expenseAccounts.map((account) => (
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

            <div className="md:col-span-4">
              <Label>Description / Supplier Invoice Ref</Label>
              <Input
                name="narration"
                placeholder="Example: Supplier invoice no, job ref, material purchase"
              />
            </div>

            <div className="flex items-end">
              <Button type="submit">Create Supplier Bill</Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            Supplier Bills List
          </h2>

          <div className="mt-5 overflow-x-auto rounded-lg">
            <table className="min-w-[1100px] w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2">Bill No</th>
                  <th className="py-2">Date</th>
                  <th className="py-2">Supplier</th>
                  <th className="py-2">Narration</th>
                  <th className="py-2 text-right">Net</th>
                  <th className="py-2 text-right">Input VAT</th>
                  <th className="py-2 pr-6 text-right whitespace-nowrap">Total</th>
                  <th className="py-2 pl-6 whitespace-nowrap">Status</th>                  
                </tr>
              </thead>

              <tbody>
                {bills.map((bill) => {
                  const inputVat = bill.lines
                    .filter((line) => line.account.code === "1160")
                    .reduce((sum, line) => sum + Number(line.debit), 0);

                  const net = Number(bill.totalCredit) - inputVat;

                  return (
                    <tr key={bill.id} className="border-b last:border-0">
                      <td className="py-3 font-mono">{bill.voucherNo}</td>
                      <td className="py-3">
                        {bill.voucherDate.toISOString().slice(0, 10)}
                      </td>
                      <td className="py-3 font-medium text-slate-900">
                        {bill.supplier?.name || "-"}
                      </td>
                      <td className="py-3">{bill.narration || "-"}</td>
                      <td className="py-3 text-right">{money(net)}</td>
                      <td className="py-3 text-right">{money(inputVat)}</td>
                      <td className="py-3 text-right font-semibold">
                        {money(bill.totalCredit)}
                      </td>
                      <td className="py-3">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {bill.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {bills.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No supplier bills found. Create your first supplier bill
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

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
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
                  <td className="py-3">Selected Expense Account</td>
                  <td className="py-3">Amount before VAT</td>
                  <td className="py-3">-</td>
                  <td className="py-3">Material, subcontractor or expense cost</td>
                </tr>

                <tr className="border-b">
                  <td className="py-3">1160 - Input VAT Recoverable</td>
                  <td className="py-3">VAT amount</td>
                  <td className="py-3">-</td>
                  <td className="py-3">VAT recoverable from FTA</td>
                </tr>

                <tr>
                  <td className="py-3">2110 - Accounts Payable - Suppliers</td>
                  <td className="py-3">-</td>
                  <td className="py-3">Total bill amount</td>
                  <td className="py-3">Amount payable to supplier</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}