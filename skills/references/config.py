"""
Shared configuration for Phase 1, Phase 2, and Phase 3 scripts.

Provides:
    - PROJECT_ROOT / BRANDS_ROOT / ENV_FILE path resolution
    - API key loading (ANTHROPIC_API_KEY, GOOGLE_API_KEY)
    - Brand directory helpers
"""

import os
from pathlib import Path

# ──────────────────────────────────────────────────────────────────────────────
# Paths — project root is three levels above this file
# skills/references/config.py  →  ../../..  →  project root
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR   = Path(__file__).resolve().parent          # skills/references/
PROJECT_ROOT = SCRIPT_DIR.parent.parent                  # static-ad-generator/
BRANDS_ROOT  = PROJECT_ROOT / "brands"
ENV_FILE     = PROJECT_ROOT / "env" / ".env.local"

# Template files
PRODUCT_TEMPLATES = SCRIPT_DIR / "template-prompts.md"
SERVICE_TEMPLATES = SCRIPT_DIR / "service-template-prompts.md"

# Asset categories for service brands
ASSET_CATEGORIES = ("screenshots", "team", "logos", "icons")
IMAGE_EXTENSIONS = ("*.png", "*.jpg", "*.jpeg", "*.webp")


def _load_key_from_env_file(key_name: str) -> str:
    """Read a key from env/.env.local."""
    if not ENV_FILE.exists():
        return ""
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith(f"{key_name}="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def load_anthropic_key() -> str:
    """Read ANTHROPIC_API_KEY from environment or env/.env.local."""
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if key:
        return key
    return _load_key_from_env_file("ANTHROPIC_API_KEY")


def load_google_key() -> str:
    """Read GOOGLE_API_KEY from environment or env/.env.local."""
    key = os.environ.get("GOOGLE_API_KEY", "").strip()
    if key:
        return key
    return _load_key_from_env_file("GOOGLE_API_KEY")


def brand_path(brand_name: str) -> Path:
    """Return the path to a brand's folder."""
    return BRANDS_ROOT / brand_name


def list_brands_with_dna() -> list[str]:
    """Return brand names that have a brand-dna.md."""
    if not BRANDS_ROOT.exists():
        return []
    return sorted(
        d.name for d in BRANDS_ROOT.iterdir()
        if d.is_dir() and (d / "brand-dna.md").exists()
    )


def list_brands_with_prompts() -> list[str]:
    """Return brand names that have a prompts.json ready."""
    if not BRANDS_ROOT.exists():
        return []
    return sorted(
        d.name for d in BRANDS_ROOT.iterdir()
        if d.is_dir() and (d / "prompts.json").exists()
    )


def scan_brand_assets(brand_dir: Path) -> dict[str, int]:
    """Scan brand-assets/ subfolders and return image counts per category."""
    assets_dir = brand_dir / "brand-assets"
    result = {}
    for cat in ASSET_CATEGORIES:
        cat_dir = assets_dir / cat
        count = 0
        if cat_dir.is_dir():
            for ext in IMAGE_EXTENSIONS:
                count += len(list(cat_dir.glob(ext)))
        result[cat] = count
    return result
