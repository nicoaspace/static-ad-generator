/**
 * Platform limits tuned for a shared hobby VPS (~2 GB disk, 3–4 projects).
 * Adjust via env vars where noted; defaults are intentionally restrictive.
 */

const mb = (n: number) => n * 1024 * 1024;

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const LIMITS = {
  /** Brands a single user may own */
  MAX_BRANDS_PER_USER: envInt("LIMIT_MAX_BRANDS_PER_USER", 2),

  /** Total disk for one user's owned brands */
  MAX_STORAGE_BYTES_PER_USER: envInt("LIMIT_MAX_STORAGE_MB_PER_USER", 40) * 1024 * 1024,

  /** Total disk for this app's brands/ directory (all users) */
  MAX_GLOBAL_STORAGE_BYTES: envInt("LIMIT_MAX_GLOBAL_STORAGE_MB", 150) * 1024 * 1024,

  /** Per-file upload cap */
  MAX_UPLOAD_FILE_BYTES: envInt("LIMIT_MAX_UPLOAD_MB", 4) * 1024 * 1024,

  /** Images per asset folder (product-images or brand-assets/{cat}) */
  MAX_ASSETS_PER_CATEGORY: envInt("LIMIT_MAX_ASSETS_PER_CATEGORY", 8),

  /** Total uploaded assets across all categories in one brand */
  MAX_TOTAL_ASSETS_PER_BRAND: envInt("LIMIT_MAX_TOTAL_ASSETS_PER_BRAND", 24),

  /** Generated PNGs per brand */
  MAX_GENERATED_IMAGES_PER_BRAND: envInt("LIMIT_MAX_GENERATED_IMAGES_PER_BRAND", 36),

  /** Templates allowed in a single generate run */
  MAX_TEMPLATES_PER_GENERATE: envInt("LIMIT_MAX_TEMPLATES_PER_GENERATE", 3),

  /** Variations per template (server-enforced) */
  MAX_VARIATIONS_PER_TEMPLATE: envInt("LIMIT_MAX_VARIATIONS", 2),

  /** Research pipeline runs per user per UTC day */
  MAX_RESEARCH_RUNS_PER_DAY: envInt("LIMIT_MAX_RESEARCH_PER_DAY", 1),

  /** Generate pipeline runs per user per UTC day */
  MAX_GENERATE_RUNS_PER_DAY: envInt("LIMIT_MAX_GENERATE_PER_DAY", 3),

  /** Authenticated API calls per user per minute */
  MAX_REQUESTS_PER_MINUTE: envInt("LIMIT_MAX_REQUESTS_PER_MINUTE", 20),

  /** Only one pipeline process at a time (global) */
  MAX_CONCURRENT_PIPELINES: 1,

  /** Max age of a stale pipeline lock before it can be reclaimed (ms) */
  PIPELINE_LOCK_TTL_MS: 45 * 60 * 1000,

  /** Rough bytes per generated image for pre-flight storage checks */
  ESTIMATED_IMAGE_BYTES: mb(0.5),

  /** Rough seconds for Phase 2 (LLM prompt generation) */
  ESTIMATED_PHASE2_SECONDS: 60,

  /** Rough seconds per generated image, by resolution (private Gemini stack) */
  ESTIMATED_SECONDS_PER_IMAGE: {
    "512": 50,
    "1K": 75,
    "2K": 90,
    "4K": 120,
  } as Record<string, number>,

  /** OpenRouter Grok Imagine benchmark latency per image (public stack) */
  PUBLIC_SECONDS_PER_IMAGE: 7.99,
  PUBLIC_IMAGE_MODEL: "Grok Imagine",

  ALLOWED_UPLOAD_MIME: new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
  ]),

  ALLOWED_RESOLUTIONS: ["512", "1K"] as const,
} as const;

export type AllowedResolution = (typeof LIMITS.ALLOWED_RESOLUTIONS)[number];
