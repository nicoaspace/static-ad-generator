"use client";

import { CheckCircle2, Sparkles, X } from "lucide-react";
import type { GalleryImage, GenerationRun } from "@/lib/types";
import { formatTemplateFolderName, getNewImagesForRun } from "@/lib/generation-reveal";

interface GenerationCompleteModalProps {
  run: GenerationRun;
  images: GalleryImage[];
  onViewInGallery: () => void;
  onDismiss: () => void;
}

export function GenerationCompleteModal({
  run,
  images,
  onViewInGallery,
  onDismiss,
}: GenerationCompleteModalProps) {
  const newImages = getNewImagesForRun(images, run);
  const preview = newImages.slice(0, 4);
  const overflow = newImages.length - preview.length;
  const templateLabels = run.templateFolders.map(formatTemplateFolderName);
  const templateSummary =
    templateLabels.length === 1
      ? templateLabels[0]
      : `${templateLabels.length} templates`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onDismiss}
      />
      <div
        role="dialog"
        aria-labelledby="generation-complete-title"
        className="relative w-full max-w-lg glass-panel rounded-3xl shadow-2xl overflow-hidden generation-complete-enter"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-600 via-cyan-400 to-emerald-400" />

        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 pt-7">
          <div className="flex items-start gap-3 mb-5 pr-8">
            <div className="shrink-0 w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 id="generation-complete-title" className="text-lg font-bold text-zinc-100">
                Your ads are ready
              </h3>
              <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                {newImages.length} image{newImages.length !== 1 ? "s" : ""} · {templateSummary} ·{" "}
                {run.resolution}
              </p>
            </div>
          </div>

          {preview.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {preview.map((img) => (
                <div
                  key={img.url}
                  className="relative rounded-xl overflow-hidden border border-cyan-500/25 bg-zinc-950/60 aspect-[4/5]"
                >
                  <img
                    src={img.url}
                    alt={img.file}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2 left-2 text-[8px] font-bold uppercase tracking-wide bg-cyan-500 text-zinc-950 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" />
                    New
                  </span>
                </div>
              ))}
            </div>
          )}

          {overflow > 0 && (
            <p className="text-xs text-zinc-500 -mt-3 mb-5 text-center">
              +{overflow} more in the gallery
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
            <button
              type="button"
              onClick={onDismiss}
              className="px-4 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 rounded-xl min-h-[44px]"
            >
              Keep browsing
            </button>
            <button
              type="button"
              onClick={onViewInGallery}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-semibold rounded-xl text-sm min-h-[44px] shadow-lg shadow-cyan-900/30 transition-colors"
            >
              View in gallery
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
