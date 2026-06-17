import fs from "fs";
import path from "path";
import { isImageFile } from "./eligibility";
import type { AssetFile, GalleryImage } from "./types";

export const BRANDS_ROOT = path.join(process.cwd(), "brands");
export const SERVICE_ASSET_CATEGORIES = ["screenshots", "team", "logos", "icons"] as const;

export function validateBrandName(brand: string): boolean {
  return !brand.includes("..") && !brand.includes("/") && !brand.includes("\\");
}

export function listImagesInDir(
  dirPath: string,
  brand: string,
  filePrefix: string
): AssetFile[] {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath)
    .filter((f) => isImageFile(f))
    .map((f) => ({
      file: f,
      url: `/api/images?brand=${encodeURIComponent(brand)}&file=${encodeURIComponent(`${filePrefix}/${f}`)}`,
    }));
}

export function scanBrandAssets(
  brandDir: string,
  brand: string,
  brandType: "product" | "service"
): Record<string, AssetFile[]> {
  if (brandType === "product") {
    return {
      "product-images": listImagesInDir(
        path.join(brandDir, "product-images"),
        brand,
        "product-images"
      ),
    };
  }

  const assets: Record<string, AssetFile[]> = {};
  for (const cat of SERVICE_ASSET_CATEGORIES) {
    assets[cat] = listImagesInDir(
      path.join(brandDir, "brand-assets", cat),
      brand,
      `brand-assets/${cat}`
    );
  }
  return assets;
}

export function countAssets(assets: Record<string, AssetFile[]>): {
  assetCount: number;
  assetCounts: Record<string, number>;
  populated: Set<string>;
} {
  const assetCounts: Record<string, number> = {};
  let assetCount = 0;
  const populated = new Set<string>();

  for (const [cat, files] of Object.entries(assets)) {
    assetCounts[cat] = files.length;
    assetCount += files.length;
    if (files.length > 0) populated.add(cat);
  }

  return { assetCount, assetCounts, populated };
}

export function listOutputFiles(brandDir: string, brand: string): GalleryImage[] {
  const outputsDir = path.join(brandDir, "outputs");
  const filesList: GalleryImage[] = [];

  if (!fs.existsSync(outputsDir)) return filesList;

  const subdirs = fs.readdirSync(outputsDir).filter((f) => {
    const p = path.join(outputsDir, f);
    return fs.statSync(p).isDirectory();
  });

  for (const sub of subdirs) {
    const subDirPath = path.join(outputsDir, sub);
    const files = fs.readdirSync(subDirPath).filter((f) => isImageFile(f));
    for (const f of files) {
      const filePath = path.join(subDirPath, f);
      const modifiedAt = fs.statSync(filePath).mtimeMs;
      filesList.push({
        template: sub,
        file: f,
        url: `/api/images?brand=${encodeURIComponent(brand)}&file=${encodeURIComponent(`outputs/${sub}/${f}`)}`,
        modifiedAt,
      });
    }
  }

  return filesList;
}

export function getGeneratedCounts(brandDir: string): Record<number, number> {
  const outputsDir = path.join(brandDir, "outputs");
  const counts: Record<number, number> = {};

  if (!fs.existsSync(outputsDir)) return counts;

  const subdirs = fs.readdirSync(outputsDir).filter((f) => {
    const p = path.join(outputsDir, f);
    return fs.statSync(p).isDirectory();
  });

  for (const sub of subdirs) {
    const match = sub.match(/^(\d+)-/);
    if (!match) continue;
    const num = parseInt(match[1], 10);
    const files = fs
      .readdirSync(path.join(outputsDir, sub))
      .filter((f) => isImageFile(f));
    counts[num] = (counts[num] || 0) + files.length;
  }

  return counts;
}

export function getLatestThumbnails(
  brandDir: string,
  brand: string
): Record<number, string> {
  const outputsDir = path.join(brandDir, "outputs");
  const thumbs: Record<number, string> = {};

  if (!fs.existsSync(outputsDir)) return thumbs;

  const subdirs = fs.readdirSync(outputsDir).filter((f) => {
    const p = path.join(outputsDir, f);
    return fs.statSync(p).isDirectory();
  });

  for (const sub of subdirs) {
    const match = sub.match(/^(\d+)-/);
    if (!match) continue;
    const num = parseInt(match[1], 10);
    const files = fs
      .readdirSync(path.join(outputsDir, sub))
      .filter((f) => isImageFile(f))
      .sort();
    if (files.length > 0) {
      const latest = files[files.length - 1];
      thumbs[num] = `/api/images?brand=${encodeURIComponent(brand)}&file=${encodeURIComponent(`outputs/${sub}/${latest}`)}`;
    }
  }

  return thumbs;
}
