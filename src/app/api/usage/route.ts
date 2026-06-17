import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { checkRateLimit, enforceQuota, getUsageSummary } from "@/lib/quota";

export async function GET() {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const rateCheck = enforceQuota(checkRateLimit(authResult.email));
  if (rateCheck) return rateCheck;

  return NextResponse.json({ success: true, usage: getUsageSummary(authResult.email) });
}
