import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  BRANDS_ROOT,
  scanBrandAssets,
  countAssets,
  validateBrandName,
} from "@/lib/brand-fs";
import { checkTemplateEligibility } from "@/lib/eligibility";
import type { PromptItem } from "@/lib/types";
import { requireAuth, quotaResponse } from "@/lib/api-auth";
import { canAccessBrand, checkRateLimit, enforceQuota, readBrandMeta } from "@/lib/quota";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const rateCheck = enforceQuota(checkRateLimit(authResult.email));
  if (rateCheck) return rateCheck;

  try {
    const { searchParams } = new URL(req.url);
    const brandParam = searchParams.get("brand");

    if (!brandParam) {
      return NextResponse.json({ success: false, error: "brand parameter is required" }, { status: 400 });
    }

    if (!validateBrandName(brandParam)) {
      return NextResponse.json({ success: false, error: "Invalid brand parameter" }, { status: 400 });
    }

    if (!canAccessBrand(authResult.email, brandParam)) {
      return quotaResponse("Brand not found", "NOT_FOUND", 404);
    }

    const brandDir = path.join(BRANDS_ROOT, brandParam);
    if (!fs.existsSync(brandDir)) {
      return NextResponse.json({ success: false, error: "Brand not found" }, { status: 404 });
    }

    const meta = readBrandMeta(brandDir, brandParam);
    const brandType = (meta.brand_type || "product") as "product" | "service";

    const assets = scanBrandAssets(brandDir, brandParam, brandType);
    const { populated, assetCounts } = countAssets(assets);
    const productImageCount = assetCounts["product-images"] || 0;

    const promptsPath = path.join(brandDir, "prompts.json");
    let prompts: PromptItem[] = [];

    if (fs.existsSync(promptsPath)) {
      const data = JSON.parse(fs.readFileSync(promptsPath, "utf-8"));
      prompts = data.prompts || [];
    }

    const eligibility = checkTemplateEligibility(
      prompts,
      populated,
      brandType,
      productImageCount
    );

    const ready = eligibility.filter((e) => e.status === "ready").length;
    const partial = eligibility.filter((e) => e.status === "partial").length;
    const blocked = eligibility.filter((e) => e.status === "blocked").length;

    return NextResponse.json({
      success: true,
      brandType,
      assetCounts,
      eligibility,
      summary: { total: eligibility.length, ready, partial, blocked },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
