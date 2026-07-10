import { Prisma } from "@prisma/client";

export function toDecimal(value: FormDataEntryValue | null, fallback = "0") {
  const raw = String(value ?? fallback).trim();
  return new Prisma.Decimal(raw === "" ? fallback : raw);
}

export function toDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  return raw ? new Date(raw) : new Date();
}

export function optionalString(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  return raw === "" ? null : raw;
}

export function money(value: unknown) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function shortDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB");
}

export function nextNo(prefix: string) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  return `${prefix}-${stamp}`;
}

