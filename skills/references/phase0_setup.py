#!/usr/bin/env python3
"""
Static Ad Generator — Phase 0: Brand Folder Setup

Creates the brand directory structure with all expected subfolders
based on brand type (product or service).

Lives permanently at skills/references/phase0_setup.py.

Usage:
    python skills/references/phase0_setup.py --brand lmnt --url https://drinklmnt.com/ --product "LMNT Recharge" --type product
    python skills/references/phase0_setup.py --brand siigo --url https://siigo.com/ --product "Siigo Facturación Electrónica" --type service
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from config import BRANDS_ROOT, brand_path

# ──────────────────────────────────────────────────────────────────────────────
# Folder structures
# ──────────────────────────────────────────────────────────────────────────────

PRODUCT_DIRS = [
    "product-images",
    "outputs",
]

SERVICE_DIRS = [
    "brand-assets/screenshots",
    "brand-assets/team",
    "brand-assets/logos",
    "brand-assets/icons",
    "outputs",
]


# ──────────────────────────────────────────────────────────────────────────────
# Main function
# ──────────────────────────────────────────────────────────────────────────────

def setup_brand(brand_name: str, url: str, product: str,
                brand_type: str = "product") -> str:
    """
    Create brand folder structure and metadata file.

    Args:
        brand_name: Brand identifier (folder name under brands/)
        url: Brand's main website URL
        product: Specific product or service name
        brand_type: "product" or "service"

    Returns:
        Path to the created brand folder.
    """
    brand_dir = brand_path(brand_name)

    print(f"\n{'='*60}")
    print(f"Phase 0: Brand Folder Setup")
    print(f"{'='*60}")
    print(f"  Brand:   {brand_name}")
    print(f"  URL:     {url}")
    print(f"  Product: {product}")
    print(f"  Type:    {brand_type}")
    print(f"  Path:    {brand_dir}")
    print(f"{'='*60}")

    # Create brand root
    brand_dir.mkdir(parents=True, exist_ok=True)

    # Create subfolders
    dirs = PRODUCT_DIRS if brand_type == "product" else SERVICE_DIRS
    for d in dirs:
        (brand_dir / d).mkdir(parents=True, exist_ok=True)
        print(f"  ✓ {d}/")

    # Save brand metadata for downstream scripts
    meta = {
        "brand": brand_name,
        "url": url,
        "product": product,
        "brand_type": brand_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    meta_file = brand_dir / "brand-meta.json"
    meta_file.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  ✓ brand-meta.json")

    print(f"\n{'='*60}")
    print(f"Phase 0 complete! Brand folder ready at:")
    print(f"  {brand_dir}")

    if brand_type == "product":
        print(f"\nNext step: Drop product images into brands/{brand_name}/product-images/")
    else:
        print(f"\nNext step: Drop assets into brands/{brand_name}/brand-assets/ subfolders:")
        print(f"  screenshots/  — App/dashboard screenshots, UI screens")
        print(f"  team/         — Team photos, founder headshots")
        print(f"  logos/        — Brand logo, integration partner logos")
        print(f"  icons/        — App icons, feature icons, illustrations")

    print(f"\nThen run Phase 1:")
    print(f"  python skills/references/phase1_brand_dna.py --brand {brand_name} --url {url} --product \"{product}\" --type {brand_type}")
    print(f"{'='*60}\n")

    return str(brand_dir)


# ──────────────────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Phase 0: Brand Folder Setup",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  python skills/references/phase0_setup.py --brand lmnt --url https://drinklmnt.com/ --product "LMNT Recharge" --type product
  python skills/references/phase0_setup.py --brand siigo --url https://siigo.com/ --product "Siigo Facturación Electrónica" --type service
""",
    )
    parser.add_argument("--brand", required=True, help="Brand identifier (folder name under brands/)")
    parser.add_argument("--url", required=True, help="Brand's main website URL")
    parser.add_argument("--product", required=True, help="Specific product or service name")
    parser.add_argument("--type", choices=["product", "service"], default="product",
                        help="Brand type: product (physical) or service (SaaS/digital)")

    args = parser.parse_args()

    setup_brand(
        brand_name=args.brand,
        url=args.url,
        product=args.product,
        brand_type=args.type,
    )


if __name__ == "__main__":
    main()
