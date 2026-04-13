# Microservices Usage

## Archivos creados

| Archivo | Propósito |
|---------|-----------|
| `skills/references/config.py` | Módulo compartido: PROJECT_ROOT, carga de API keys, paths, `scan_brand_assets()` |
| `skills/references/phase0_setup.py` | Phase 0: Crea carpeta de la marca + subdirectorios (product-images/ o brand-assets/) + brand-meta.json |
| `skills/references/phase1_brand_dna.py` | Phase 1: Scraping (Playwright) + Research (Claude API + web_search) → `brand-dna.md` |
| `skills/references/phase2_prompt_gen.py` | Phase 2: Brand DNA + templates → Claude → `prompts.json` |
| `skills/references/pipeline_research.py` | Pipeline Parte 1: Phase 0 (setup) + Phase 1 (research) → luego subir imágenes |
| `skills/references/pipeline_generate.py` | Pipeline Parte 2: Phase 2 (prompts) + Phase 3 (images) → despues de subir imágenes |

---

## Cómo usar desde CLI

```bash
# Phase 0: Setup de carpeta de marca
python skills/references/phase0_setup.py --brand lmnt --url https://drinklmnt.com/ --product "LMNT Recharge" --type product
python skills/references/phase0_setup.py --brand siigo --url https://siigo.com/ --product "Siigo Facturación Electrónica" --type service

# Phase 1: Generar Brand DNA
python skills/references/phase1_brand_dna.py --brand lmnt --url https://drinklmnt.com/ --product "LMNT Recharge" --type product
python skills/references/phase1_brand_dna.py --brand siigo --url https://siigo.com/ --product "Siigo Facturación Electrónica" --type service

# Phase 2: Generar prompts.json
python skills/references/phase2_prompt_gen.py --brand lmnt --type product
python skills/references/phase2_prompt_gen.py --brand siigo --type service

# Phase 3: Generar imágenes
python skills/references/generate_ads.py --brand lmnt --type product

# Pipeline Parte 1: Phase 0 + Phase 1 (research)
python skills/references/pipeline_research.py --brand lmnt --url https://drinklmnt.com/ --product "LMNT Recharge" --type product
python skills/references/pipeline_research.py --brand le-car --url https://lecar.com.co/ --product "Mantenimiento Correctivo" --type service

# >>> Subir imágenes a brands/{brand}/product-images/ (product) o brands/{brand}/brand-assets/ (service) <<<

# Pipeline Parte 2: Phase 2 + Phase 3 (generate)
python skills/references/pipeline_generate.py --brand lmnt --type product
python skills/references/pipeline_generate.py --brand le-car --type service
python skills/references/pipeline_generate.py --brand lmnt --type product --dry-run
python skills/references/pipeline_generate.py --brand lmnt --type product --templates 1,7,9,13,15 --resolution 1K --variations 2
```

---

## Como funciones importables (para microservicio)

```python
from phase0_setup import setup_brand
from phase1_brand_dna import generate_brand_dna
from phase2_prompt_gen import generate_prompts
from pipeline_research import run_research
from pipeline_generate import run_generate

# Phase 0 → retorna path a la carpeta de la marca
path = setup_brand("lmnt", "https://drinklmnt.com/", "LMNT Recharge", "product")

# Phase 1 → retorna path al brand-dna.md
path = generate_brand_dna("lmnt", "https://drinklmnt.com/", "LMNT Recharge", "product")

# Phase 2 → retorna path al prompts.json
path = generate_prompts("lmnt", "product")

# Pipeline Parte 1: Phase 0 + 1 → retorna dict con paths y tiempos
results = run_research("lmnt", "https://drinklmnt.com/", "LMNT Recharge", "product")

# >>> Subir imágenes <<<

# Pipeline Parte 2: Phase 2 + 3 → retorna dict con prompts path y exit code
results = run_generate("lmnt", "product")
results = run_generate("lmnt", "product", dry_run=True)
```

---

## Requisitos

- `ANTHROPIC_API_KEY` en variable de entorno o en `env/.env.local`
- `GOOGLE_API_KEY` en variable de entorno o en `env/.env.local` (para Phase 3)
- Playwright Chromium instalado: `playwright install chromium`
- Paquetes: `pip install anthropic playwright google-genai Pillow`

---

## Flags disponibles

### phase0_setup.py
| Flag | Descripción | Requerido |
|------|-------------|----------|
| `--brand` | Identificador de la marca (nombre de carpeta bajo `brands/`) | ✓ |
| `--url` | URL principal del sitio web de la marca | ✓ |
| `--product` | Nombre específico del producto o servicio | ✓ |
| `--type` | `product` o `service` (default: `product`) | |

### phase1_brand_dna.py
| Flag | Descripción | Requerido |
|------|-------------|-----------|
| `--brand` | Identificador de la marca (nombre de carpeta bajo `brands/`) | ✓ |
| `--url` | URL principal del sitio web de la marca | ✓ |
| `--product` | Nombre específico del producto o servicio | ✓ |
| `--type` | `product` o `service` (default: `product`) | |
| `--model` | Modelo Claude a usar (default: `claude-sonnet-4-20250514`) | |

### phase2_prompt_gen.py
| Flag | Descripción | Requerido |
|------|-------------|-----------|
| `--brand` | Identificador de la marca | ✓ |
| `--type` | `product` o `service` (default: `product`) | |
| `--product` | Override del nombre de producto (default: inferido del brand-dna.md) | |
| `--model` | Modelo Claude a usar (default: `claude-sonnet-4-20250514`) | |

### generate_ads.py (Phase 3 — sin cambios)
| Flag | Descripción |
|------|-------------|
| `--brand` | Identificador de la marca |
| `--type` | `product` o `service` |
| `--templates` | Subset de templates, e.g. `1,7,9,13,15` |
| `--resolution` | `512` / `1K` / `2K` / `4K` (default: `1K`) |
| `--variations` | Imágenes por template (default: `4`) |
| `--dry-run` | Preview sin llamadas a la API |
| `--recommend` | Pre-flight asset check (solo service) |

### pipeline_research.py (Parte 1)
| Flag | Descripción | Requerido |
|------|-------------|-----------|
| `--brand` | Identificador de la marca | ✓ |
| `--url` | URL principal del sitio web | ✓ |
| `--product` | Nombre del producto o servicio | ✓ |
| `--type` | `product` o `service` (default: `product`) | |
| `--model` | Modelo Claude (default: `claude-sonnet-4-20250514`) | |

### pipeline_generate.py (Parte 2)
| Flag | Descripción | Requerido |
|------|-------------|-----------|
| `--brand` | Identificador de la marca | ✓ |
| `--type` | `product` o `service` (default: `product`) | |
| `--product` | Override del nombre de producto | |
| `--model` | Modelo Claude para Phase 2 | |
| `--templates` | Subset de templates, e.g. `1,7,9,13,15` | |
| `--resolution` | `512` / `1K` / `2K` / `4K` (default: `1K`) | |
| `--variations` | Imágenes por template (default: `4`) | |
| `--dry-run` | Phase 3 sin llamadas a la API | |

---

## Costo estimado por marca

| Phase | Costo aprox. |
|-------|-------------|
| Phase 1 (research) | ~$0.50–1.00 (15-20 web searches + tokens) |
| Phase 2 (prompt gen) | ~$0.50–0.80 (tokens) |
| Phase 3 (imagen gen, 40 templates × 4 variaciones @ 1K) | ~$10.72 |

---

## Flujo completo de nuevo cliente

### Opción A: Pipeline en 2 pasos (recomendado)

```bash
# 1. Agregar API keys si no están
echo "ANTHROPIC_API_KEY=sk-ant-..." >> env/.env.local
echo "GOOGLE_API_KEY=..." >> env/.env.local

# 2. Parte 1: Research (Phase 0 + Phase 1)
python skills/references/pipeline_research.py \
  --brand {brand} \
  --url https://www.{brand}.com/ \
  --product "{Nombre del Producto}" \
  --type product   # o service

# 3. Subir imágenes
#    Product: brands/{brand}/product-images/
#    Service: brands/{brand}/brand-assets/screenshots/, logos/, icons/, team/

# 4. Parte 2: Generate (Phase 2 + Phase 3)
python skills/references/pipeline_generate.py \
  --brand {brand} \
  --type product   # o service
```

### Opción B: Paso a paso (scripts individuales)

```bash
# 1. Agregar API keys si no están
echo "ANTHROPIC_API_KEY=sk-ant-..." >> env/.env.local

# 2. Phase 0: Setup
python skills/references/phase0_setup.py \
  --brand {brand} \
  --url https://www.{brand}.com/ \
  --product "{Nombre del Producto}" \
  --type product   # o service

# 3. Phase 1: Research
python skills/references/phase1_brand_dna.py \
  --brand {brand} \
  --url https://www.{brand}.com/ \
  --product "{Nombre del Producto}" \
  --type product   # o service

# 4. Subir imágenes
#    Product: brands/{brand}/product-images/
#    Service: brands/{brand}/brand-assets/screenshots/, logos/, icons/, team/

# 5. Phase 2: Prompts
python skills/references/phase2_prompt_gen.py --brand {brand} --type product

# 6. Phase 3: Imágenes (dry-run primero)
python skills/references/generate_ads.py --brand {brand} --type product --dry-run
python skills/references/generate_ads.py --brand {brand} --type product
```
