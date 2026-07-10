import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

async function createAccount(formData: FormData) {
  "use server";

  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "ASSET");
  const parentId = String(formData.get("parentId") || "").trim();

  if (!code || !name) {
    return;
  }

  await prisma.account.create({
    data: {
      code,
      name,
      type,
      parentId: parentId || null,
      isPosting: formData.get("isPosting") === "on",
      openingDebit: Number(formData.get("openingDebit") || 0),
      openingCredit: Number(formData.get("openingCredit") || 0),
    },
  });

  revalidatePath("/accounts");
}

async function seedAccounts() {
  "use server";

  const parentAccounts = [
    { code: "1000", name: "Asset", type: "ASSET" },
    { code: "2000", name: "Liability", type: "LIABILITY" },
    { code: "3000", name: "Capital / Equity", type: "EQUITY" },
    { code: "4000", name: "Income", type: "INCOME" },
    { code: "5000", name: "Direct Cost", type: "EXPENSE" },
    { code: "6000", name: "Expense", type: "EXPENSE" },
  ];

  for (const account of parentAccounts) {
    await prisma.account.upsert({
      where: { code: account.code },
      update: {},
      create: {
        ...account,
        isPosting: false,
      },
    });
  }

  const parents = await prisma.account.findMany({
    where: {
      code: {
        in: parentAccounts.map((a) => a.code),
      },
    },
  });

  const parentMap = new Map(parents.map((a) => [a.code, a.id]));

  const childAccounts = [
    {
      code: "1110",
      name: "Cash in Hand",
      type: "ASSET",
      parentCode: "1000",
    },
    {
      code: "1120",
      name: "Bank Account",
      type: "ASSET",
      parentCode: "1000",
    },
    {
      code: "1130",
      name: "Accounts Receivable - Customers",
      type: "ASSET",
      parentCode: "1000",
    },
    {
      code: "1140",
      name: "Inventory / Spare Parts Stock",
      type: "ASSET",
      parentCode: "1000",
    },
    {
      code: "1160",
      name: "Input VAT Recoverable",
      type: "ASSET",
      parentCode: "1000",
    },
    {
      code: "2110",
      name: "Accounts Payable - Suppliers",
      type: "LIABILITY",
      parentCode: "2000",
    },
    {
      code: "2130",
      name: "Output VAT Payable",
      type: "LIABILITY",
      parentCode: "2000",
    },
    {
      code: "2140",
      name: "VAT Payable to FTA",
      type: "LIABILITY",
      parentCode: "2000",
    },
    {
      code: "3100",
      name: "Owner Capital",
      type: "EQUITY",
      parentCode: "3000",
    },
    {
      code: "4100",
      name: "Maintenance Service Income",
      type: "INCOME",
      parentCode: "4000",
    },
    {
      code: "4110",
      name: "Repair Service Income",
      type: "INCOME",
      parentCode: "4000",
    },
    {
      code: "4120",
      name: "AMC Contract Income",
      type: "INCOME",
      parentCode: "4000",
    },
    {
      code: "4130",
      name: "Spare Parts Sales Income",
      type: "INCOME",
      parentCode: "4000",
    },
    {
      code: "5100",
      name: "Material Consumed",
      type: "EXPENSE",
      parentCode: "5000",
    },
    {
      code: "5120",
      name: "Subcontractor Cost",
      type: "EXPENSE",
      parentCode: "5000",
    },
    {
      code: "6100",
      name: "Salaries & Wages",
      type: "EXPENSE",
      parentCode: "6000",
    },
    {
      code: "6130",
      name: "Vehicle Fuel",
      type: "EXPENSE",
      parentCode: "6000",
    },
    {
      code: "6200",
      name: "Bank Charges",
      type: "EXPENSE",
      parentCode: "6000",
    },
  ];

  for (const account of childAccounts) {
    await prisma.account.upsert({
      where: { code: account.code },
      update: {},
      create: {
        code: account.code,
        name: account.name,
        type: account.type,
        parentId: parentMap.get(account.parentCode) || null,
        isPosting: true,
      },
    });
  }

  revalidatePath("/accounts");
}

export default async function AccountsPage() {
  const accounts = await prisma.account.findMany({
    orderBy: {
      code: "asc",
    },
    include: {
      parent: true,
    },
  });

  const parents = accounts.filter((account) => !account.parentId);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Chart of Accounts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create parent and child ledger accounts for accounting, VAT, customers,
          suppliers, income and expenses.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Add Account</h2>

        <form action={createAccount} className="mt-5 grid gap-4 md:grid-cols-6">
          <div>
            <label className="text-sm font-medium text-slate-700">Code</label>
            <input
              name="code"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Name</label>
            <input
              name="name"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Type</label>
            <select
              name="type"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="ASSET">Asset</option>
              <option value="LIABILITY">Liability</option>
              <option value="EQUITY">Capital / Equity</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Parent</label>
            <select
              name="parentId"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="">No Parent</option>
              {parents.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <input name="isPosting" type="checkbox" defaultChecked />
            <span className="pb-2 text-sm text-slate-700">Posting</span>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Opening Debit
            </label>
            <input
              name="openingDebit"
              type="number"
              step="0.01"
              defaultValue="0"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Opening Credit
            </label>
            <input
              name="openingCredit"
              type="number"
              step="0.01"
              defaultValue="0"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>

          <div className="flex items-end md:col-span-4">
            <button
              type="submit"
              className="rounded-lg bg-slate-950 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Add Account
            </button>
          </div>
        </form>

        <form action={seedAccounts} className="mt-4">
          <button
            type="submit"
            className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            Seed Default COA
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Accounts List</h2>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2">Code</th>
                <th className="py-2">Name</th>
                <th className="py-2">Type</th>
                <th className="py-2">Parent</th>
                <th className="py-2">Posting</th>
                <th className="py-2 text-right">Opening Debit</th>
                <th className="py-2 text-right">Opening Credit</th>
              </tr>
            </thead>

            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-b last:border-0">
                  <td className="py-3 font-mono">{account.code}</td>
                  <td className="py-3 font-medium">{account.name}</td>
                  <td className="py-3">{account.type}</td>
                  <td className="py-3">
                    {account.parent
                      ? `${account.parent.code} - ${account.parent.name}`
                      : "-"}
                  </td>
                  <td className="py-3">{account.isPosting ? "Yes" : "No"}</td>
                  <td className="py-3 text-right">
                    {Number(account.openingDebit).toFixed(2)}
                  </td>
                  <td className="py-3 text-right">
                    {Number(account.openingCredit).toFixed(2)}
                  </td>
                </tr>
              ))}

              {accounts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No accounts found. Click Seed Default COA to create the
                    standard chart of accounts.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}