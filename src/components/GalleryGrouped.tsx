"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronDown, ChevronRight, Download, ExternalLink, Loader2, Image as ImageIcon, Sparkles } from "lucide-react";
import type { GalleryImage, GenerationRun } from "@/lib/types";
import { templateNumberFromFolder } from "@/lib/generation-reveal";

interface GalleryGroupedProps {
  brandName: string;
  images: GalleryImage[];
  isLoading: boolean;
  highlightTemplate?: number | null;
  onHighlightConsumed?: () => void;
  isGenerating?: boolean;
  generationRun?: GenerationRun | null;
  revealRun?: GenerationRun | null;
  scrollToTemplate?: number | null;
  onScrollComplete?: () => void;
  pipelineProgress?: { percent: number; message: string } | null;
}

function templateNumber(folder: string): number | null {
  return templateNumberFromFolder(folder);
}

function formatTemplateName(folder: string): string {
  return folder.replace(/^\d+-/, "").replace(/-/g, " ");
}

export function GalleryGrouped({
  brandName,
  images,
  isLoading,
  highlightTemplate,
  onHighlightConsumed,
  isGenerating,
  generationRun,
  revealRun,
  scrollToTemplate,
  onScrollComplete,
  pipelineProgress,
}: GalleryGroupedProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [pulsingTemplate, setPulsingTemplate] = useState<number | null>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const activeRun = generationRun ?? revealRun;

  const grouped = useMemo(() => {
    const map = new Map<string, GalleryImage[]>();
    for (const img of images) {
      const list = map.get(img.template) || [];
      list.push(img);
      map.set(img.template, list);
    }
    return [...map.entries()].sort((a, b) => {
      const na = templateNumber(a[0]) ?? 999;
      const nb = templateNumber(b[0]) ?? 999;
      return na - nb;
    });
  }, [images]);

  const expectedByTemplate = useMemo(() => {
    if (!activeRun) return new Map<number, number>();
    const map = new Map<number, number>();
    for (const num of activeRun.templates) {
      map.set(num, activeRun.variations);
    }
    return map;
  }, [activeRun]);

  const isNewImage = (img: GalleryImage) => {
    if (!activeRun?.startedAt || !img.modifiedAt) return false;
    if (!activeRun.templateFolders.includes(img.template)) return false;
    return img.modifiedAt >= activeRun.startedAt - 2000;
  };

  const newImageCount = useMemo(() => {
    if (!activeRun) return 0;
    return images.filter(isNewImage).length;
  }, [images, activeRun]);

  const expectedTotal = activeRun ? activeRun.templates.length * activeRun.variations : 0;

  const displaySections = useMemo(() => {
    const sections = [...grouped];
    if (!activeRun) return sections;

    const existing = new Set(grouped.map(([t]) => t));

    for (const folder of activeRun.templateFolders) {
      if (!existing.has(folder)) {
        sections.push([folder, []]);
      }
    }

    return sections.sort((a, b) => {
      const na = templateNumber(a[0]) ?? 999;
      const nb = templateNumber(b[0]) ?? 999;
      return na - nb;
    });
  }, [grouped, activeRun]);

  useEffect(() => {
    if (grouped.length === 0 && !activeRun) return;
    const withImages = new Set(grouped.filter(([, imgs]) => imgs.length > 0).map(([t]) => t));
    if (activeRun) {
      for (const folder of activeRun.templateFolders) {
        withImages.add(folder);
      }
    }
    setExpandedSections(withImages);
  }, [grouped, activeRun]);

  useEffect(() => {
    if (highlightTemplate == null) return;
    const folder =
      displaySections.find(([t]) => templateNumber(t) === highlightTemplate)?.[0] ??
      grouped.find(([t]) => templateNumber(t) === highlightTemplate)?.[0];
    if (folder) {
      setExpandedSections((prev) => new Set([...prev, folder]));
      onHighlightConsumed?.();
    }
  }, [highlightTemplate, displaySections, grouped, onHighlightConsumed]);

  useEffect(() => {
    if (scrollToTemplate == null) return;
    const folder =
      displaySections.find(([t]) => templateNumber(t) === scrollToTemplate)?.[0] ??
      grouped.find(([t]) => templateNumber(t) === scrollToTemplate)?.[0];
    if (!folder) return;

    setExpandedSections((prev) => new Set([...prev, folder]));
    setPulsingTemplate(scrollToTemplate);

    const scrollTimer = window.setTimeout(() => {
      const el = sectionRefs.current.get(folder);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      onScrollComplete?.();
    }, 150);

    const pulseTimer = window.setTimeout(() => setPulsingTemplate(null), 4500);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(pulseTimer);
    };
  }, [scrollToTemplate, displaySections, grouped, onScrollComplete]);

  const toggleSection = (template: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(template)) next.delete(template);
      else next.add(template);
      return next;
    });
  };

  const openLightbox = (urls: string[], index: number) => {
    setLightbox({ urls, index });
  };

  const navigateLightbox = (delta: number) => {
    if (!lightbox) return;
    const next = (lightbox.index + delta + lightbox.urls.length) % lightbox.urls.length;
    setLightbox({ ...lightbox, index: next });
  };

  if (isLoading && images.length === 0 && !isGenerating) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
        <span>Loading generated ads gallery...</span>
      </div>
    );
  }

  if (images.length === 0 && !isGenerating) {
    return (
      <div className="text-center py-16 glass-panel rounded-2xl border border-dashed border-zinc-800/80 flex flex-col items-center justify-center p-6">
        <ImageIcon className="w-12 h-12 text-zinc-700 mb-3" />
        <span className="font-bold text-zinc-400 text-sm">No Ads Generated Yet</span>
        <p className="text-xs text-zinc-500 mt-1.5 max-w-xs">
          Select templates and click Generate to build image variations.
        </p>
      </div>
    );
  }

  return (
    <>
      {isGenerating && generationRun && (
        <div className="glass-panel rounded-2xl border border-cyan-500/30 p-4 mb-4 space-y-3">
          <div className="flex items-start gap-3">
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-100">Generating your ads…</p>
              <p className="text-xs text-zinc-400 mt-1">
                {generationRun.templates.length} template
                {generationRun.templates.length !== 1 ? "s" : ""} × {generationRun.variations} variation
                {generationRun.variations !== 1 ? "s" : ""} = {expectedTotal} image
                {expectedTotal !== 1 ? "s" : ""}. This can take several minutes at {generationRun.resolution} resolution.
              </p>
              {pipelineProgress?.message && (
                <p className="text-[10px] text-cyan-400/90 mt-1.5 truncate">{pipelineProgress.message}</p>
              )}
            </div>
            <span className="text-xs font-bold text-cyan-400 shrink-0">
              {newImageCount}/{expectedTotal}
            </span>
          </div>
          <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-500"
              style={{
                width: `${Math.min(
                  100,
                  expectedTotal > 0
                    ? Math.max(pipelineProgress?.percent ?? 5, (newImageCount / expectedTotal) * 100)
                    : pipelineProgress?.percent ?? 5
                )}%`,
              }}
            />
          </div>
          <p className="text-[10px] text-zinc-500">
            New images appear here as they finish. You can stay on this tab — no need to refresh.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] text-zinc-500">
          {images.length} images across {grouped.length} templates
        </p>
        <a
          href={`/api/images?brand=${encodeURIComponent(brandName)}&file=outputs/index.html`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" />
          Open static gallery
        </a>
      </div>

      <div className="space-y-2">
        {displaySections.map(([template, imgs]) => {
          const isExpanded = expandedSections.has(template);
          const urls = imgs.map((i) => i.url);
          const tmplNum = templateNumber(template);
          const expectedForTemplate = tmplNum != null ? expectedByTemplate.get(tmplNum) : undefined;
          const newInSection = imgs.filter(isNewImage);
          const pendingSlots =
            isGenerating && expectedForTemplate != null
              ? Math.max(0, expectedForTemplate - newInSection.length)
              : 0;
          const isPulsing = tmplNum != null && pulsingTemplate === tmplNum;

          return (
            <div
              key={template}
              ref={(el) => {
                if (el) sectionRefs.current.set(template, el);
                else sectionRefs.current.delete(template);
              }}
              className={`rounded-xl border overflow-hidden transition-colors ${
                isPulsing ? "gallery-reveal-pulse border-cyan-500/50" : "border-zinc-800/60"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSection(template)}
                className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/40 hover:bg-zinc-900/60 transition-colors min-h-[44px]"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-zinc-200 capitalize">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  )}
                  <span className="font-mono text-[10px] text-zinc-500">
                    #{String(templateNumber(template) ?? "?").padStart(2, "0")}
                  </span>
                  {formatTemplateName(template)}
                </span>
                <span className="text-[10px] text-zinc-500 flex items-center gap-1.5">
                  {imgs.length} images
                  {newInSection.length > 0 && !isGenerating && (
                    <span className="text-cyan-400 inline-flex items-center gap-0.5 gallery-new-badge">
                      <Sparkles className="w-2.5 h-2.5" />
                      {newInSection.length} new
                    </span>
                  )}
                  {pendingSlots > 0 && (
                    <span className="text-cyan-400/80 inline-flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" />
                      +{pendingSlots} generating
                    </span>
                  )}
                </span>
              </button>

              {isExpanded && (
                <div className="p-4 border-t border-zinc-800/60">
                  {imgs.length === 0 && pendingSlots === 0 ? (
                    <p className="text-xs text-zinc-600 italic">Not generated yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {imgs.map((img, i) => (
                        <div
                          key={img.url}
                          onClick={() => openLightbox(urls, i)}
                          className={`rounded-xl overflow-hidden border cursor-zoom-in transition-all group relative ${
                            isNewImage(img)
                              ? "border-cyan-500/50 ring-1 ring-cyan-500/20"
                              : "border-zinc-800 hover:border-cyan-500/30"
                          }`}
                        >
                          {isNewImage(img) && (
                            <span className="absolute top-2 left-2 z-10 text-[8px] font-bold uppercase tracking-wide bg-cyan-500 text-zinc-950 px-1.5 py-0.5 rounded flex items-center gap-0.5 gallery-new-badge">
                              <Sparkles className="w-2.5 h-2.5" />
                              New
                            </span>
                          )}
                          <img
                            src={img.url}
                            alt={img.file}
                            loading="lazy"
                            className="w-full h-auto object-cover max-h-[240px]"
                          />
                          <div className="p-2 bg-zinc-950/80">
                            <span className="text-[9px] font-mono text-zinc-600 truncate block">{img.file}</span>
                          </div>
                        </div>
                      ))}
                      {Array.from({ length: pendingSlots }).map((_, i) => (
                        <div
                          key={`pending-${template}-${i}`}
                          className="rounded-xl border border-dashed border-cyan-500/30 bg-zinc-950/60 min-h-[160px] flex flex-col items-center justify-center gap-2"
                        >
                          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                          <span className="text-[9px] text-zinc-500">Generating…</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {lightbox && (
        <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-50">
          <div className="absolute top-4 right-4 flex gap-2">
            <a
              href={lightbox.urls[lightbox.index]}
              download
              className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 hover:text-cyan-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={() => setLightbox(null)}
              className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 min-h-[44px]"
            >
              Close
            </button>
          </div>

          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-zinc-300 hover:text-white min-w-[44px] min-h-[44px]"
            onClick={() => navigateLightbox(-1)}
          >
            ‹
          </button>

          <img
            src={lightbox.urls[lightbox.index]}
            alt="Expanded ad"
            className="max-w-[90vw] max-h-[80vh] object-contain rounded-xl border border-zinc-800"
          />

          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-zinc-300 hover:text-white min-w-[44px] min-h-[44px]"
            onClick={() => navigateLightbox(1)}
          >
            ›
          </button>

          <p className="absolute bottom-4 text-xs text-zinc-500">
            {lightbox.index + 1} / {lightbox.urls.length}
          </p>
        </div>
      )}
    </>
  );
}
