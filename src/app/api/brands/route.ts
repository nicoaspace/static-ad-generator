import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const BRANDS_ROOT = path.join(process.cwd(), "brands");

export async function GET(req: NextRequest) {
  try {
    if (!fs.existsSync(BRANDS_ROOT)) {
      fs.mkdirSync(BRANDS_ROOT, { recursive: true });
    }

    const { searchParams } = new URL(req.url);
    const brandParam = searchParams.get("brand");

    if (brandParam) {
      if (brandParam.includes("..") || brandParam.includes("/") || brandParam.includes("\\")) {
        return NextResponse.json({ success: false, error: "Invalid brand parameter" }, { status: 400 });
      }

      const brandDir = path.join(BRANDS_ROOT, brandParam);
      const outputsDir = path.join(brandDir, "outputs");
      const filesList: { template: string; file: string; url: string }[] = [];

      if (fs.existsSync(outputsDir)) {
        const subdirs = fs.readdirSync(outputsDir).filter((f) => {
          const p = path.join(outputsDir, f);
          return fs.statSync(p).isDirectory();
        });

        subdirs.forEach((sub) => {
          const subDirPath = path.join(outputsDir, sub);
          const files = fs.readdirSync(subDirPath).filter((f) => 
            /\.(png|jpe?g|webp)$/i.test(f)
          );
          files.forEach((f) => {
            filesList.push({
              template: sub,
              file: f,
              url: `/api/images?brand=${encodeURIComponent(brandParam)}&file=${encodeURIComponent(`outputs/${sub}/${f}`)}`,
            });
          });
        });
      }

      return NextResponse.json({ success: true, files: filesList });
    }

    const folders = fs.readdirSync(BRANDS_ROOT).filter((name) => {
      const fullPath = path.join(BRANDS_ROOT, name);
      return fs.statSync(fullPath).isDirectory();
    });

    const brands = folders.map((name) => {
      const brandDir = path.join(BRANDS_ROOT, name);
      const metaPath = path.join(brandDir, "brand-meta.json");
      const dnaPath = path.join(brandDir, "brand-dna.md");
      const promptsPath = path.join(brandDir, "prompts.json");
      const outputsDir = path.join(brandDir, "outputs");

      let meta = {
        brand: name,
        url: "",
        product: "",
        brand_type: "product",
      };

      if (fs.existsSync(metaPath)) {
        try {
          meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
        } catch (e) {
          console.error("Error reading meta for " + name, e);
        }
      } else {
        // Infer type if brand-meta.json doesn't exist
        const hasAssets = fs.existsSync(path.join(brandDir, "brand-assets"));
        meta.brand_type = hasAssets ? "service" : "product";
      }

      const hasDna = fs.existsSync(dnaPath);
      const hasPrompts = fs.existsSync(promptsPath);

      // Count uploaded assets
      let assetCount = 0;
      const assetCounts: Record<string, number> = {};

      if (meta.brand_type === "product") {
        const prodImgDir = path.join(brandDir, "product-images");
        if (fs.existsSync(prodImgDir)) {
          const files = fs.readdirSync(prodImgDir).filter((f) => 
            /\.(png|jpe?g|webp)$/i.test(f)
          );
          assetCount = files.length;
          assetCounts["product-images"] = files.length;
        }
      } else {
        const categories = ["screenshots", "team", "logos", "icons"];
        categories.forEach((cat) => {
          const catDir = path.join(brandDir, "brand-assets", cat);
          if (fs.existsSync(catDir)) {
            const files = fs.readdirSync(catDir).filter((f) => 
              /\.(png|jpe?g|webp)$/i.test(f)
            );
            assetCount += files.length;
            assetCounts[cat] = files.length;
          } else {
            assetCounts[cat] = 0;
          }
        });
      }

      // Count generated images
      let generatedImageCount = 0;
      if (fs.existsSync(outputsDir)) {
        const subdirs = fs.readdirSync(outputsDir).filter((f) => {
          const p = path.join(outputsDir, f);
          return fs.statSync(p).isDirectory();
        });

        subdirs.forEach((sub) => {
          const files = fs.readdirSync(path.join(outputsDir, sub)).filter((f) => 
            /\.(png)$/i.test(f)
          );
          generatedImageCount += files.length;
        });
      }

      return {
        name,
        brandType: meta.brand_type,
        url: meta.url,
        productName: meta.product || name,
        hasDna,
        hasPrompts,
        assetCount,
        assetCounts,
        generatedImageCount,
      };
    });

    return NextResponse.json({ success: true, brands });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { brandName, url, productName, brandType } = await req.json();

    if (!brandName) {
      return NextResponse.json({ success: false, error: "Brand Name is required" }, { status: 400 });
    }

    // Clean brand name to use as folder (slugify)
    const folderName = brandName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-");

    const brandDir = path.join(BRANDS_ROOT, folderName);

    if (fs.existsSync(brandDir)) {
      return NextResponse.json({ success: false, error: `Brand folder '${folderName}' already exists` }, { status: 400 });
    }

    // Create directories
    fs.mkdirSync(brandDir, { recursive: true });
    fs.mkdirSync(path.join(brandDir, "outputs"), { recursive: true });

    if (brandType === "product") {
      fs.mkdirSync(path.join(brandDir, "product-images"), { recursive: true });
    } else {
      const categories = ["screenshots", "team", "logos", "icons"];
      categories.forEach((cat) => {
        fs.mkdirSync(path.join(brandDir, "brand-assets", cat), { recursive: true });
      });
    }

    // Save brand-meta.json
    const meta = {
      brand: brandName,
      url: url || "",
      product: productName || brandName,
      brand_type: brandType || "product",
      created_at: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(brandDir, "brand-meta.json"),
      JSON.stringify(meta, null, 2),
      "utf-8"
    );

    return NextResponse.json({ success: true, folderName, meta });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
