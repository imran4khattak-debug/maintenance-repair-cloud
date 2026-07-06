export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-72 bg-slate-950 text-white">
          <div className="border-b border-slate-800 px-6 py-5">
            <h1 className="text-lg font-bold">Maintenance Repair App</h1>
            <p className="mt-1 text-sm text-slate-400">
              Property Maintenance & Repairs
            </p>
          </div>

          <nav className="space-y-1 px-4 py-5 text-sm">
            <a className="block rounded-lg bg-slate-800 px-4 py-3 font-medium">
              Dashboard
            </a>
            <a className="block rounded-lg px-4 py-3 text-slate-300 hover:bg-slate-800">
              Company Setup
            </a>
            <a className="block rounded-lg px-4 py-3 text-slate-300 hover:bg-slate-800">
              Chart of Accounts
            </a>
            <a className="block rounded-lg px-4 py-3 text-slate-300 hover:bg-slate-800">
              Customers
            </a>
            <a className="block rounded-lg px-4 py-3 text-slate-300 hover:bg-slate-800">
              Suppliers
            </a>
            <a className="block rounded-lg px-4 py-3 text-slate-300 hover:bg-slate-800">
              Items & Services
            </a>
            <a className="block rounded-lg px-4 py-3 text-slate-300 hover:bg-slate-800">
              Maintenance Jobs
            </a>
            <a className="block rounded-lg px-4 py-3 text-slate-300 hover:bg-slate-800">
              Quotations
            </a>
            <a className="block rounded-lg px-4 py-3 text-slate-300 hover:bg-slate-800">
              Sales / Tax Invoices
            </a>
            <a className="block rounded-lg px-4 py-3 text-slate-300 hover:bg-slate-800">
              Vouchers
            </a>
            <a className="block rounded-lg px-4 py-3 text-slate-300 hover:bg-slate-800">
              VAT Module
            </a>
            <a className="block rounded-lg px-4 py-3 text-slate-300 hover:bg-slate-800">
              Reports
            </a>
          </nav>
        </aside>

        <section className="flex-1">
          <header className="border-b border-slate-200 bg-white px-8 py-5">
            <h2 className="text-2xl font-bold">
              Maintenance & Repair Dashboard
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage jobs, quotations, invoices, vouchers, VAT and reports.
            </p>
          </header>

          <div className="p-8">
            <div className="grid gap-6 md:grid-cols-4">
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500">Open Jobs</p>
                <p className="mt-3 text-3xl font-bold">0</p>
              </div>

              <div className="rounded-xl bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500">Pending Quotations</p>
                <p className="mt-3 text-3xl font-bold">0</p>
              </div>

              <div className="rounded-xl bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500">Customer Balance</p>
                <p className="mt-3 text-3xl font-bold">0.00</p>
              </div>

              <div className="rounded-xl bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500">VAT Payable</p>
                <p className="mt-3 text-3xl font-bold">0.00</p>
              </div>
            </div>

            <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold">Project Status</h3>
              <p className="mt-2 text-slate-600">
                Database is connected and initial migration is completed. Next
                step is to create professional pages for company setup, chart of
                accounts, customers, suppliers, and items/services.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}