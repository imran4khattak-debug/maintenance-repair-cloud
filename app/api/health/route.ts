import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const companyCount = await prisma.company.count();
  return NextResponse.json({ ok: true, companyCount });
}

