import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  BRANDS_ROOT,
  getGeneratedCounts,
  getLatestThumbnails,
  listOutputFiles,
  scanBrandAssets,
  validateBrandName,
  SERVICE_ASSET_CATEGORIES,
} from "@/lib/brand-fs";
import { isImageFile } from "@/lib/eligibility";
import { requireAuth, quotaResponse } from "@/lib/api-auth";
import {
  canAccessBrand,
  checkCanCreateBrand,
  checkRateLimit,
  enforceQuota,
  readBrandMeta,
} from "@/lib/quota";

function countLegacyAssets(brandDir: string, brandType: "product" | "service") {
  let assetCount = 0;
  const assetCounts: Record<string, number> = {};

  if (brandType === "product") {
    const prodImgDir = path.join(brandDir, "product-images");
    if (fs.existsSync(prodImgDir)) {
      const files = fs.readdirSync(prodImgDir).filter((f) => isImageFile(f));
      assetCount = files.length;
      assetCounts["product-images"] = files.length;
    }
  } else {
    for (const cat of SERVICE_ASSET_CATEGORIES) {
      const catDir = path.join(brandDir, "brand-assets", cat);
      if (fs.existsSync(catDir)) {
        const files = fs.readdirSync(catDir).filter((f) => isImageFile(f));
        assetCount += files.length;
        assetCounts[cat] = files.length;
      } else {
        assetCounts[cat] = 0;
      }
    }
  }

  return { assetCount, assetCounts };
}

function countGeneratedImages(outputsDir: string): number {
  if (!fs.existsSync(outputsDir)) return 0;
  let count = 0;
  const subdirs = fs.readdirSync(outputsDir).filter((f) => {
    const p = path.join(outputsDir, f);
    return fs.statSync(p).isDirectory();
  });
  for (const sub of subdirs) {
    count += fs
      .readdirSync(path.join(outputsDir, sub))
      .filter((f) => /\.png$/i.test(f)).length;
  }
  return count;
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) return authResult.error;

  const rateCheck = enforceQuota(checkRateLimit(authResult.email));
  if (rateCheck) return rateCheck;

  try {
    if (!fs.existsSync(BRANDS_ROOT)) {
      fs.mkdirSync(BRANDS_ROOT, { recursive: true });
    }

    const { searchParams } = new URL(req.url);
    const brandParam = searchParams.get("brand");
    const assetsOnly = searchParams.get("assets") === "true";

    if (brandParam) {
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

      if (assetsOnly) {
        return NextResponse.json({ success: true, assets });
      }

      const filesList = listOutputFiles(brandDir, brandParam);
      const generatedCounts = getGeneratedCounts(brandDir);
      const latestThumbnails = getLatestThumbnails(brandDir, brandParam);

      return NextResponse.json({
        success: true,
        files: filesList,
        generatedCounts,
        latestThumbnails,
        assets,
      });
    }

    const folders = fs.readdirSync(BRANDS_ROOT).filter((name) => {
      const fullPath = path.join(BRANDS_ROOT, name);
      return fs.statSync(fullPath).isDirectory() && canAccessBrand(authResult.email, name);
    });

    const brands = folders.map((name) => {
      const brandDir = path.join(BRANDS_ROOT, name);
      const meta = readBrandMeta(brandDir, name);
      const brandType = (meta.brand_type || "product") as "product" | "service";
      const hasDna = fs.existsSync(path.join(brandDir, "brand-dna.md"));
      const hasPrompts = fs.existsSync(path.join(brandDir, "prompts.json"));
      const { assetCount, assetCounts } = countLegacyAssets(brandDir, brandType);
      const generatedImageCount = countGeneratedImages(path.join(brandDir, "outputs"));

      return {
        name,
        brandType,
        url: meta.url,
        productName: meta.product || name,
        hasDna,
        hasPrompts,
        assetCount,
        assetCounts,
        generatedImageCount,
        isOwner: !meta.owner_email || meta.owner_email.toLowerCase() === authResult.email.toLowerCase(),
      };
    });

    return NextResponse.json({ success: true, brands });
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

  const brandCheck = enforceQuota(checkCanCreateBrand(authResult.email));
  if (brandCheck) return brandCheck;

  try {
    const { brandName, url, productName, brandType } = await req.json();

    if (!brandName) {
      return NextResponse.json({ success: false, error: "Brand Name is required" }, { status: 400 });
    }

    const folderName = brandName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-");

    const brandDir = path.join(BRANDS_ROOT, folderName);

    if (fs.existsSync(brandDir)) {
      return NextResponse.json({ success: false, error: `Brand folder '${folderName}' already exists` }, { status: 400 });
    }

    fs.mkdirSync(brandDir, { recursive: true });
    fs.mkdirSync(path.join(brandDir, "outputs"), { recursive: true });

    if (brandType === "product") {
      fs.mkdirSync(path.join(brandDir, "product-images"), { recursive: true });
    } else {
      for (const cat of SERVICE_ASSET_CATEGORIES) {
        fs.mkdirSync(path.join(brandDir, "brand-assets", cat), { recursive: true });
      }
    }

    const meta = {
      brand: brandName,
      url: url || "",
      product: productName || brandName,
      brand_type: brandType || "product",
      created_at: new Date().toISOString(),
      owner_email: authResult.email,
    };

    fs.writeFileSync(path.join(brandDir, "brand-meta.json"), JSON.stringify(meta, null, 2), "utf-8");

    return NextResponse.json({ success: true, folderName, meta });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
