import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { BRANDS_ROOT } from "@/lib/brand-fs";
import { requireAuth, quotaResponse } from "@/lib/api-auth";
import {
  canAccessBrand,
  canWriteBrand,
  checkRateLimit,
  checkStorageForWrite,
  enforceQuota,
} from "@/lib/quota";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const rateCheck = enforceQuota(checkRateLimit(authResult.email));
  if (rateCheck) return rateCheck;

  try {
    const { searchParams } = new URL(req.url);
    const brand = searchParams.get("brand");

    if (!brand) {
      return NextResponse.json({ success: false, error: "Brand parameter is required" }, { status: 400 });
    }

    if (!canAccessBrand(authResult.email, brand)) {
      return quotaResponse("Brand not found", "NOT_FOUND", 404);
    }

    const promptsPath = path.join(BRANDS_ROOT, brand, "prompts.json");
    if (!fs.existsSync(promptsPath)) {
      return NextResponse.json({ success: false, error: "prompts.json not found for this brand. Run Phase 2 first." }, { status: 404 });
    }

    const data = JSON.parse(fs.readFileSync(promptsPath, "utf-8"));
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const rateCheck = enforceQuota(checkRateLimit(authResult.email));
  if (rateCheck) return rateCheck;

  try {
    const { brand, data } = await req.json();

    if (!brand || !data) {
      return NextResponse.json({ success: false, error: "Brand and data fields are required" }, { status: 400 });
    }

    if (!canWriteBrand(authResult.email, brand)) {
      return quotaResponse("You do not have permission to modify this brand.", "FORBIDDEN", 403);
    }

    const payload = JSON.stringify(data, null, 2);
    if (payload.length > 2 * 1024 * 1024) {
      return quotaResponse("Prompts file is too large.", "PAYLOAD_TOO_LARGE", 413);
    }

    const storageCheck = enforceQuota(checkStorageForWrite(authResult.email, Buffer.byteLength(payload, "utf-8")));
    if (storageCheck) return storageCheck;

    const promptsPath = path.join(BRANDS_ROOT, brand, "prompts.json");
    fs.mkdirSync(path.dirname(promptsPath), { recursive: true });
    fs.writeFileSync(promptsPath, payload, "utf-8");

    return NextResponse.json({ success: true, message: "Prompts updated successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
