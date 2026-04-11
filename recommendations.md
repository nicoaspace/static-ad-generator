Verification
python generate_ads.py --brand lmnt --type product --dry-run — identical to current behavior (regression)
Create dummy brands/test-service/ with service prompts.json + brand-assets/, run --type service --dry-run — lists service templates, shows "brand-assets" in summary
Run without --type — should error with clear message
Verify service-template-prompts.md has ~35 complete templates with no leftover product [BRACKETED PLACEHOLDERS]
Verify SKILL.md has service sections for all 3 phases with correct paths and examples
Verify service prompts.json schema uses brand_type: service and needs_brand_assets


Decisions
Existing product pipeline untouched — adding --type is the only change to existing behavior
Full new template set — 35 purpose-built service templates, not adapted product templates
brand-assets/ folder — accepts app screenshots, UI mockups, team photos, logos, icons (broader than product-images)
CLI flag is authoritative for Phase 3; brand_type in Brand DNA/JSON is for Phase 1/2 routing and documentation
Same 1-40 numbering — easy to compare product vs service output for the same ad concept


Recommendations
Pilot with a known SaaS brand (Notion, Linear, Slack) before client work — validates Brand DNA research + template output quality from Gemini for digital products.

More templates should use needs_brand_assets: true for services than products use needs_product_images: true. Physical product ads can work text-only; service ads almost always benefit from a real UI screenshot so Gemini doesn't generate a generic dashboard.

Write 5 service templates first (S1, S4, S7, S13, and one new concept like Integration Ecosystem), test them through the full Gemini pipeline. If the model handles UI-centric prompts differently than product prompts, adjust template writing style before completing the full 35.

Image quality guidance: Add a note in SKILL.md recommending clean browser screenshots (no chrome), Figma exports, or official press kit assets — not photos-of-screens.

Future: --type hybrid for brands that are both (Peloton, Headspace). Not needed now, but keep the architecture clean for it.