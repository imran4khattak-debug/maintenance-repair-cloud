import { revalidatePath } from "next/cache";
import PageHeader from "@/components/PageHeader";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/Card";
import { prisma } from "@/lib/prisma";

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}

function cleanDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  const date = new Date(`${text}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function dateInputValue(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return value.toISOString().slice(0, 10);
}

async function saveCompany(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    throw new Error("Company name is required.");
  }

  const data = {
    name,
    licenseNumber: cleanText(formData.get("licenseNumber")),
    activity: cleanText(formData.get("activity")),
    address: cleanText(formData.get("address")),
    phone: cleanText(formData.get("phone")),
    email: cleanText(formData.get("email")),
    trnNumber: cleanText(formData.get("trnNumber")),
    vatRegistered: formData.get("vatRegistered") === "on",
    vatPeriodType: String(formData.get("vatPeriodType") || "QUARTERLY"),
    financialYearStart: cleanDate(formData.get("financialYearStart")),
    financialYearEnd: cleanDate(formData.get("financialYearEnd")),
  };

  const existing = await prisma.company.findFirst({
    orderBy: {
      createdAt: "asc",
    },
  });

  if (existing) {
    await prisma.company.update({
      where: {
        id: existing.id,
      },
      data,
    });
  } else {
    await prisma.company.create({
      data,
    });
  }

  revalidatePath("/company");
}

export default async function CompanyPage() {
  const company = await prisma.company.findFirst({
    orderBy: {
      createdAt: "asc",
    },
  });

  return (
    <>
      <PageHeader
        title="Company Setup"
        subtitle="Company details, license, VAT and financial year settings."
      />

      <div className="p-8">
        <Card>
          <form action={saveCompany} className="grid gap-5 md:grid-cols-2">
            <div>
              <Label>Company Name</Label>
              <Input
                name="name"
                required
                defaultValue={company?.name ?? ""}
                placeholder="Enter company name"
              />
            </div>

            <div>
              <Label>License Number</Label>
              <Input
                name="licenseNumber"
                defaultValue={company?.licenseNumber ?? ""}
                placeholder="Trade license number"
              />
            </div>

            <div>
              <Label>Activity</Label>
              <Input
                name="activity"
                defaultValue={company?.activity ?? ""}
                placeholder="Maintenance, repairs, technical services"
              />
            </div>

            <div>
              <Label>Phone</Label>
              <Input
                name="phone"
                defaultValue={company?.phone ?? ""}
                placeholder="Mobile / phone number"
              />
            </div>

            <div>
              <Label>Email</Label>
              <Input
                name="email"
                type="email"
                defaultValue={company?.email ?? ""}
                placeholder="company@email.com"
              />
            </div>

            <div>
              <Label>TRN Number</Label>
              <Input
                name="trnNumber"
                defaultValue={company?.trnNumber ?? ""}
                placeholder="Tax Registration Number"
              />
            </div>

            <div>
              <Label>VAT Period</Label>
              <Select
                name="vatPeriodType"
                defaultValue={company?.vatPeriodType ?? "QUARTERLY"}
              >
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="CUSTOM">Custom</option>
              </Select>
            </div>

            <div className="flex items-end gap-3 pb-2">
              <input
                id="vatRegistered"
                name="vatRegistered"
                type="checkbox"
                defaultChecked={company?.vatRegistered ?? false}
                className="h-4 w-4"
              />
              <label
                htmlFor="vatRegistered"
                className="text-sm font-medium text-slate-700"
              >
                VAT Registered
              </label>
            </div>

            <div>
              <Label>Financial Year Start</Label>
              <Input
                name="financialYearStart"
                type="date"
                defaultValue={dateInputValue(company?.financialYearStart)}
              />
            </div>

            <div>
              <Label>Financial Year End</Label>
              <Input
                name="financialYearEnd"
                type="date"
                defaultValue={dateInputValue(company?.financialYearEnd)}
              />
            </div>

            <div className="md:col-span-2">
              <Label>Address</Label>
              <Textarea
                name="address"
                defaultValue={company?.address ?? ""}
                placeholder="Full company address"
                rows={3}
              />
            </div>

            <div className="md:col-span-2">
              <Button type="submit">Save Company Setup</Button>
            </div>
          </form>
        </Card>

        {company ? (
          <Card className="mt-6">
            <h3 className="text-lg font-bold text-slate-900">
              Saved Company Information
            </h3>

            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <p>
                <span className="font-semibold">Company:</span> {company.name}
              </p>
              <p>
                <span className="font-semibold">License:</span>{" "}
                {company.licenseNumber || "-"}
              </p>
              <p>
                <span className="font-semibold">TRN:</span>{" "}
                {company.trnNumber || "-"}
              </p>
              <p>
                <span className="font-semibold">VAT Registered:</span>{" "}
                {company.vatRegistered ? "Yes" : "No"}
              </p>
              <p>
                <span className="font-semibold">VAT Period:</span>{" "}
                {company.vatPeriodType}
              </p>
              <p>
                <span className="font-semibold">Email:</span>{" "}
                {company.email || "-"}
              </p>
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}