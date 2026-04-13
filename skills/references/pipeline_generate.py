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
    ANTHROPIC_API_KEY  — for Phase 2 (Claude API)
    GOOGLE_API_KEY     — for Phase 3 (Gemini API)
    Or place both in env/.env.local
"""

import argparse
import subprocess
import sys
import time

from config import (
    PROJECT_ROOT, SCRIPT_DIR, BRANDS_ROOT,
    load_anthropic_key, load_google_key, brand_path, scan_brand_assets,
)
from phase2_prompt_gen import generate_prompts


def run_phase3(brand_name: str, brand_type: str, templates: str | None = None,
               resolution: str = "1K", variations: int = 4,
               dry_run: bool = False) -> int:
    """Run Phase 3 (generate_ads.py) as a subprocess. Returns exit code."""
    script = SCRIPT_DIR / "generate_ads.py"

    cmd = [
        sys.executable, str(script),
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

    result = subprocess.run(cmd, cwd=str(PROJECT_ROOT))
    return result.returncode


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
                 model: str = "claude-sonnet-4-20250514",
                 templates: str | None = None,
                 resolution: str = "1K", variations: int = 4,
                 dry_run: bool = False) -> dict:
    """
    Run Phase 2 (prompts) + Phase 3 (images).

    Args:
        brand_name: Brand identifier (folder name under brands/)
        brand_type: "product" or "service"
        product_name: Override product name (default: from brand-dna.md)
        model: Claude model for Phase 2
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

    # Validate API keys
    if not load_anthropic_key():
        sys.exit("Error: ANTHROPIC_API_KEY not found. Set it as env var or in env/.env.local")
    if not dry_run and not load_google_key():
        sys.exit("Error: GOOGLE_API_KEY not found. Set it as env var or in env/.env.local")

    # Check images
    _check_images(brand_name, brand_type)

    # Phase 2: Prompt Generation
    start = time.time()
    prompts_path = generate_prompts(brand_name, brand_type, product_name, model)
    results["phase2"] = {"path": prompts_path, "time": time.time() - start}

    # Phase 3: Image Generation
    start = time.time()
    exit_code = run_phase3(brand_name, brand_type, templates, resolution,
                           variations, dry_run)
    results["phase3"] = {
        "exit_code": exit_code,
        "time": time.time() - start,
        "dry_run": dry_run,
    }

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
    parser.add_argument("--model", default="claude-sonnet-4-20250514",
                        help="Claude model for Phase 2")
    parser.add_argument("--templates", metavar="1,7,13",
                        help="Comma-separated template numbers for Phase 3 (default: all)")
    parser.add_argument("--resolution", default="1K", choices=["512", "1K", "2K", "4K"],
                        help="Image resolution for Phase 3 (default: 1K)")
    parser.add_argument("--variations", type=int, default=4,
                        help="Images per template for Phase 3 (default: 4)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Phase 3 dry-run mode (no API calls for images)")

    args = parser.parse_args()

    run_generate(
        brand_name=args.brand,
        brand_type=args.type,
        product_name=args.product,
        model=args.model,
        templates=args.templates,
        resolution=args.resolution,
        variations=args.variations,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
