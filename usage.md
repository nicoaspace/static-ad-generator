# Static Ad Generator — Usage Guide

---

## Before You Start (any brand)

1. **API key** — Add your Google AI Studio key to `env/.env.local`:
   ```
   GOOGLE_API_KEY=your-key-here
   ```
   Get one at: https://aistudio.google.com/apikey

2. **Python env** — Activate the conda environment:
   ```bash
   conda activate static-ad-generator   # or whatever your env is named
   ```

3. **Run from project root** — Always run commands from `e:\...\static-ad-generator\`, not from inside a brand folder.

---

## Running a New Product Brand

### Step 1 — Create the brand folder
```
brands/{brand-name}/
└── product-images/     ← Drop PNGs/JPGs here BEFORE running
```
- Use clean, well-lit photos. Front, back, angled, and lifestyle shots all help.
- 1–3 images is the sweet spot for reference quality. More is fine up to 10.
- Avoid low-res screenshots of the product — use real photography or official press kit renders.

### Step 2 — Phase 1: Brand DNA
Tell Claude (in this project):
```
Read the skill file at skills/SKILL.md. Run Phase 1 for [BRAND].
The brand URL is [URL] and the specific product is [PRODUCT NAME].
Save the Brand DNA to brands/[brand]/brand-dna.md.
```

### Step 3 — Phase 2: Prompt Generation
```
Read skills/references/template-prompts.md and brands/[brand]/brand-dna.md.
Fill in all 40 templates for [PRODUCT NAME]. Save to brands/[brand]/prompts.json.
```

### Step 4 — Phase 3: Image Generation
```bash
# Preview first (no API calls):
python skills/references/generate_ads.py --brand [brand] --type product --dry-run

# Run all templates:
python skills/references/generate_ads.py --brand [brand] --type product

# Run selective templates:
python skills/references/generate_ads.py --brand [brand] --type product --templates 1,7,13,15

# Lower resolution for quick tests (cheaper + faster):
python skills/references/generate_ads.py --brand [brand] --type product --resolution 1K --variations 2
```

---

## Running a New Service / SaaS Brand

### Step 1 — Create the brand folder and add assets
```
brands/{brand-name}/
└── brand-assets/
    ├── screenshots/   ← App/dashboard screenshots, UI screens (most important)
    ├── team/          ← Team photos, founder headshots
    ├── logos/         ← Brand logo, integration partner logos
    └── icons/         ← App icons, feature icons, illustrations
```

**Asset sourcing:**
| Subfolder | Where to get them |
|---|---|
| `screenshots/` | Clean browser screenshots (no tabs/chrome), Figma exports, press kit |
| `logos/` | Brand website, press kit, [Brandfetch](https://brandfetch.com/) |
| `team/` | LinkedIn, About page, press kit headshots |
| `icons/` | App Store / Play Store, product feature pages |

> **Important:** Use clean digital exports — not photos of a screen. The quality of your screenshots directly affects the quality of generated ads.

### Step 2 — Check asset coverage before generating
```bash
python skills/references/generate_ads.py --brand [brand] --type service --recommend
```
This works **before Phase 2** — no `prompts.json` needed. It shows which templates are READY, which are PARTIAL (better with more assets), and which are BLOCKED (missing required assets). Add more assets to unlock blocked templates before moving to Phase 2.

### Step 3 — Phase 1: Brand DNA (Service)
Tell Claude:
```
Read the skill file at skills/SKILL.md. Run Phase 1 (Service variant) for [BRAND].
The brand URL is [URL] and the specific product is [PRODUCT/PLAN NAME].
Save the Brand DNA to brands/[brand]/brand-dna.md.
```

### Step 4 — Phase 2: Prompt Generation (Service)
```
Read skills/references/service-template-prompts.md and brands/[brand]/brand-dna.md.
Check which brand-assets/ subfolders are populated. Fill in all eligible templates
for [PRODUCT NAME], skipping those with missing required_assets.
Save to brands/[brand]/prompts.json.
```

### Step 5 — Phase 3: Image Generation
```bash
# Preview with eligibility status per template:
python skills/references/generate_ads.py --brand [brand] --type service --dry-run

# Run all templates:
python skills/references/generate_ads.py --brand [brand] --type service

# Run selective templates:
python skills/references/generate_ads.py --brand [brand] --type service --templates 1,4,13
```

---

## CLI Reference

```
--brand NAME          Brand folder name under brands/          (required)
--type product|service  Pipeline track to use                  (required)
--templates 1,7,13    Run only these template numbers          (optional)
--resolution 512|1K|2K|4K  Image size, default 2K             (optional)
--variations N        Images per template, default 4           (optional)
--dry-run             Preview run — no API calls made          (optional)
--recommend           Scan brand-assets/ and report eligibility (service only)
```

---

## Cost & Speed Reference

| Resolution | Cost/image | Use when |
|---|---|---|
| 1K | ~$0.067 | Quick tests, drafts |
| 2K | ~$0.10  | Default, production quality |
| 4K | ~$0.15  | Hero assets only |

- **Full run** (40 templates × 4 variations at 2K) ≈ **$16**
- **Selective run** with `--templates 1,7,13,15` (4 templates × 4 variations at 2K) ≈ **$1.60**
- Use `--resolution 1K --variations 2` to cut a full test run cost to ~$5.

---

## Things to Know Before Running

- **prompts.json must exist** before Phase 3. The script will error clearly if it doesn't.
- **`--type` is required** every run. There is no default — it's explicit by design.
- **Output is cumulative** — re-running a template appends new images alongside old ones. Rename or clear `outputs/` if you want a clean slate.
- **Rate limiting** — the script pauses briefly between templates to avoid hitting API rate limits. A full 40-template run takes ~10–15 minutes.
- **Gallery** — after generation, open `brands/{brand}/outputs/index.html` in a browser to browse all outputs.
- **Skipped templates in service mode** — if Claude skips templates during Phase 2 (due to missing assets), they appear in a `"skipped"` array in `prompts.json`. Add the required assets and re-run Phase 2 to include them.
- **Re-running a single template** — use `--templates N` to regenerate just one without touching the rest.
- **Re-running Phase 2** — if you change the product name or want to refresh prompts, just re-run the Phase 2 instruction. It overwrites `prompts.json` with no side effects.
