#!/usr/bin/env python3
"""
Static Ad Generator — Pipeline Part 1: Research (Phase 0 + Phase 1)

Sets up the brand folder and runs brand research to generate the Brand DNA.
After this script finishes, upload your images before running pipeline_generate.py.

Lives permanently at skills/references/pipeline_research.py.

Usage:
    python skills/references/pipeline_research.py --brand le-car --url https://lecar.com.co/ --product "Mantenimiento Correctivo" --type service
    python skills/references/pipeline_research.py --brand lmnt --url https://drinklmnt.com/ --product "LMNT Recharge" --type product

Environment:
    ANTHROPIC_API_KEY  — Anthropic API key (for Phase 1 research)
                         Or place it in env/.env.local as ANTHROPIC_API_KEY=your-key
"""

import argparse
import sys
import time

from config import load_anthropic_key, brand_path
from phase0_setup import setup_brand
from phase1_brand_dna import generate_brand_dna


def run_research(brand_name: str, url: str, product: str,
                 brand_type: str = "product",
                 model: str = "claude-sonnet-4-20250514") -> dict:
    """
    Run Phase 0 (setup) + Phase 1 (research).

    After this completes, the user must upload images before running pipeline_generate.py.

    Args:
        brand_name: Brand identifier (folder name under brands/)
        url: Brand's main website URL
        product: Specific product or service name
        brand_type: "product" or "service"
        model: Claude model for Phase 1

    Returns:
        Dict with paths and timing for each phase.
    """
    start_total = time.time()
    results = {}

    print(f"\n{'#'*60}")
    print(f"#  PIPELINE — RESEARCH")
    print(f"#  Brand: {brand_name} ({brand_type})")
    print(f"#  URL:   {url}")
    print(f"#  Product: {product}")
    print(f"{'#'*60}")

    # Validate API key
    if not load_anthropic_key():
        sys.exit("Error: ANTHROPIC_API_KEY not found. Set it as env var or in env/.env.local")

    # Phase 0: Setup
    start = time.time()
    brand_dir = setup_brand(brand_name, url, product, brand_type)
    results["phase0"] = {"path": brand_dir, "time": time.time() - start}

    # Phase 1: Brand DNA
    start = time.time()
    dna_path = generate_brand_dna(brand_name, url, product, brand_type, model)
    results["phase1"] = {"path": dna_path, "time": time.time() - start}

    # Summary
    total_time = time.time() - start_total
    bp = brand_path(brand_name)

    print(f"\n{'#'*60}")
    print(f"#  RESEARCH COMPLETE — {brand_name}")
    print(f"{'#'*60}")
    print(f"  Phase 0 (setup):     {results['phase0']['time']:.1f}s")
    print(f"  Phase 1 (research):  {results['phase1']['time']:.1f}s")
    print(f"  Total:               {total_time:.1f}s")
    print(f"\n  Brand DNA: {results['phase1']['path']}")

    if brand_type == "product":
        print(f"\n  NEXT STEP: Upload product images to:")
        print(f"    {bp / 'product-images'}/")
    else:
        print(f"\n  NEXT STEP: Upload assets to:")
        print(f"    {bp / 'brand-assets' / 'screenshots'}/  ← app/website screenshots")
        print(f"    {bp / 'brand-assets' / 'logos'}/        ← brand logo, partner logos")
        print(f"    {bp / 'brand-assets' / 'icons'}/        ← feature icons")
        print(f"    {bp / 'brand-assets' / 'team'}/         ← team photos (optional)")

    print(f"\n  Then run:")
    print(f"    python skills/references/pipeline_generate.py --brand {brand_name} --type {brand_type}")
    print(f"{'#'*60}\n")

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Pipeline Part 1: Phase 0 (setup) + Phase 1 (brand research)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
After this script finishes, upload your images, then run pipeline_generate.py.

Examples:
  python skills/references/pipeline_research.py --brand lmnt --url https://drinklmnt.com/ --product "LMNT Recharge" --type product
  python skills/references/pipeline_research.py --brand le-car --url https://lecar.com.co/ --product "Mantenimiento Correctivo" --type service
""",
    )
    parser.add_argument("--brand", required=True, help="Brand identifier (folder name under brands/)")
    parser.add_argument("--url", required=True, help="Brand's main website URL")
    parser.add_argument("--product", required=True, help="Specific product or service name")
    parser.add_argument("--type", choices=["product", "service"], default="product",
                        help="Brand type: product or service (default: product)")
    parser.add_argument("--model", default="claude-sonnet-4-20250514",
                        help="Claude model for Phase 1")

    args = parser.parse_args()

    run_research(
        brand_name=args.brand,
        url=args.url,
        product=args.product,
        brand_type=args.type,
        model=args.model,
    )


if __name__ == "__main__":
    main()
