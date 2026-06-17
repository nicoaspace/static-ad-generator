import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { BRANDS_ROOT } from "@/lib/brand-fs";
import { requireAuth } from "@/lib/api-auth";
import {
  canWriteBrand,
  checkRateLimit,
  checkUpload,
  enforceQuota,
} from "@/lib/quota";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const rateCheck = enforceQuota(checkRateLimit(authResult.email));
  if (rateCheck) return rateCheck;

  try {
    const data = await req.formData();
    const file = data.get("file") as File | null;
    const brand = data.get("brand") as string | null;
    const brandType = data.get("brandType") as string | null;
    const category = data.get("category") as string | null;

    if (!file || !brand || !brandType) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const uploadCheck = enforceQuota(
      checkUpload(authResult.email, brand, brandType, category, file.size, file.type)
    );
    if (uploadCheck) return uploadCheck;

    const brandDir = path.join(BRANDS_ROOT, brand);
    if (!fs.existsSync(brandDir)) {
      return NextResponse.json({ success: false, error: `Brand '${brand}' not found` }, { status: 404 });
    }

    if (!canWriteBrand(authResult.email, brand)) {
      return NextResponse.json({ success: false, error: "You do not have permission to modify this brand.", code: "FORBIDDEN" }, { status: 403 });
    }

    let destDir = "";
    if (brandType === "product") {
      destDir = path.join(brandDir, "product-images");
    } else {
      if (!category) {
        return NextResponse.json({ success: false, error: "Missing asset category for service brand" }, { status: 400 });
      }
      destDir = path.join(brandDir, "brand-assets", category);
    }

    fs.mkdirSync(destDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = path.join(destDir, safeName);
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({ success: true, filename: safeName });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
