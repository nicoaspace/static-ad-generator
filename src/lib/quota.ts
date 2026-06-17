import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { BRANDS_ROOT, validateBrandName } from "./brand-fs";
import { LIMITS } from "./limits";
import { isImageFile } from "./eligibility";

const DATA_ROOT = path.join(process.cwd(), "data");
const USAGE_DIR = path.join(DATA_ROOT, "usage");
const PIPELINE_LOCK = path.join(DATA_ROOT, "pipeline.lock");

export interface BrandMeta {
  brand: string;
  url?: string;
  product?: string;
  brand_type?: "product" | "service";
  created_at?: string;
  owner_email?: string;
}

interface DailyUsage {
  date: string;
  researchRuns: number;
  generateRuns: number;
}

interface UserUsage {
  email: string;
  daily: DailyUsage;
  rateWindowStart: number;
  rateCount: number;
}

export interface UsageSummary {
  brands: { used: number; limit: number };
  storage: { usedBytes: number; limitBytes: number; globalUsedBytes: number; globalLimitBytes: number };
  daily: {
    research: { used: number; limit: number };
    generate: { used: number; limit: number };
  };
  rateLimit: { remaining: number; limit: number };
  limits: {
    maxUploadMb: number;
    maxAssetsPerCategory: number;
    maxTemplatesPerGenerate: number;
    maxVariations: number;
    allowedResolutions: readonly string[];
  };
  provider?: {
    imageModel: string;
    secondsPerImage: number;
  };
}

function ensureDataDirs() {
  fs.mkdirSync(USAGE_DIR, { recursive: true });
}

function usageFilePath(email: string): string {
  const hash = crypto.createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 20);
  return path.join(USAGE_DIR, `${hash}.json`);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function readUserUsage(email: string): UserUsage {
  ensureDataDirs();
  const file = usageFilePath(email);
  if (!fs.existsSync(file)) {
    return {
      email,
      daily: { date: todayUtc(), researchRuns: 0, generateRuns: 0 },
      rateWindowStart: Date.now(),
      rateCount: 0,
    };
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8")) as UserUsage;
    if (data.daily.date !== todayUtc()) {
      data.daily = { date: todayUtc(), researchRuns: 0, generateRuns: 0 };
    }
    return data;
  } catch {
    return {
      email,
      daily: { date: todayUtc(), researchRuns: 0, generateRuns: 0 },
      rateWindowStart: Date.now(),
      rateCount: 0,
    };
  }
}

function writeUserUsage(usage: UserUsage) {
  ensureDataDirs();
  fs.writeFileSync(usageFilePath(usage.email), JSON.stringify(usage, null, 2), "utf-8");
}

export function readBrandMeta(brandDir: string, fallbackName: string): BrandMeta {
  const metaPath = path.join(brandDir, "brand-meta.json");
  const fallback: BrandMeta = {
    brand: fallbackName,
    brand_type: fs.existsSync(path.join(brandDir, "brand-assets")) ? "service" : "product",
  };
  if (!fs.existsSync(metaPath)) return fallback;
  try {
    return { ...fallback, ...JSON.parse(fs.readFileSync(metaPath, "utf-8")) };
  } catch {
    return fallback;
  }
}

export function dirSizeBytes(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += dirSizeBytes(full);
    } else if (entry.isFile()) {
      try {
        total += fs.statSync(full).size;
      } catch {
        /* skip */
      }
    }
  }
  return total;
}

export function getGlobalStorageBytes(): number {
  return dirSizeBytes(BRANDS_ROOT);
}

export function listBrandFolders(): string[] {
  if (!fs.existsSync(BRANDS_ROOT)) return [];
  return fs.readdirSync(BRANDS_ROOT).filter((name) => {
    const full = path.join(BRANDS_ROOT, name);
    return fs.statSync(full).isDirectory();
  });
}

export function countUserBrands(email: string): number {
  return listBrandFolders().filter((name) => {
    const meta = readBrandMeta(path.join(BRANDS_ROOT, name), name);
    return meta.owner_email?.toLowerCase() === email.toLowerCase();
  }).length;
}

export function getUserStorageBytes(email: string): number {
  let total = 0;
  for (const name of listBrandFolders()) {
    const brandDir = path.join(BRANDS_ROOT, name);
    const meta = readBrandMeta(brandDir, name);
    if (meta.owner_email?.toLowerCase() === email.toLowerCase()) {
      total += dirSizeBytes(brandDir);
    }
  }
  return total;
}

export function canAccessBrand(email: string, brandName: string): boolean {
  if (!validateBrandName(brandName)) return false;
  const brandDir = path.join(BRANDS_ROOT, brandName);
  if (!fs.existsSync(brandDir)) return false;
  const meta = readBrandMeta(brandDir, brandName);
  if (!meta.owner_email) return true;
  return meta.owner_email.toLowerCase() === email.toLowerCase();
}

export function canWriteBrand(email: string, brandName: string): boolean {
  if (!validateBrandName(brandName)) return false;
  const brandDir = path.join(BRANDS_ROOT, brandName);
  if (!fs.existsSync(brandDir)) return false;
  const meta = readBrandMeta(brandDir, brandName);
  if (!meta.owner_email) return true;
  return meta.owner_email.toLowerCase() === email.toLowerCase();
}

export function countAssetsInDir(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  return fs.readdirSync(dirPath).filter((f) => isImageFile(f)).length;
}

export function countGeneratedImages(brandDir: string): number {
  const outputsDir = path.join(brandDir, "outputs");
  if (!fs.existsSync(outputsDir)) return 0;
  let count = 0;
  for (const sub of fs.readdirSync(outputsDir)) {
    const subPath = path.join(outputsDir, sub);
    if (!fs.statSync(subPath).isDirectory()) continue;
    count += fs.readdirSync(subPath).filter((f) => /\.png$/i.test(f)).length;
  }
  return count;
}

export type QuotaResult =
  | { ok: true }
  | { ok: false; message: string; code: string; status: number; extra?: Record<string, unknown> };

export function checkRateLimit(email: string): QuotaResult {
  const usage = readUserUsage(email);
  const now = Date.now();
  if (now - usage.rateWindowStart >= 60_000) {
    usage.rateWindowStart = now;
    usage.rateCount = 0;
  }
  if (usage.rateCount >= LIMITS.MAX_REQUESTS_PER_MINUTE) {
    const resetIn = Math.ceil((60_000 - (now - usage.rateWindowStart)) / 1000);
    return {
      ok: false,
      message: `Too many requests. Try again in ${resetIn}s.`,
      code: "RATE_LIMIT",
      status: 429,
      extra: { resetInSeconds: resetIn },
    };
  }
  usage.rateCount += 1;
  writeUserUsage(usage);
  return { ok: true };
}

export function checkCanCreateBrand(email: string): QuotaResult {
  const count = countUserBrands(email);
  if (count >= LIMITS.MAX_BRANDS_PER_USER) {
    return {
      ok: false,
      message: `Brand limit reached (${LIMITS.MAX_BRANDS_PER_USER} per user). Delete an existing brand or contact support.`,
      code: "BRAND_LIMIT",
      status: 403,
      extra: { used: count, limit: LIMITS.MAX_BRANDS_PER_USER },
    };
  }
  const globalBytes = getGlobalStorageBytes();
  if (globalBytes >= LIMITS.MAX_GLOBAL_STORAGE_BYTES) {
    return {
      ok: false,
      message: "Platform storage is full. Try again later.",
      code: "GLOBAL_STORAGE_FULL",
      status: 507,
    };
  }
  return { ok: true };
}

export function checkStorageForWrite(
  email: string,
  additionalBytes: number,
  brandName?: string
): QuotaResult {
  const userBytes = getUserStorageBytes(email);
  if (userBytes + additionalBytes > LIMITS.MAX_STORAGE_BYTES_PER_USER) {
    const remaining = Math.max(0, LIMITS.MAX_STORAGE_BYTES_PER_USER - userBytes);
    return {
      ok: false,
      message: `Storage limit exceeded. You have ~${formatMb(remaining)} remaining.`,
      code: "STORAGE_LIMIT",
      status: 507,
      extra: { usedBytes: userBytes, limitBytes: LIMITS.MAX_STORAGE_BYTES_PER_USER },
    };
  }
  const globalBytes = getGlobalStorageBytes();
  if (globalBytes + additionalBytes > LIMITS.MAX_GLOBAL_STORAGE_BYTES) {
    return {
      ok: false,
      message: "Platform storage is full. Cannot save more files.",
      code: "GLOBAL_STORAGE_FULL",
      status: 507,
    };
  }
  if (brandName) {
    const brandDir = path.join(BRANDS_ROOT, brandName);
    const generated = countGeneratedImages(brandDir);
    if (generated * LIMITS.ESTIMATED_IMAGE_BYTES + additionalBytes >
        LIMITS.MAX_GENERATED_IMAGES_PER_BRAND * LIMITS.ESTIMATED_IMAGE_BYTES) {
      if (countGeneratedImages(brandDir) >= LIMITS.MAX_GENERATED_IMAGES_PER_BRAND) {
        return {
          ok: false,
          message: `Generated image limit reached for this brand (${LIMITS.MAX_GENERATED_IMAGES_PER_BRAND}).`,
          code: "GENERATED_LIMIT",
          status: 403,
        };
      }
    }
  }
  return { ok: true };
}

export function checkUpload(
  email: string,
  brandName: string,
  brandType: string,
  category: string | null,
  fileSize: number,
  mimeType: string
): QuotaResult {
  if (!canWriteBrand(email, brandName)) {
    return { ok: false, message: "You do not have permission to modify this brand.", code: "FORBIDDEN", status: 403 };
  }
  if (fileSize > LIMITS.MAX_UPLOAD_FILE_BYTES) {
    return {
      ok: false,
      message: `File too large. Max ${LIMITS.MAX_UPLOAD_FILE_BYTES / (1024 * 1024)} MB per file.`,
      code: "FILE_TOO_LARGE",
      status: 413,
    };
  }
  if (mimeType && !LIMITS.ALLOWED_UPLOAD_MIME.has(mimeType)) {
    return {
      ok: false,
      message: "Only PNG, JPEG, WebP, and GIF images are allowed.",
      code: "INVALID_FILE_TYPE",
      status: 400,
    };
  }

  const brandDir = path.join(BRANDS_ROOT, brandName);
  let destDir: string;
  if (brandType === "product") {
    destDir = path.join(brandDir, "product-images");
  } else {
    if (!category) {
      return { ok: false, message: "Missing asset category.", code: "BAD_REQUEST", status: 400 };
    }
    destDir = path.join(brandDir, "brand-assets", category);
  }

  const inCategory = countAssetsInDir(destDir);
  if (inCategory >= LIMITS.MAX_ASSETS_PER_CATEGORY) {
    return {
      ok: false,
      message: `Asset limit for this folder (${LIMITS.MAX_ASSETS_PER_CATEGORY} images).`,
      code: "ASSET_CATEGORY_LIMIT",
      status: 403,
    };
  }

  let totalAssets = 0;
  if (brandType === "product") {
    totalAssets = countAssetsInDir(path.join(brandDir, "product-images"));
  } else {
    for (const cat of ["screenshots", "team", "logos", "icons"]) {
      totalAssets += countAssetsInDir(path.join(brandDir, "brand-assets", cat));
    }
  }
  if (totalAssets >= LIMITS.MAX_TOTAL_ASSETS_PER_BRAND) {
    return {
      ok: false,
      message: `Total asset limit for this brand (${LIMITS.MAX_TOTAL_ASSETS_PER_BRAND}).`,
      code: "ASSET_TOTAL_LIMIT",
      status: 403,
    };
  }

  return checkStorageForWrite(email, fileSize);
}

export function checkResearchRun(email: string, brandName: string): QuotaResult {
  if (!canWriteBrand(email, brandName)) {
    return { ok: false, message: "You do not have permission to run research on this brand.", code: "FORBIDDEN", status: 403 };
  }
  const usage = readUserUsage(email);
  if (usage.daily.researchRuns >= LIMITS.MAX_RESEARCH_RUNS_PER_DAY) {
    return {
      ok: false,
      message: `Daily research limit reached (${LIMITS.MAX_RESEARCH_RUNS_PER_DAY}/day). Resets at midnight UTC.`,
      code: "RESEARCH_DAILY_LIMIT",
      status: 429,
      extra: { used: usage.daily.researchRuns, limit: LIMITS.MAX_RESEARCH_RUNS_PER_DAY },
    };
  }
  if (isPipelineBusy()) {
    return {
      ok: false,
      message: "Another pipeline is already running. Please wait for it to finish.",
      code: "PIPELINE_BUSY",
      status: 429,
    };
  }
  return checkStorageForWrite(email, mb(1));
}

export function checkGenerateRun(
  email: string,
  brandName: string,
  templateCount: number,
  variations: number,
  resolution: string
): QuotaResult {
  if (!canWriteBrand(email, brandName)) {
    return { ok: false, message: "You do not have permission to generate for this brand.", code: "FORBIDDEN", status: 403 };
  }
  const usage = readUserUsage(email);
  if (usage.daily.generateRuns >= LIMITS.MAX_GENERATE_RUNS_PER_DAY) {
    return {
      ok: false,
      message: `Daily generation limit reached (${LIMITS.MAX_GENERATE_RUNS_PER_DAY}/day). Resets at midnight UTC.`,
      code: "GENERATE_DAILY_LIMIT",
      status: 429,
      extra: { used: usage.daily.generateRuns, limit: LIMITS.MAX_GENERATE_RUNS_PER_DAY },
    };
  }
  if (templateCount > LIMITS.MAX_TEMPLATES_PER_GENERATE) {
    return {
      ok: false,
      message: `Select at most ${LIMITS.MAX_TEMPLATES_PER_GENERATE} templates per run.`,
      code: "TEMPLATE_LIMIT",
      status: 400,
    };
  }
  if (templateCount < 1) {
    return { ok: false, message: "Select at least one template.", code: "NO_TEMPLATES", status: 400 };
  }
  if (variations > LIMITS.MAX_VARIATIONS_PER_TEMPLATE) {
    return {
      ok: false,
      message: `Max ${LIMITS.MAX_VARIATIONS_PER_TEMPLATE} variations per template.`,
      code: "VARIATION_LIMIT",
      status: 400,
    };
  }
  if (!LIMITS.ALLOWED_RESOLUTIONS.includes(resolution as (typeof LIMITS.ALLOWED_RESOLUTIONS)[number])) {
    return {
      ok: false,
      message: `Resolution must be one of: ${LIMITS.ALLOWED_RESOLUTIONS.join(", ")}.`,
      code: "RESOLUTION_LIMIT",
      status: 400,
    };
  }
  const brandDir = path.join(BRANDS_ROOT, brandName);
  const currentGenerated = countGeneratedImages(brandDir);
  const newImages = templateCount * variations;
  if (currentGenerated + newImages > LIMITS.MAX_GENERATED_IMAGES_PER_BRAND) {
    return {
      ok: false,
      message: `Would exceed generated image limit (${LIMITS.MAX_GENERATED_IMAGES_PER_BRAND} per brand). Currently ${currentGenerated}.`,
      code: "GENERATED_LIMIT",
      status: 403,
      extra: { current: currentGenerated, limit: LIMITS.MAX_GENERATED_IMAGES_PER_BRAND },
    };
  }
  if (isPipelineBusy()) {
    return {
      ok: false,
      message: "Another pipeline is already running. Please wait for it to finish.",
      code: "PIPELINE_BUSY",
      status: 429,
    };
  }
  const estimatedBytes = newImages * LIMITS.ESTIMATED_IMAGE_BYTES;
  return checkStorageForWrite(email, estimatedBytes, brandName);
}

export function recordResearchRun(email: string) {
  const usage = readUserUsage(email);
  usage.daily.researchRuns += 1;
  writeUserUsage(usage);
}

export function recordGenerateRun(email: string) {
  const usage = readUserUsage(email);
  usage.daily.generateRuns += 1;
  writeUserUsage(usage);
}

interface PipelineLock {
  email: string;
  brand: string;
  action: string;
  startedAt: string;
  pid: number;
}

function readPipelineLock(): PipelineLock | null {
  ensureDataDirs();
  if (!fs.existsSync(PIPELINE_LOCK)) return null;
  try {
    return JSON.parse(fs.readFileSync(PIPELINE_LOCK, "utf-8")) as PipelineLock;
  } catch {
    return null;
  }
}

function isLockStale(lock: PipelineLock): boolean {
  const age = Date.now() - new Date(lock.startedAt).getTime();
  return age > LIMITS.PIPELINE_LOCK_TTL_MS;
}

function isProcessAlive(pid: number): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return code !== "ESRCH";
  }
}

/** Drop locks left behind when the client disconnects but the child already exited. */
export function reclaimStalePipelineLock(): void {
  const lock = readPipelineLock();
  if (!lock) return;
  if (isLockStale(lock) || !isProcessAlive(lock.pid)) {
    releasePipelineLock();
  }
}

function isPipelineBusy(): boolean {
  reclaimStalePipelineLock();
  const lock = readPipelineLock();
  return !!lock && !isLockStale(lock);
}

export function acquirePipelineLock(email: string, brand: string, action: string, pid: number) {
  ensureDataDirs();
  const lock: PipelineLock = {
    email,
    brand,
    action,
    startedAt: new Date().toISOString(),
    pid,
  };
  fs.writeFileSync(PIPELINE_LOCK, JSON.stringify(lock, null, 2), "utf-8");
}

export function releasePipelineLock() {
  if (fs.existsSync(PIPELINE_LOCK)) {
    try {
      fs.unlinkSync(PIPELINE_LOCK);
    } catch {
      /* ignore */
    }
  }
}

export function getPipelineStatus():
  | { running: false }
  | { running: true; brand: string; action: string; startedAt: string } {
  reclaimStalePipelineLock();
  const lock = readPipelineLock();
  if (!lock || isLockStale(lock)) {
    return { running: false };
  }
  return {
    running: true,
    brand: lock.brand,
    action: lock.action,
    startedAt: lock.startedAt,
  };
}

export function getUsageSummary(email: string): UsageSummary {
  const usage = readUserUsage(email);
  const now = Date.now();
  let rateRemaining = LIMITS.MAX_REQUESTS_PER_MINUTE;
  if (now - usage.rateWindowStart < 60_000) {
    rateRemaining = Math.max(0, LIMITS.MAX_REQUESTS_PER_MINUTE - usage.rateCount);
  }

  const isPublicVersion = process.env.PUBLIC_VERSION === "true";
  const allowedResolutions = isPublicVersion
    ? ["512", "1K"]
    : ["512", "1K", "2K", "4K"];

  return {
    brands: {
      used: countUserBrands(email),
      limit: LIMITS.MAX_BRANDS_PER_USER,
    },
    storage: {
      usedBytes: getUserStorageBytes(email),
      limitBytes: LIMITS.MAX_STORAGE_BYTES_PER_USER,
      globalUsedBytes: getGlobalStorageBytes(),
      globalLimitBytes: LIMITS.MAX_GLOBAL_STORAGE_BYTES,
    },
    daily: {
      research: { used: usage.daily.researchRuns, limit: LIMITS.MAX_RESEARCH_RUNS_PER_DAY },
      generate: { used: usage.daily.generateRuns, limit: LIMITS.MAX_GENERATE_RUNS_PER_DAY },
    },
    rateLimit: { remaining: rateRemaining, limit: LIMITS.MAX_REQUESTS_PER_MINUTE },
    limits: {
      maxUploadMb: LIMITS.MAX_UPLOAD_FILE_BYTES / (1024 * 1024),
      maxAssetsPerCategory: LIMITS.MAX_ASSETS_PER_CATEGORY,
      maxTemplatesPerGenerate: LIMITS.MAX_TEMPLATES_PER_GENERATE,
      maxVariations: LIMITS.MAX_VARIATIONS_PER_TEMPLATE,
      allowedResolutions,
    },
    ...(isPublicVersion
      ? {
          provider: {
            imageModel: LIMITS.PUBLIC_IMAGE_MODEL,
            secondsPerImage: LIMITS.PUBLIC_SECONDS_PER_IMAGE,
          },
        }
      : {}),
  };
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mb(n: number) {
  return n * 1024 * 1024;
}

export function enforceQuota(result: QuotaResult): NextResponse | null {
  if (result.ok) return null;
  return NextResponse.json(
    { success: false, error: result.message, code: result.code, ...result.extra },
    { status: result.status }
  );
}
