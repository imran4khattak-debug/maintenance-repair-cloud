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

function formatMoney(value: unknown) {
  return Number(value || 0).toFixed(2);
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
    where: {
      code: "1160",
    },
  });

  const supplierPayableAccount = await prisma.account.findUnique({
    where: {
      code: "2110",
    },
  });

  if (!inputVatAccount) {
    throw new Error("Input VAT account 1160 is missing. Seed Chart of Accounts first.");
  }

  if (!supplierPayableAccount) {
    throw new Error("Accounts Payable account 2110 is missing. Seed Chart of Accounts first.");
  }

  const vatAmount = vatCode === "STD5" ? amountBeforeVat * 0.05 : 0;
  const totalAmount = amountBeforeVat + vatAmount;

  const count = await prisma.voucher.count({
    where: {
      voucherType: "SUPPLIER_BILL",
    },
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
            description: "Supplier payable",
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
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const expenseAccounts = await prisma.account.findMany({
    where: {
      type: "EXPENSE",
      isPosting: true,
      isActive: true,
    },
    orderBy: {
      code: "asc",
    },
  });

  const bills = await prisma.voucher.findMany({
    where: {
      voucherType: "SUPPLIER_BILL",
    },
    orderBy: {
      voucherDate: "desc",
    },
    include: {
      supplier: true,
      lines: {
        include: {
          account: true,
        },
      },
    },
  });

  const totalBills = bills.reduce(
    (sum, bill) => sum + Number(bill.totalCredit),
    0
  );

  const totalInputVat = bills.reduce((sum, bill) => {
    const vatLines = bill.lines.filter((line) => line.account.code === "1160");
    return (
      sum + vatLines.reduce((lineSum, line) => lineSum + Number(line.debit), 0)
    );
  }, 0);

  const unpaidSupplierPayable = bills.reduce(
    (sum, bill) => sum + Number(bill.totalCredit),
    0
  );

  return (
    <>
      <PageHeader
        title="Purchases / Supplier Bills"
        subtitle="Post supplier bills with input VAT and automatic accounts payable entry."
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
            <p className="text-sm text-slate-500">Purchase Total</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {totalBills.toFixed(2)}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Input VAT</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {totalInputVat.toFixed(2)}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Supplier Payable</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {unpaidSupplierPayable.toFixed(2)}
            </p>
          </Card>
        </div>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            Create Supplier Bill
          </h2>

          <form action={createSupplierBill} className="mt-5 grid gap-5 md:grid-cols-5">
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
              <Label>Description</Label>
              <Input
                name="narration"
                placeholder="Bill description, invoice number or job reference"
              />
            </div>

            <div className="flex items-end">
              <Button type="submit">Create Supplier Bill</Button>
            </div>
          </form>

          {suppliers.length === 0 ? (
            <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No active suppliers found. Add supplier first from Suppliers page.
            </p>
          ) : null}

          {expenseAccounts.length === 0 ? (
            <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No expense accounts found. Go to Chart of Accounts and seed default COA first.
            </p>
          ) : null}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            Supplier Bills List
          </h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2">Bill No</th>
                  <th className="py-2">Date</th>
                  <th className="py-2">Supplier</th>
                  <th className="py-2">Narration</th>
                  <th className="py-2 text-right">Net</th>
                  <th className="py-2 text-right">Input VAT</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>

              <tbody>
                {bills.map((bill) => {
                  const vatLineTotal = bill.lines
                    .filter((line) => line.account.code === "1160")
                    .reduce((sum, line) => sum + Number(line.debit), 0);

                  const netAmount = Number(bill.totalCredit) - vatLineTotal;

                  return (
                    <tr key={bill.id} className="border-b last:border-0">
                      <td className="py-3 font-mono">{bill.voucherNo}</td>
                      <td className="py-3">
                        {bill.voucherDate.toISOString().slice(0, 10)}
                      </td>
                      <td className="py-3 font-medium">
                        {bill.supplier?.name || "-"}
                      </td>
                      <td className="py-3">{bill.narration || "-"}</td>
                      <td className="py-3 text-right">
                        {formatMoney(netAmount)}
                      </td>
                      <td className="py-3 text-right">
                        {formatMoney(vatLineTotal)}
                      </td>
                      <td className="py-3 text-right font-semibold">
                        {formatMoney(bill.totalCredit)}
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
                      No supplier bills found. Create your first bill above.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}