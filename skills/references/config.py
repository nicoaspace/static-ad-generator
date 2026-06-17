"""
Shared configuration for Phase 1, Phase 2, and Phase 3 scripts.

Provides:
    - PROJECT_ROOT / BRANDS_ROOT / ENV_FILE path resolution
    - API key loading (GOOGLE_API_KEY, OPENROUTER_API_KEY)
    - PUBLIC_VERSION toggle (free OpenRouter stack vs paid Gemini stack)
    - Brand directory helpers
"""

import os
import sys
import json
from pathlib import Path


def configure_console_encoding() -> None:
    """Use UTF-8 for stdout/stderr on Windows (avoids cp1252 UnicodeEncodeError)."""
    if sys.platform != "win32":
        return
    for stream in (sys.stdout, sys.stderr):
        if stream is None or not hasattr(stream, "reconfigure"):
            continue
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, OSError, ValueError):
            pass


configure_console_encoding()

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

# Provider models
GEMINI_LLM_MODEL   = "gemini-2.0-flash"
GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview"
OPENROUTER_MODEL        = "nvidia/nemotron-3-super-120b-a12b:free"
OPENROUTER_IMAGE_MODEL  = "x-ai/grok-imagine-image-quality"
OPENROUTER_IMAGE_LATENCY_SECONDS = 7.99

# Grok Imagine supports 1K and 2K via OpenRouter image_config.image_size.
# Pipeline label "512" maps to 1K for the public provider.
GEMINI_RESOLUTION_CHOICES = ("512", "1K", "2K", "4K")
PUBLIC_IMAGE_RESOLUTION_CHOICES = ("512", "1K")

# xAI Grok Imagine via OpenRouter — supported aspect_ratio values
OPENROUTER_ASPECT_RATIOS = (
    "1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2",
    "9:19.5", "19.5:9", "9:20", "20:9", "1:2", "2:1", "auto",
)


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


def load_openrouter_key() -> str:
    """Read OPENROUTER_API_KEY from environment or env/.env.local."""
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if key:
        return key
    return _load_key_from_env_file("OPENROUTER_API_KEY")


def is_public_version() -> bool:
    """True when PUBLIC_VERSION is set — use free OpenRouter providers."""
    raw = os.environ.get("PUBLIC_VERSION", "").strip().lower()
    if not raw:
        raw = _load_key_from_env_file("PUBLIC_VERSION").lower()
    return raw in ("true", "1", "yes")


def get_llm_default_model() -> str:
    return OPENROUTER_MODEL if is_public_version() else GEMINI_LLM_MODEL


def get_image_model_name() -> str:
    return OPENROUTER_IMAGE_MODEL if is_public_version() else GEMINI_IMAGE_MODEL


def get_resolution_choices() -> tuple[str, ...]:
    """Resolution labels exposed in CLI/UI for the active image provider."""
    return PUBLIC_IMAGE_RESOLUTION_CHOICES if is_public_version() else GEMINI_RESOLUTION_CHOICES


def map_resolution_to_openrouter_image_size(resolution: str) -> str:
    """Map pipeline resolution labels to OpenRouter image_config.image_size."""
    if resolution in ("2K", "4K"):
        return "2K"
    if resolution == "1K":
        return "1K"
    return "1K"


def _aspect_ratio_value(ratio: str) -> float | None:
    if ratio == "auto":
        return None
    parts = ratio.split(":")
    if len(parts) != 2:
        return None
    try:
        width, height = float(parts[0]), float(parts[1])
        if height == 0:
            return None
        return width / height
    except ValueError:
        return None


def map_aspect_ratio_for_openrouter(aspect_ratio: str) -> str:
    """Map template aspect ratios to values Grok Imagine accepts on OpenRouter."""
    if aspect_ratio in OPENROUTER_ASPECT_RATIOS:
        return aspect_ratio

    target = _aspect_ratio_value(aspect_ratio)
    if target is None:
        return "auto"

    best = "auto"
    best_diff = float("inf")
    for candidate in OPENROUTER_ASPECT_RATIOS:
        if candidate == "auto":
            continue
        value = _aspect_ratio_value(candidate)
        if value is None:
            continue
        diff = abs(value - target)
        if diff < best_diff:
            best_diff = diff
            best = candidate
    return best


def get_public_image_latency_seconds() -> float:
    return OPENROUTER_IMAGE_LATENCY_SECONDS


def get_default_resolution() -> str:
    return "512"


def get_rate_limit_pause() -> float:
    """Seconds between image API calls — brief pause on OpenRouter to avoid bursts."""
    return 1.5 if is_public_version() else 1.0


def missing_llm_api_key() -> str | None:
    """Return the missing env var name, or None if the active LLM key is set."""
    if is_public_version():
        return None if load_openrouter_key() else "OPENROUTER_API_KEY"
    return None if load_google_key() else "GOOGLE_API_KEY"


def missing_image_api_key() -> str | None:
    """Return the missing env var name, or None if the active image key is set."""
    if is_public_version():
        return None if load_openrouter_key() else "OPENROUTER_API_KEY"
    return None if load_google_key() else "GOOGLE_API_KEY"


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


def emit_progress(percent: int, message: str, **extra) -> None:
    """Emit a machine-readable progress line for the pipeline SSE stream."""
    payload = {"percent": max(0, min(100, percent)), "message": message, **extra}
    print(f"[PIPELINE_PROGRESS] {json.dumps(payload, ensure_ascii=False)}", flush=True)
