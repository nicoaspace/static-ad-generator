#!/usr/bin/env python3
"""
Static Ad Generator — Pipeline Part 2: Generate (Phase 2 + Phase 3)

Generates prompts from the Brand DNA and runs image generation.
Run this AFTER pipeline_research.py and AFTER uploading your images.

Lives permanently at skills/references/pipeline_generate.py.

Usage:
    python skills/references/pipeline_generate.py --brand le-car --type service
    python skills/references/pipeline_generate.py --brand lmnt --type product --templates 1,7,9,13,15 --resolution 1K --variations 2
    python skills/references/pipeline_generate.py --brand lmnt --type product --dry-run

Environment:
    PUBLIC_VERSION=true  → OPENROUTER_API_KEY (LLM + images via Grok Imagine)
    PUBLIC_VERSION=false → GOOGLE_API_KEY (LLM + images)
                         Or place keys in env/.env.local
"""

import argparse
import subprocess
import sys
import time

from config import (
    PROJECT_ROOT, SCRIPT_DIR, BRANDS_ROOT,
    brand_path, emit_progress, get_default_resolution, get_llm_default_model,
    get_resolution_choices, missing_llm_api_key, scan_brand_assets,
)
from phase2_prompt_gen import generate_prompts


def run_phase3(brand_name: str, brand_type: str, templates: str | None = None,
               resolution: str = "512", variations: int = 2,
               dry_run: bool = False) -> int:
    """Run Phase 3 (generate_ads.py) as a subprocess. Returns exit code."""
    script = SCRIPT_DIR / "generate_ads.py"

    cmd = [
        sys.executable, "-u", str(script),
        "--brand", brand_name,
        "--type", brand_type,
        "--resolution", resolution,
        "--variations", str(variations),
    ]
    if templates:
        cmd.extend(["--templates", templates])
    if dry_run:
        cmd.append("--dry-run")

    print(f"\n{'='*60}")
    print(f"Phase 3: Image Generation")
    print(f"{'='*60}")
    print(f"  Command: {' '.join(cmd)}")
    print(f"{'='*60}\n")

    emit_progress(32, "Starting image generation…", phase="phase3")

    proc = subprocess.Popen(cmd, cwd=str(PROJECT_ROOT))
    return proc.wait()


def _check_images(brand_name: str, brand_type: str) -> bool:
    """Check that the user has uploaded images. Warn if empty."""
    bp = brand_path(brand_name)

    if brand_type == "product":
        img_dir = bp / "product-images"
        from config import IMAGE_EXTENSIONS
        count = 0
        if img_dir.is_dir():
            for ext in IMAGE_EXTENSIONS:
                count += len(list(img_dir.glob(ext)))
        if count == 0:
            print(f"\n  ⚠ WARNING: No images found in brands/{brand_name}/product-images/")
            print(f"    Phase 3 will run text-only (lower quality).")
            print(f"    Upload product images first for best results.\n")
            return False
        print(f"\n  ✓ Found {count} product image(s) in brands/{brand_name}/product-images/")
        return True
    else:
        assets = scan_brand_assets(bp)
        total = sum(assets.values())
        if total == 0:
            print(f"\n  ⚠ WARNING: No assets found in brands/{brand_name}/brand-assets/")
            print(f"    Most templates will be skipped or run text-only.")
            print(f"    Upload assets first for best results.\n")
            return False
        print(f"\n  ✓ Brand assets scan:")
        for cat, count in assets.items():
            status = f"✓ {count} image(s)" if count > 0 else "✗ empty"
            print(f"    {cat + '/':15s} {status}")
        return True


def run_generate(brand_name: str, brand_type: str = "product",
                 product_name: str | None = None,
                 model: str | None = None,
                 templates: str | None = None,
                 resolution: str = "512", variations: int = 2,
                 dry_run: bool = False) -> dict:
    """
    Run Phase 2 (prompts) + Phase 3 (images).

    Args:
        brand_name: Brand identifier (folder name under brands/)
        brand_type: "product" or "service"
        product_name: Override product name (default: from brand-dna.md)
        model: LLM model for Phase 2 (default: provider-specific)
        templates: Comma-separated template numbers for Phase 3
        resolution: Image resolution for Phase 3
        variations: Images per template
        dry_run: Phase 3 dry-run mode

    Returns:
        Dict with status and timing for each phase.
    """
    start_total = time.time()
    results = {}

    # Validate brand DNA exists
    dna_file = brand_path(brand_name) / "brand-dna.md"
    if not dna_file.exists():
        sys.exit(
            f"Error: Brand DNA not found at {dna_file}\n"
            f"  Run pipeline_research.py first."
        )

    print(f"\n{'#'*60}")
    print(f"#  PIPELINE — GENERATE")
    print(f"#  Brand: {brand_name} ({brand_type})")
    print(f"{'#'*60}")

    emit_progress(2, "Validating brand and API keys…", phase="init")

    resolved_model = model or get_llm_default_model()

    # Validate API keys
    missing = missing_llm_api_key()
    if missing:
        sys.exit(f"Error: {missing} not found. Set it as env var or in env/.env.local")

    # Check images
    _check_images(brand_name, brand_type)

    prompts_file = brand_path(brand_name) / "prompts.json"

    # Phase 2: Prompt Generation (skip when prompts.json already exists)
    start = time.time()
    if prompts_file.exists():
        print(f"\n  ✓ Found existing prompts.json — skipping Phase 2")
        emit_progress(30, "Using saved prompts — starting image generation…", phase="phase2")
        prompts_path = str(prompts_file)
        results["phase2"] = {"path": prompts_path, "time": 0, "skipped": True}
    else:
        emit_progress(8, "Checking uploaded assets…", phase="phase2")
        emit_progress(12, "Generating prompts with AI (this may take a minute)…", phase="phase2")
        prompts_path = generate_prompts(brand_name, brand_type, product_name, resolved_model)
        results["phase2"] = {"path": prompts_path, "time": time.time() - start}
        emit_progress(30, "Prompts ready — starting image generation…", phase="phase2")

    # Phase 3: Image Generation
    start = time.time()
    exit_code = run_phase3(brand_name, brand_type, templates, resolution,
                           variations, dry_run)
    results["phase3"] = {
        "exit_code": exit_code,
        "time": time.time() - start,
        "dry_run": dry_run,
    }

    if exit_code != 0:
        emit_progress(100, "Image generation failed.", phase="error")
        sys.exit(exit_code)

    emit_progress(100, "Generation complete!", phase="done")

    # Summary
    total_time = time.time() - start_total
    print(f"\n{'#'*60}")
    print(f"#  GENERATE COMPLETE — {brand_name}")
    print(f"{'#'*60}")
    print(f"  Phase 2 (prompts):  {results['phase2']['time']:.1f}s")
    p3 = results["phase3"]
    mode = "dry-run" if p3["dry_run"] else f"exit={p3['exit_code']}"
    print(f"  Phase 3 (images):   {p3['time']:.1f}s ({mode})")
    print(f"  Total:              {total_time:.1f}s")
    print(f"\n  Outputs: {brand_path(brand_name) / 'outputs'}")
    print(f"{'#'*60}\n")

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Pipeline Part 2: Phase 2 (prompts) + Phase 3 (images)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Run this AFTER pipeline_research.py and AFTER uploading images.

Examples:
  python skills/references/pipeline_generate.py --brand lmnt --type product
  python skills/references/pipeline_generate.py --brand le-car --type service --templates 1,7,9,13,15 --resolution 1K --variations 2
  python skills/references/pipeline_generate.py --brand lmnt --type product --dry-run
""",
    )
    parser.add_argument("--brand", required=True, help="Brand identifier (folder name under brands/)")
    parser.add_argument("--type", choices=["product", "service"], default="product",
                        help="Brand type: product or service (default: product)")
    parser.add_argument("--product", default=None,
                        help="Override product name (default: from brand-dna.md)")
    parser.add_argument("--model", default=None,
                        help=f"LLM model for Phase 2 (default: {get_llm_default_model()})")
    parser.add_argument("--templates", metavar="1,7,13",
                        help="Comma-separated template numbers for Phase 3 (default: all)")
    parser.add_argument("--resolution", default=get_default_resolution(),
                        choices=list(get_resolution_choices()),
                        help=f"Image resolution for Phase 3 (default: {get_default_resolution()})")
    parser.add_argument("--variations", type=int, default=2,
                        help="Images per template for Phase 3 (default: 2)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Phase 3 dry-run mode (no API calls for images)")

    args = parser.parse_args()

    run_generate(
        brand_name=args.brand,
        brand_type=args.type,
        product_name=args.product,
        model=args.model or get_llm_default_model(),
        templates=args.templates,
        resolution=args.resolution,
        variations=args.variations,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
