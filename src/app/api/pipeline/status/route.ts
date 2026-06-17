import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getPipelineStatus } from "@/lib/quota";

export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  return NextResponse.json({ success: true, ...getPipelineStatus() });
}
