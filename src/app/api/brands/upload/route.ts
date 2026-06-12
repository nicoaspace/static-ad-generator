import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const BRANDS_ROOT = path.join(process.cwd(), "brands");

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const file = data.get("file") as File | null;
    const brand = data.get("brand") as string | null;
    const brandType = data.get("brandType") as string | null;
    const category = data.get("category") as string | null;

    if (!file || !brand || !brandType) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const brandDir = path.join(BRANDS_ROOT, brand);
    if (!fs.existsSync(brandDir)) {
      return NextResponse.json({ success: false, error: `Brand '${brand}' not found` }, { status: 404 });
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

    // Ensure destination directory exists
    fs.mkdirSync(destDir, { recursive: true });

    // Read file data
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save file
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = path.join(destDir, safeName);
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({ success: true, filename: safeName });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
