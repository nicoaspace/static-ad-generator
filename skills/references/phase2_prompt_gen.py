#!/usr/bin/env python3
"""
Static Ad Generator — Phase 2: Prompt Generation

Uses Claude API to fill 40 template prompts with brand-specific details
from the Brand DNA document. No web search needed — pure text generation.

Lives permanently at skills/references/phase2_prompt_gen.py.
Run it from anywhere — pass --brand and --type.

Requirements:
    pip install anthropic

Usage:
    python skills/references/phase2_prompt_gen.py --brand lmnt --type product
    python skills/references/phase2_prompt_gen.py --brand siigo --type service
    python skills/references/phase2_prompt_gen.py --brand siigo --type service --product "Siigo Nómina Electrónica"

Environment:
    ANTHROPIC_API_KEY  — Anthropic API key
                         Or place it in env/.env.local as ANTHROPIC_API_KEY=your-key
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import anthropic
except ImportError:
    print("Error: 'anthropic' package required.  pip install anthropic")
    sys.exit(1)

from config import (
    BRANDS_ROOT,
    PRODUCT_TEMPLATES,
    SERVICE_TEMPLATES,
    load_anthropic_key,
    brand_path,
    list_brands_with_dna,
    scan_brand_assets,
)

# ──────────────────────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────────────────────

DEFAULT_MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS    = 64000   # prompts.json can be large (40 templates × ~500 words each)

# ──────────────────────────────────────────────────────────────────────────────
# System prompts — exact replicas from SKILL.md
# ──────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT_PRODUCT = """\
You are a senior creative strategist specializing in ad creative generation. Your task is to take 40 template prompts and fill them in with brand-specific details for a specific product, using the Brand DNA document as your primary reference.

For each template:
1. Replace all [BRACKETED PLACEHOLDERS] with brand-specific details
2. Prepend the Image Generation Prompt Modifier from the Brand DNA to every prompt
3. Set the correct aspect_ratio based on the template (most are 1:1, 4:5, or 9:16)
4. Determine if the template needs product reference images (needs_product_images: true/false):
   - Templates describing the actual product packaging visible on-screen = true
   - Templates that are pure lifestyle/UGC/editorial with no product shown = false
5. Include the product name and any specific product details from the Brand DNA
6. For templates with needs_product_images: true, include this instruction in the prompt: "Use the attached images as brand reference. Match the exact product colors, typography style, and brand tone precisely."

Make the copy compelling, specific, and true to the brand voice from the Brand DNA. Use real brand details (hex colors, font names, product specs, taglines) — never leave generic placeholders.

Output ONLY valid JSON with this exact structure (no markdown fences, no commentary):
{
  "brand": "Brand Name",
  "brand_type": "product",
  "product": "Specific Product Name",
  "generated_at": "ISO timestamp",
  "prompt_modifier": "The Image Generation Prompt Modifier from Brand DNA",
  "prompts": [
    {
      "template_number": 1,
      "template_name": "headline",
      "prompt": "Full completed prompt text ready for image generation...",
      "aspect_ratio": "4:5",
      "needs_product_images": true,
      "notes": "Any generation notes or copy refinement tips"
    }
  ]
}

CRITICAL: Output ONLY the JSON object. No markdown code fences. No explanation before or after."""

SYSTEM_PROMPT_SERVICE = """\
You are a senior creative strategist specializing in ad creative generation for SaaS and digital services. Your task is to take 40 service template prompts and fill them in with brand-specific details, using the Brand DNA document as your primary reference.

For each template:
1. Replace all [BRACKETED PLACEHOLDERS] with brand-specific details (UI elements, dashboard names, feature names, etc.)
2. Prepend the Image Generation Prompt Modifier from the Brand DNA to every prompt
3. Set the correct aspect_ratio based on the template
4. Set required_assets and preferred_assets per template as specified in the template definitions
5. Include the product/service name and specific feature details from the Brand DNA
6. For templates with required_assets, include this instruction in the prompt: "Use the attached images as brand reference. Match the exact brand colors, typography style, and UI design precisely."

The following brand asset categories are available (populated with images):
{available_assets}

The following brand asset categories are EMPTY (no images):
{empty_assets}

ASSET-AWARE FILTERING: For templates whose required_assets include an empty category, still generate the prompt but it will be placed in the "skipped" array. Generate ALL 40 templates regardless — the filtering will be applied in post-processing.

Make the copy compelling, specific, and true to the brand voice from the Brand DNA. Use real brand details (hex colors, font names, UI descriptions, taglines, pricing) — never leave generic placeholders.

Output ONLY valid JSON with this exact structure (no markdown fences, no commentary):
{
  "brand": "Brand Name",
  "brand_type": "service",
  "product": "Specific Product/Plan Name",
  "generated_at": "ISO timestamp",
  "prompt_modifier": "The Image Generation Prompt Modifier from Brand DNA",
  "asset_scan": {
    "screenshots": "✓ N image(s)" or "✗ empty",
    "logos": "...",
    "icons": "...",
    "team": "..."
  },
  "prompts": [
    {
      "template_number": 1,
      "template_name": "headline-ui-hero",
      "prompt": "Full completed prompt text ready for image generation...",
      "aspect_ratio": "4:5",
      "required_assets": ["screenshots"],
      "preferred_assets": ["logos"],
      "notes": "Any generation notes"
    }
  ],
  "skipped": [
    {
      "template_number": 19,
      "template_name": "highlighted-testimonial",
      "reason": "Requires team/ assets (folder empty)"
    }
  ]
}

CRITICAL: Output ONLY the JSON object. No markdown code fences. No explanation before or after."""


# ──────────────────────────────────────────────────────────────────────────────
# Claude API — Prompt Generation
# ──────────────────────────────────────────────────────────────────────────────

def _build_user_message(brand_name: str, brand_type: str, product_name: str,
                        brand_dna: str, templates: str) -> str:
    """Build the user message with brand DNA and template file."""
    return f"""Generate the complete prompts.json for the brand "{brand_name}".

Brand: {brand_name}
Product/Service: {product_name}
Brand type: {brand_type}
Generated at: {datetime.now(timezone.utc).isoformat()}

--- BRAND DNA DOCUMENT ---
{brand_dna}
--- END BRAND DNA ---

--- TEMPLATE PROMPTS FILE ---
{templates}
--- END TEMPLATES ---

Now fill in ALL 40 templates with {brand_name}-specific details. Output the complete JSON."""


def _extract_json(text: str) -> dict:
    """Extract and parse JSON from Claude's response, handling markdown fences."""
    # Try direct parse first
    text = text.strip()
    if text.startswith("{"):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

    # Try extracting from markdown code fence
    match = re.search(r'```(?:json)?\s*\n(.*?)\n```', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Try finding the JSON object boundaries
    start = text.find("{")
    if start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start:i+1])
                    except json.JSONDecodeError:
                        break

    raise ValueError("Could not extract valid JSON from Claude's response")


def run_prompt_generation(brand_name: str, brand_type: str, product_name: str,
                          brand_dna: str, templates: str,
                          asset_scan: dict[str, int] | None,
                          api_key: str, model: str = DEFAULT_MODEL) -> dict:
    """
    Call Claude API to generate prompts.json from brand DNA + templates.

    Returns parsed JSON dict ready to save.
    """
    client = anthropic.Anthropic(api_key=api_key)

    # Build system prompt
    if brand_type == "product":
        system_prompt = SYSTEM_PROMPT_PRODUCT
    else:
        # Inject asset availability into service system prompt
        available = []
        empty = []
        if asset_scan:
            for cat, count in asset_scan.items():
                if count > 0:
                    available.append(f"  - {cat}/: {count} image(s)")
                else:
                    empty.append(f"  - {cat}/: empty")
        system_prompt = SYSTEM_PROMPT_SERVICE.format(
            available_assets="\n".join(available) if available else "  (none populated)",
            empty_assets="\n".join(empty) if empty else "  (all populated)",
        )

    user_message = _build_user_message(brand_name, brand_type, product_name,
                                        brand_dna, templates)

    print(f"  Sending to Claude ({model})...")
    print(f"  Input size: ~{len(user_message):,} chars")

    response = client.messages.create(
        model=model,
        max_tokens=MAX_TOKENS,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    # Extract text from response
    full_text = ""
    for block in response.content:
        if hasattr(block, "text") and block.text:
            full_text += block.text

    print(f"  Response: {len(full_text):,} chars, stop_reason={response.stop_reason}")

    # Parse JSON
    result = _extract_json(full_text)

    # Validate structure
    if "prompts" not in result:
        raise ValueError("Response JSON missing 'prompts' array")

    prompt_count = len(result["prompts"])
    print(f"  ✓ Parsed {prompt_count} template prompt(s)")

    return result


def _post_process_service(data: dict, asset_scan: dict[str, int]) -> dict:
    """
    Post-process service brand prompts.json:
    - Inject asset_scan summary
    - Move templates with unsatisfied required_assets to skipped array
    """
    # Build asset_scan display
    data["asset_scan"] = {
        cat: f"✓ {count} image(s)" if count > 0 else "✗ empty"
        for cat, count in asset_scan.items()
    }

    empty_categories = {cat for cat, count in asset_scan.items() if count == 0}

    # Filter prompts — move blocked ones to skipped
    kept = []
    skipped = data.get("skipped", [])

    for p in data.get("prompts", []):
        required = set(p.get("required_assets", []))
        missing = required & empty_categories
        if missing:
            skipped.append({
                "template_number": p["template_number"],
                "template_name": p["template_name"],
                "reason": f"Requires {', '.join(sorted(missing))}/ assets (folder empty)",
            })
        else:
            kept.append(p)

    data["prompts"] = kept
    data["skipped"] = skipped

    return data


# ──────────────────────────────────────────────────────────────────────────────
# Main orchestrator
# ──────────────────────────────────────────────────────────────────────────────

def generate_prompts(brand_name: str, brand_type: str = "product",
                     product_name: str | None = None,
                     model: str = DEFAULT_MODEL) -> str:
    """
    Full Phase 2 pipeline: read DNA + templates → Claude → save prompts.json.

    Args:
        brand_name: Brand identifier (folder name under brands/)
        brand_type: "product" or "service"
        product_name: Override product name (default: read from brand-dna.md header)
        model: Claude model to use

    Returns:
        Path to the generated prompts.json file.
    """
    api_key = load_anthropic_key()
    if not api_key:
        print("Error: ANTHROPIC_API_KEY not found.")
        print("  Set it as an environment variable or in env/.env.local")
        sys.exit(1)

    brand_dir = brand_path(brand_name)
    dna_file = brand_dir / "brand-dna.md"
    output_file = brand_dir / "prompts.json"

    # Validate brand DNA exists
    if not dna_file.exists():
        print(f"Error: Brand DNA not found at {dna_file}")
        print(f"  Run Phase 1 first: python skills/references/phase1_brand_dna.py --brand {brand_name} ...")
        available = list_brands_with_dna()
        if available:
            print(f"  Brands with DNA ready: {', '.join(available)}")
        sys.exit(1)

    # Select template file
    template_file = PRODUCT_TEMPLATES if brand_type == "product" else SERVICE_TEMPLATES
    if not template_file.exists():
        print(f"Error: Template file not found at {template_file}")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"Phase 2: Prompt Generation")
    print(f"{'='*60}")
    print(f"  Brand:     {brand_name}")
    print(f"  Type:      {brand_type}")
    print(f"  Model:     {model}")
    print(f"  DNA:       {dna_file}")
    print(f"  Templates: {template_file.name}")
    print(f"  Output:    {output_file}")

    # Read inputs
    brand_dna = dna_file.read_text(encoding="utf-8")
    templates = template_file.read_text(encoding="utf-8")

    # Infer product name from brand DNA if not provided
    if not product_name:
        # Try to extract from header like "# LMNT — LMNT Recharge Electrolyte Drink"
        match = re.search(r'^#.*?—\s*(.+)$', brand_dna, re.MULTILINE)
        if match:
            product_name = match.group(1).strip()
        else:
            product_name = brand_name  # Fallback

    print(f"  Product:   {product_name}")

    # Scan assets for service brands
    asset_scan = None
    if brand_type == "service":
        asset_scan = scan_brand_assets(brand_dir)
        print(f"\n  Brand assets scan:")
        for cat, count in asset_scan.items():
            status = f"✓ {count} image(s)" if count > 0 else "✗ empty"
            print(f"    {cat + '/':15s} {status}")

    print(f"{'='*60}")

    # Generate prompts via Claude
    print(f"\n▸ Generating prompts via Claude...")
    start = time.time()
    result = run_prompt_generation(
        brand_name=brand_name,
        brand_type=brand_type,
        product_name=product_name,
        brand_dna=brand_dna,
        templates=templates,
        asset_scan=asset_scan,
        api_key=api_key,
        model=model,
    )
    elapsed = time.time() - start
    print(f"  ✓ Generation completed ({elapsed:.1f}s)")

    # Post-process service brands (filter by available assets)
    if brand_type == "service" and asset_scan:
        result = _post_process_service(result, asset_scan)
        skipped_count = len(result.get("skipped", []))
        kept_count = len(result["prompts"])
        print(f"\n  Asset filtering: {kept_count} templates ready, {skipped_count} skipped")
        if skipped_count > 0:
            for s in result["skipped"]:
                print(f"    ✗ #{s['template_number']:02d} {s['template_name']}: {s['reason']}")

    # Save prompts.json
    print(f"\n▸ Saving prompts.json...")
    output_file.write_text(
        json.dumps(result, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    prompt_count = len(result["prompts"])
    print(f"  ✓ Saved {prompt_count} prompts to {output_file}")

    print(f"\n{'='*60}")
    print(f"Phase 2 complete! Prompts saved to:")
    print(f"  {output_file}")
    print(f"\nNext step — run Phase 3:")
    if brand_type == "service":
        print(f"  python skills/references/generate_ads.py --brand {brand_name} --type service --dry-run")
        print(f"  python skills/references/generate_ads.py --brand {brand_name} --type service")
    else:
        print(f"  python skills/references/generate_ads.py --brand {brand_name} --type product --dry-run")
        print(f"  python skills/references/generate_ads.py --brand {brand_name} --type product")
    print(f"{'='*60}\n")

    return str(output_file)


# ──────────────────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Phase 2: Template-Specific Prompt Generation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  python skills/references/phase2_prompt_gen.py --brand lmnt --type product
  python skills/references/phase2_prompt_gen.py --brand siigo --type service
  python skills/references/phase2_prompt_gen.py --brand siigo --type service --product "Siigo Nómina"
""",
    )
    parser.add_argument("--brand", required=True, help="Brand identifier (folder name under brands/)")
    parser.add_argument("--type", choices=["product", "service"], default="product",
                        help="Brand type: product (physical) or service (SaaS/digital)")
    parser.add_argument("--product", default=None,
                        help="Override product name (default: inferred from brand-dna.md)")
    parser.add_argument("--model", default=DEFAULT_MODEL,
                        help=f"Claude model to use (default: {DEFAULT_MODEL})")

    args = parser.parse_args()

    generate_prompts(
        brand_name=args.brand,
        brand_type=args.type,
        product_name=args.product,
        model=args.model,
    )


if __name__ == "__main__":
    main()
