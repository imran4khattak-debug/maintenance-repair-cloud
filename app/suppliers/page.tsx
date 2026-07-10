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

async function createSupplier(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    throw new Error("Supplier name is required.");
  }

  await prisma.supplier.create({
    data: {
      name,
      supplierType: cleanText(formData.get("supplierType")),
      licenseNumber: cleanText(formData.get("licenseNumber")),
      mobile: cleanText(formData.get("mobile")),
      email: cleanText(formData.get("email")),
      trnNumber: cleanText(formData.get("trnNumber")),
      vatRegistered: formData.get("vatRegistered") === "on",
      paymentTerms: cleanText(formData.get("paymentTerms")),
      openingBalance: cleanNumber(formData.get("openingBalance")),
      address: cleanText(formData.get("address")),
      contactPerson: cleanText(formData.get("contactPerson")),
      bankDetails: cleanText(formData.get("bankDetails")),
      isActive: true,
    },
  });

  revalidatePath("/suppliers");
}

async function toggleSupplierStatus(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("isActive")) === "true";

  if (!id) {
    return;
  }

  await prisma.supplier.update({
    where: { id },
    data: {
      isActive: !isActive,
    },
  });

  revalidatePath("/suppliers");
}

export default async function SuppliersPage() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  const activeSuppliers = suppliers.filter((supplier) => supplier.isActive);
  const inactiveSuppliers = suppliers.filter((supplier) => !supplier.isActive);
  const vatSuppliers = suppliers.filter((supplier) => supplier.vatRegistered);
  const totalOpeningBalance = suppliers.reduce(
    (sum, supplier) => sum + Number(supplier.openingBalance),
    0
  );

  return (
    <>
      <PageHeader
        title="Suppliers"
        subtitle="Manage material suppliers, subcontractors and service providers."
      />

      <div className="space-y-6 p-8">
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <p className="text-sm text-slate-500">Total Suppliers</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {suppliers.length}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Active Suppliers</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {activeSuppliers.length}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">VAT Registered</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {vatSuppliers.length}
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
            Add New Supplier
          </h2>

          <form action={createSupplier} className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <Label>Supplier Name</Label>
              <Input
                name="name"
                required
                placeholder="Supplier, subcontractor or service provider name"
              />
            </div>

            <div>
              <Label>Supplier Type</Label>
              <Select name="supplierType" defaultValue="MATERIAL SUPPLIER">
                <option value="MATERIAL SUPPLIER">Material Supplier</option>
                <option value="SUBCONTRACTOR">Subcontractor</option>
                <option value="SERVICE PROVIDER">Service Provider</option>
                <option value="GOVERNMENT">Government</option>
                <option value="UTILITY">Utility</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>

            <div>
              <Label>License Number</Label>
              <Input name="licenseNumber" placeholder="Trade license number" />
            </div>

            <div>
              <Label>Contact Person</Label>
              <Input name="contactPerson" placeholder="Contact person name" />
            </div>

            <div>
              <Label>Mobile Number</Label>
              <Input name="mobile" placeholder="Mobile number" />
            </div>

            <div>
              <Label>Email ID</Label>
              <Input name="email" type="email" placeholder="supplier@email.com" />
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
                <option value="60 DAYS">60 Days</option>
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
              <Label>Bank Details</Label>
              <Textarea
                name="bankDetails"
                rows={3}
                placeholder="Bank name, account number, IBAN and branch"
              />
            </div>

            <div className="md:col-span-2">
              <Label>Address</Label>
              <Textarea
                name="address"
                rows={3}
                placeholder="Supplier address"
              />
            </div>

            <div className="md:col-span-2">
              <Button type="submit">Save Supplier</Button>
            </div>
          </form>
        </Card>

        <Card>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Suppliers List
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Active: {activeSuppliers.length} | Inactive:{" "}
              {inactiveSuppliers.length}
            </p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2">Supplier</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Contact</th>
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
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-b last:border-0">
                    <td className="py-3 font-medium text-slate-900">
                      {supplier.name}
                      {supplier.licenseNumber ? (
                        <div className="text-xs text-slate-500">
                          License: {supplier.licenseNumber}
                        </div>
                      ) : null}
                    </td>

                    <td className="py-3">{supplier.supplierType || "-"}</td>
                    <td className="py-3">{supplier.contactPerson || "-"}</td>
                    <td className="py-3">{supplier.mobile || "-"}</td>
                    <td className="py-3">{supplier.email || "-"}</td>
                    <td className="py-3">{supplier.trnNumber || "-"}</td>
                    <td className="py-3">
                      {supplier.vatRegistered ? "Yes" : "No"}
                    </td>

                    <td className="py-3 text-right">
                      {Number(supplier.openingBalance).toFixed(2)}
                    </td>

                    <td className="py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          supplier.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {supplier.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="py-3 text-right">
                      <form action={toggleSupplierStatus}>
                        <input type="hidden" name="id" value={supplier.id} />
                        <input
                          type="hidden"
                          name="isActive"
                          value={String(supplier.isActive)}
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold hover:bg-slate-100"
                        >
                          {supplier.isActive ? "Disable" : "Enable"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}

                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      No suppliers found. Add your first supplier above.
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