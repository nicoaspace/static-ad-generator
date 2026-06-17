import type { EligibilityStatus, TemplateEligibility } from "./types";

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

export function isImageFile(name: string): boolean {
  return IMAGE_EXT.test(name);
}

export function checkTemplateEligibility(
  prompts: Array<{
    template_number: number;
    template_name?: string;
    required_assets?: string[];
    preferred_assets?: string[];
    needs_product_images?: boolean;
  }>,
  populatedCategories: Set<string>,
  brandType: "product" | "service",
  productImageCount: number
): TemplateEligibility[] {
  return prompts.map((p) => {
    const name = p.template_name || `template-${p.template_number}`;

    if (brandType === "product") {
      if (p.needs_product_images && productImageCount === 0) {
        return {
          num: p.template_number,
          name,
          status: "blocked" as EligibilityStatus,
          missing_required: ["product-images"],
          missing_preferred: [],
        };
      }
      return {
        num: p.template_number,
        name,
        status: "ready" as EligibilityStatus,
        missing_required: [],
        missing_preferred: [],
      };
    }

    const required = new Set(p.required_assets || []);
    const preferred = new Set(p.preferred_assets || []);
    const missing_required = [...required].filter((c) => !populatedCategories.has(c));
    const missing_preferred = [...preferred].filter((c) => !populatedCategories.has(c));

    let status: EligibilityStatus = "ready";
    if (missing_required.length) status = "blocked";
    else if (missing_preferred.length) status = "partial";

    return {
      num: p.template_number,
      name,
      status,
      missing_required,
      missing_preferred,
    };
  });
}
