import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { prisma } from "@/lib/prisma";

function money(value: unknown) {
  return Number(value || 0).toFixed(2);
}

function localDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function debitBalance(balance: number) {
  return balance > 0 ? balance : 0;
}

function creditBalance(balance: number) {
  return balance < 0 ? Math.abs(balance) : 0;
}

export default async function ReportsPage() {
  const accounts = await prisma.account.findMany({
    orderBy: {
      code: "asc",
    },
    include: {
      voucherLines: {
        where: {
          voucher: {
            status: "POSTED",
          },
        },
      },
    },
  });

  const vouchers = await prisma.voucher.findMany({
    where: {
      status: "POSTED",
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

  const customers = await prisma.customer.findMany({
    orderBy: {
      name: "asc",
    },
  });

  const suppliers = await prisma.supplier.findMany({
    orderBy: {
      name: "asc",
    },
  });

  const accountSummaries = accounts.map((account) => {
    const lineDebit = account.voucherLines.reduce(
      (sum, line) => sum + Number(line.debit),
      0
    );

    const lineCredit = account.voucherLines.reduce(
      (sum, line) => sum + Number(line.credit),
      0
    );

    const debit = Number(account.openingDebit) + lineDebit;
    const credit = Number(account.openingCredit) + lineCredit;
    const balance = debit - credit;

    return {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      isPosting: account.isPosting,
      debit,
      credit,
      balance,
      debitBalance: debitBalance(balance),
      creditBalance: creditBalance(balance),
    };
  });

  const postingSummaries = accountSummaries.filter(
    (account) => account.isPosting
  );

  const totalTrialDebit = postingSummaries.reduce(
    (sum, account) => sum + account.debitBalance,
    0
  );

  const totalTrialCredit = postingSummaries.reduce(
    (sum, account) => sum + account.creditBalance,
    0
  );

  const totalIncome = postingSummaries
    .filter((account) => account.type === "INCOME")
    .reduce((sum, account) => sum + account.credit - account.debit, 0);

  const totalExpense = postingSummaries
    .filter((account) => account.type === "EXPENSE")
    .reduce((sum, account) => sum + account.debit - account.credit, 0);

  const netProfit = totalIncome - totalExpense;

  const totalAssets = postingSummaries
    .filter((account) => account.type === "ASSET")
    .reduce((sum, account) => sum + account.debitBalance, 0);

  const totalLiabilities = postingSummaries
    .filter((account) => account.type === "LIABILITY")
    .reduce((sum, account) => sum + account.creditBalance, 0);

  const totalEquity = postingSummaries
    .filter((account) => account.type === "EQUITY")
    .reduce((sum, account) => sum + account.creditBalance, 0);

  const cashBankBalance = postingSummaries
    .filter((account) => account.code === "1110" || account.code === "1120")
    .reduce((sum, account) => sum + account.balance, 0);

  const customerReceivable = postingSummaries
    .filter((account) => account.code === "1130")
    .reduce((sum, account) => sum + account.debitBalance, 0);

  const supplierPayable = postingSummaries
    .filter((account) => account.code === "2110")
    .reduce((sum, account) => sum + account.creditBalance, 0);

  const inputVat = postingSummaries
    .filter((account) => account.code === "1160")
    .reduce((sum, account) => sum + account.debitBalance, 0);

  const outputVat = postingSummaries
    .filter((account) => account.code === "2130")
    .reduce((sum, account) => sum + account.creditBalance, 0);

  const vatPayable = Math.max(outputVat - inputVat, 0);
  const vatRefundable = Math.max(inputVat - outputVat, 0);

  const customerBalances = customers.map((customer) => {
    const customerVouchers = vouchers.filter(
      (voucher) => voucher.customerId === customer.id
    );

    const invoices = customerVouchers
      .filter((voucher) => voucher.voucherType === "SALES_INVOICE")
      .reduce((sum, voucher) => sum + Number(voucher.totalDebit), 0);

    const receipts = customerVouchers
      .filter((voucher) => voucher.voucherType === "RECEIPT")
      .reduce((sum, voucher) => sum + Number(voucher.totalCredit), 0);

    const balance = Number(customer.openingBalance) + invoices - receipts;

    return {
      id: customer.id,
      name: customer.name,
      mobile: customer.mobile,
      email: customer.email,
      openingBalance: Number(customer.openingBalance),
      invoices,
      receipts,
      balance,
    };
  });

  const supplierBalances = suppliers.map((supplier) => {
    const supplierVouchers = vouchers.filter(
      (voucher) => voucher.supplierId === supplier.id
    );

    const bills = supplierVouchers
      .filter((voucher) => voucher.voucherType === "SUPPLIER_BILL")
      .reduce((sum, voucher) => sum + Number(voucher.totalCredit), 0);

    const payments = supplierVouchers
      .filter((voucher) => voucher.voucherType === "PAYMENT")
      .reduce((sum, voucher) => sum + Number(voucher.totalDebit), 0);

    const balance = Number(supplier.openingBalance) + bills - payments;

    return {
      id: supplier.id,
      name: supplier.name,
      mobile: supplier.mobile,
      email: supplier.email,
      openingBalance: Number(supplier.openingBalance),
      bills,
      payments,
      balance,
    };
  });

  const recentVouchers = vouchers.slice(0, 25);

  const voucherTotals = vouchers.reduce(
    (totals, voucher) => {
      totals.debit += Number(voucher.totalDebit);
      totals.credit += Number(voucher.totalCredit);
      return totals;
    },
    {
      debit: 0,
      credit: 0,
    }
  );

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Financial, VAT, customer, supplier and accounting reports."
      />

      <div className="space-y-6 p-8">
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <p className="text-sm text-slate-500">Cash / Bank</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(cashBankBalance)}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Customer Receivable</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(customerReceivable)}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Supplier Payable</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(supplierPayable)}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Net Profit / Loss</p>
            <p
              className={`mt-3 text-3xl font-bold ${
                netProfit >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {money(netProfit)}
            </p>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <p className="text-sm text-slate-500">Total Income</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(totalIncome)}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Total Expense</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(totalExpense)}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Input VAT</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(inputVat)}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Output VAT</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {money(outputVat)}
            </p>
          </Card>
        </div>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            Trial Balance
          </h2>

          <div className="mt-5 overflow-x-auto rounded-lg">
            <table className="min-w-[1050px] w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2 whitespace-nowrap">Code</th>
                  <th className="py-2 whitespace-nowrap">Account</th>
                  <th className="py-2 whitespace-nowrap">Type</th>
                  <th className="py-2 text-right whitespace-nowrap">Debit</th>
                  <th className="py-2 text-right whitespace-nowrap">Credit</th>
                </tr>
              </thead>

              <tbody>
                {postingSummaries.map((account) => (
                  <tr key={account.id} className="border-b last:border-0">
                    <td className="py-3 font-mono">{account.code}</td>
                    <td className="py-3 font-medium text-slate-900">
                      {account.name}
                    </td>
                    <td className="py-3">{account.type}</td>
                    <td className="py-3 text-right">
                      {money(account.debitBalance)}
                    </td>
                    <td className="py-3 text-right">
                      {money(account.creditBalance)}
                    </td>
                  </tr>
                ))}

                <tr className="border-t bg-slate-50 font-bold">
                  <td className="py-3" colSpan={3}>
                    Total
                  </td>
                  <td className="py-3 text-right">{money(totalTrialDebit)}</td>
                  <td className="py-3 text-right">{money(totalTrialCredit)}</td>
                </tr>

                <tr>
                  <td colSpan={5} className="py-3 text-right text-sm">
                    Status:{" "}
                    <span
                      className={
                        Math.abs(totalTrialDebit - totalTrialCredit) < 0.01
                          ? "font-bold text-emerald-700"
                          : "font-bold text-red-700"
                      }
                    >
                      {Math.abs(totalTrialDebit - totalTrialCredit) < 0.01
                        ? "Balanced"
                        : "Not Balanced"}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-slate-900">
              Profit & Loss Summary
            </h2>

            <div className="mt-5 overflow-x-auto rounded-lg">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b">
                    <td className="py-3 font-medium">Total Income</td>
                    <td className="py-3 text-right">{money(totalIncome)}</td>
                  </tr>

                  <tr className="border-b">
                    <td className="py-3 font-medium">Total Expense</td>
                    <td className="py-3 text-right">{money(totalExpense)}</td>
                  </tr>

                  <tr className="bg-slate-50 font-bold">
                    <td className="py-3">Net Profit / Loss</td>
                    <td
                      className={`py-3 text-right ${
                        netProfit >= 0 ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {money(netProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-900">
              Balance Sheet Summary
            </h2>

            <div className="mt-5 overflow-x-auto rounded-lg">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b">
                    <td className="py-3 font-medium">Assets</td>
                    <td className="py-3 text-right">{money(totalAssets)}</td>
                  </tr>

                  <tr className="border-b">
                    <td className="py-3 font-medium">Liabilities</td>
                    <td className="py-3 text-right">
                      {money(totalLiabilities)}
                    </td>
                  </tr>

                  <tr className="border-b">
                    <td className="py-3 font-medium">Equity</td>
                    <td className="py-3 text-right">{money(totalEquity)}</td>
                  </tr>

                  <tr className="border-b">
                    <td className="py-3 font-medium">Current Profit / Loss</td>
                    <td className="py-3 text-right">{money(netProfit)}</td>
                  </tr>

                  <tr className="bg-slate-50 font-bold">
                    <td className="py-3">Liability + Equity + Profit</td>
                    <td className="py-3 text-right">
                      {money(totalLiabilities + totalEquity + netProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">VAT Summary</h2>

          <div className="mt-5 overflow-x-auto rounded-lg">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="py-3 font-medium">Output VAT Payable</td>
                  <td className="py-3 text-right">{money(outputVat)}</td>
                </tr>

                <tr className="border-b">
                  <td className="py-3 font-medium">Input VAT Recoverable</td>
                  <td className="py-3 text-right">{money(inputVat)}</td>
                </tr>

                <tr className="border-b bg-slate-50 font-bold">
                  <td className="py-3">VAT Payable</td>
                  <td className="py-3 text-right">{money(vatPayable)}</td>
                </tr>

                <tr className="font-bold">
                  <td className="py-3">VAT Refundable / Carry Forward</td>
                  <td className="py-3 text-right">{money(vatRefundable)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-slate-900">
              Customer Balances
            </h2>

            <div className="mt-5 overflow-x-auto rounded-lg">
              <table className="min-w-[800px] w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2">Customer</th>
                    <th className="py-2 text-right">Opening</th>
                    <th className="py-2 text-right">Invoices</th>
                    <th className="py-2 text-right">Receipts</th>
                    <th className="py-2 text-right">Balance</th>
                  </tr>
                </thead>

                <tbody>
                  {customerBalances.map((customer) => (
                    <tr key={customer.id} className="border-b last:border-0">
                      <td className="py-3 font-medium text-slate-900">
                        {customer.name}
                        <div className="text-xs text-slate-500">
                          {customer.mobile || customer.email || "-"}
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        {money(customer.openingBalance)}
                      </td>
                      <td className="py-3 text-right">
                        {money(customer.invoices)}
                      </td>
                      <td className="py-3 text-right">
                        {money(customer.receipts)}
                      </td>
                      <td className="py-3 text-right font-semibold">
                        {money(customer.balance)}
                      </td>
                    </tr>
                  ))}

                  {customerBalances.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No customers found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-900">
              Supplier Balances
            </h2>

            <div className="mt-5 overflow-x-auto rounded-lg">
              <table className="min-w-[800px] w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2">Supplier</th>
                    <th className="py-2 text-right">Opening</th>
                    <th className="py-2 text-right">Bills</th>
                    <th className="py-2 text-right">Payments</th>
                    <th className="py-2 text-right">Balance</th>
                  </tr>
                </thead>

                <tbody>
                  {supplierBalances.map((supplier) => (
                    <tr key={supplier.id} className="border-b last:border-0">
                      <td className="py-3 font-medium text-slate-900">
                        {supplier.name}
                        <div className="text-xs text-slate-500">
                          {supplier.mobile || supplier.email || "-"}
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        {money(supplier.openingBalance)}
                      </td>
                      <td className="py-3 text-right">{money(supplier.bills)}</td>
                      <td className="py-3 text-right">
                        {money(supplier.payments)}
                      </td>
                      <td className="py-3 text-right font-semibold">
                        {money(supplier.balance)}
                      </td>
                    </tr>
                  ))}

                  {supplierBalances.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No suppliers found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            Day Book / Recent Vouchers
          </h2>

          <div className="mt-5 overflow-x-auto rounded-lg">
            <table className="min-w-[1150px] w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2 whitespace-nowrap">Date</th>
                  <th className="py-2 whitespace-nowrap">Voucher No</th>
                  <th className="py-2 whitespace-nowrap">Type</th>
                  <th className="py-2 whitespace-nowrap">Party</th>
                  <th className="py-2 whitespace-nowrap">Narration</th>
                  <th className="py-2 text-right whitespace-nowrap">Debit</th>
                  <th className="py-2 pr-6 text-right whitespace-nowrap">
                    Credit
                  </th>
                  <th className="py-2 pl-6 whitespace-nowrap">Status</th>
                </tr>
              </thead>

              <tbody>
                {recentVouchers.map((voucher) => {
                  const party =
                    voucher.customer?.name ||
                    voucher.supplier?.name ||
                    voucher.partyType ||
                    "-";

                  return (
                    <tr key={voucher.id} className="border-b last:border-0">
                      <td className="py-3">{localDate(voucher.voucherDate)}</td>
                      <td className="py-3 font-mono">{voucher.voucherNo}</td>
                      <td className="py-3">{voucher.voucherType}</td>
                      <td className="py-3 font-medium text-slate-900">
                        {party}
                      </td>
                      <td className="py-3">{voucher.narration || "-"}</td>
                      <td className="py-3 text-right">
                        {money(voucher.totalDebit)}
                      </td>
                      <td className="py-3 pr-6 text-right">
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

                {recentVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No posted vouchers found.
                    </td>
                  </tr>
                ) : null}

                {recentVouchers.length > 0 ? (
                  <tr className="border-t bg-slate-50 font-bold">
                    <td colSpan={5} className="py-3">
                      Posted Voucher Totals
                    </td>
                    <td className="py-3 text-right">
                      {money(voucherTotals.debit)}
                    </td>
                    <td className="py-3 pr-6 text-right">
                      {money(voucherTotals.credit)}
                    </td>
                    <td className="py-3 pl-6" />
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