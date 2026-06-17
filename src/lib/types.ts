export interface Brand {
  name: string;
  brandType: "product" | "service";
  url: string;
  productName: string;
  hasDna: boolean;
  hasPrompts: boolean;
  assetCount: number;
  assetCounts: Record<string, number>;
  generatedImageCount: number;
  isOwner?: boolean;
}

export interface UsageSummary {
  brands: { used: number; limit: number };
  storage: {
    usedBytes: number;
    limitBytes: number;
    globalUsedBytes: number;
    globalLimitBytes: number;
  };
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

export interface AssetFile {
  file: string;
  url: string;
}

export interface GalleryImage {
  template: string;
  file: string;
  url: string;
  modifiedAt?: number;
}

export interface GenerationRun {
  startedAt: number;
  templates: number[];
  variations: number;
  templateFolders: string[];
  resolution: string;
}

export interface PromptItem {
  template_number: number;
  template_name: string;
  prompt: string;
  aspect_ratio: string;
  needs_product_images?: boolean;
  required_assets?: string[];
  preferred_assets?: string[];
  notes?: string;
}

export interface PromptsJson {
  brand: string;
  brand_type: string;
  product: string;
  generated_at: string;
  prompt_modifier: string;
  prompts: PromptItem[];
}

export type EligibilityStatus = "ready" | "partial" | "blocked";

export interface TemplateEligibility {
  num: number;
  name: string;
  status: EligibilityStatus;
  missing_required: string[];
  missing_preferred: string[];
}
