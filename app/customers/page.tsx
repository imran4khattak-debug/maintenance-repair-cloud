import { revalidatePath } from "next/cache";
import PageHeader from "@/components/PageHeader";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/Card";
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

async function createCustomer(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    throw new Error("Customer name is required.");
  }

  await prisma.customer.create({
    data: {
      customerType: String(formData.get("customerType") || "COMPANY"),
      name,
      licenseNumber: cleanText(formData.get("licenseNumber")),
      mobile: cleanText(formData.get("mobile")),
      email: cleanText(formData.get("email")),
      trnNumber: cleanText(formData.get("trnNumber")),
      vatRegistered: formData.get("vatRegistered") === "on",
      paymentTerms: cleanText(formData.get("paymentTerms")),
      openingBalance: cleanNumber(formData.get("openingBalance")),
      address: cleanText(formData.get("address")),
      isActive: true,
    },
  });

  revalidatePath("/customers");
}

async function toggleCustomerStatus(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("isActive")) === "true";

  if (!id) {
    return;
  }

  await prisma.customer.update({
    where: { id },
    data: {
      isActive: !isActive,
    },
  });

  revalidatePath("/customers");
}

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  const activeCustomers = customers.filter((customer) => customer.isActive);
  const inactiveCustomers = customers.filter((customer) => !customer.isActive);
  const totalOpeningBalance = customers.reduce(
    (sum, customer) => sum + Number(customer.openingBalance),
    0
  );

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Manage company and individual customers for jobs, quotations, invoices and receipts."
      />

      <div className="space-y-6 p-8">
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <p className="text-sm text-slate-500">Total Customers</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {customers.length}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Active Customers</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {activeCustomers.length}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Opening Balance</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {totalOpeningBalance.toFixed(2)}
            </p>
          </Card>
        </div>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            Add New Customer
          </h2>

          <form action={createCustomer} className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <Label>Customer Type</Label>
              <Select name="customerType" defaultValue="COMPANY">
                <option value="COMPANY">Company</option>
                <option value="INDIVIDUAL">Individual</option>
              </Select>
            </div>

            <div>
              <Label>Customer Name</Label>
              <Input
                name="name"
                required
                placeholder="Company or individual name"
              />
            </div>

            <div>
              <Label>License Number</Label>
              <Input name="licenseNumber" placeholder="For commercial customer" />
            </div>

            <div>
              <Label>Mobile Number</Label>
              <Input name="mobile" placeholder="Mobile number" />
            </div>

            <div>
              <Label>Email ID</Label>
              <Input name="email" type="email" placeholder="customer@email.com" />
            </div>

            <div>
              <Label>TRN Number</Label>
              <Input name="trnNumber" placeholder="Tax Registration Number" />
            </div>

            <div>
              <Label>Payment Terms</Label>
              <Select name="paymentTerms" defaultValue="IMMEDIATE">
                <option value="IMMEDIATE">Immediate</option>
                <option value="7 DAYS">7 Days</option>
                <option value="15 DAYS">15 Days</option>
                <option value="30 DAYS">30 Days</option>
                <option value="CUSTOM">Custom</option>
              </Select>
            </div>

            <div>
              <Label>Opening Balance</Label>
              <Input
                name="openingBalance"
                type="number"
                step="0.01"
                defaultValue="0"
              />
            </div>

            <div className="flex items-end gap-3 pb-2">
              <input
                id="vatRegistered"
                name="vatRegistered"
                type="checkbox"
                className="h-4 w-4"
              />
              <label
                htmlFor="vatRegistered"
                className="text-sm font-medium text-slate-700"
              >
                VAT Registered
              </label>
            </div>

            <div className="md:col-span-2">
              <Label>Address / Site Location</Label>
              <Textarea
                name="address"
                rows={3}
                placeholder="Customer address or work site location"
              />
            </div>

            <div className="md:col-span-2">
              <Button type="submit">Save Customer</Button>
            </div>
          </form>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Customers List
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Active: {activeCustomers.length} | Inactive:{" "}
                {inactiveCustomers.length}
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2">Name</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Mobile</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">TRN</th>
                  <th className="py-2">VAT</th>
                  <th className="py-2 text-right">Opening Balance</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b last:border-0">
                    <td className="py-3 font-medium text-slate-900">
                      {customer.name}
                      {customer.licenseNumber ? (
                        <div className="text-xs text-slate-500">
                          License: {customer.licenseNumber}
                        </div>
                      ) : null}
                    </td>

                    <td className="py-3">{customer.customerType}</td>
                    <td className="py-3">{customer.mobile || "-"}</td>
                    <td className="py-3">{customer.email || "-"}</td>
                    <td className="py-3">{customer.trnNumber || "-"}</td>
                    <td className="py-3">
                      {customer.vatRegistered ? "Yes" : "No"}
                    </td>
                    <td className="py-3 text-right">
                      {Number(customer.openingBalance).toFixed(2)}
                    </td>

                    <td className="py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          customer.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {customer.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="py-3 text-right">
                      <form action={toggleCustomerStatus}>
                        <input type="hidden" name="id" value={customer.id} />
                        <input
                          type="hidden"
                          name="isActive"
                          value={String(customer.isActive)}
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold hover:bg-slate-100"
                        >
                          {customer.isActive ? "Disable" : "Enable"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}

                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      No customers found. Add your first customer above.
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