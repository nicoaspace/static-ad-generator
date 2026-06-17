"use client";

import { useState, useEffect } from "react";
import {
  FolderOpen,
  Plus,
  Upload,
  Loader2,
  Globe,
  CheckCircle2,
  Image as ImageIcon,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { AssetFile, Brand } from "@/lib/types";

const SERVICE_CATEGORIES = ["screenshots", "logos", "icons", "team"] as const;

interface BrandSidebarProps {
  brands: Brand[];
  selectedBrand: Brand | null;
  isLoadingBrands: boolean;
  onSelectBrand: (brand: Brand) => void;
  onCreateBrand: () => void;
  uploadCategory: string;
  onUploadCategoryChange: (cat: string) => void;
  isUploading: boolean;
  uploadSuccess: boolean;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  assetsRefreshKey: number;
}

export function BrandSidebar({
  brands,
  selectedBrand,
  isLoadingBrands,
  onSelectBrand,
  onCreateBrand,
  uploadCategory,
  onUploadCategoryChange,
  isUploading,
  uploadSuccess,
  onFileUpload,
  assetsRefreshKey,
}: BrandSidebarProps) {
  const [assets, setAssets] = useState<Record<string, AssetFile[]>>({});
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const categories =
    selectedBrand?.brandType === "product"
      ? (["product-images"] as const)
      : SERVICE_CATEGORIES;

  useEffect(() => {
    if (!selectedBrand) {
      setAssets({});
      return;
    }

    let cancelled = false;
    setIsLoadingAssets(true);

    fetch(`/api/brands?brand=${encodeURIComponent(selectedBrand.name)}&assets=true`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success && data.assets) {
          setAssets(data.assets);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setIsLoadingAssets(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBrand, assetsRefreshKey]);

  const toggleFolder = (cat: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <>
      <section className="lg:col-span-1 border-r border-zinc-800/60 bg-[#09090d]/60 flex flex-col p-4 gap-4 overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
          <div className="flex items-center gap-2 text-zinc-300 font-bold">
            <FolderOpen className="w-4.5 h-4.5 text-cyan-400" />
            <span>Brands Studio</span>
          </div>
          <button
            onClick={onCreateBrand}
            className="p-1.5 bg-cyan-500 hover:bg-cyan-600 text-zinc-950 rounded-lg transition-all active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Create Brand"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {isLoadingBrands ? (
          <div className="flex-1 flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="space-y-2">
            {brands.map((b) => (
              <div
                key={b.name}
                onClick={() => onSelectBrand(b)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col gap-1.5 ${
                  selectedBrand?.name === b.name
                    ? "bg-zinc-900/90 border-cyan-500/40 shadow-lg shadow-cyan-500/5"
                    : "bg-zinc-950/40 border-zinc-800/40 hover:bg-zinc-900/30 hover:border-zinc-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-zinc-200 truncate pr-2">{b.name}</span>
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold border ${
                      b.brandType === "service"
                        ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                        : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                    }`}
                  >
                    {b.brandType}
                  </span>
                </div>

                {b.url && (
                  <span className="text-[10px] text-zinc-500 truncate flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {b.url}
                  </span>
                )}

                <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-zinc-900">
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-md flex items-center gap-1 font-medium ${
                      b.hasDna ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-900 text-zinc-600"
                    }`}
                  >
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    DNA
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-md flex items-center gap-1 font-medium ${
                      b.hasPrompts ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-900 text-zinc-600"
                    }`}
                  >
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Prompts
                  </span>
                  <span className="text-[9px] bg-zinc-900/80 text-zinc-400 border border-zinc-800 px-1.5 py-0.5 rounded-md flex items-center gap-1 font-medium">
                    <ImageIcon className="w-2.5 h-2.5 text-zinc-500" />
                    {b.generatedImageCount} ads
                  </span>
                </div>
              </div>
            ))}

            {brands.length === 0 && (
              <div className="text-center py-8 text-zinc-600 text-xs">
                No brands found. Click the + button above to create one.
              </div>
            )}
          </div>
        )}

        {selectedBrand && (
          <div className="mt-auto pt-4 border-t border-zinc-800/60 flex flex-col gap-3.5 bg-zinc-950/20 p-3 rounded-2xl">
            <div className="flex items-center gap-2 text-zinc-300 font-bold text-xs">
              <Upload className="w-4 h-4 text-cyan-400" />
              <span>Upload Brand Assets</span>
            </div>

            {selectedBrand.brandType === "service" && (
              <div className="grid grid-cols-2 gap-1 bg-zinc-900/50 p-0.5 rounded-lg border border-zinc-800/40">
                {SERVICE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => onUploadCategoryChange(cat)}
                    className={`text-[10px] py-2 rounded capitalize font-medium min-h-[44px] ${
                      uploadCategory === cat
                        ? "bg-zinc-800 text-cyan-400 shadow-sm border border-zinc-700/50"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            <label className="flex flex-col items-center justify-center border border-dashed border-zinc-800 hover:border-cyan-500/50 hover:bg-cyan-500/[0.02] rounded-xl py-6 px-4 cursor-pointer transition-all duration-200 group text-center min-h-[88px]">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={onFileUpload}
                disabled={isUploading}
                className="hidden"
              />
              {isUploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mb-2" />
              ) : (
                <Upload className="w-6 h-6 text-zinc-500 group-hover:text-cyan-400 mb-2 transition-all" />
              )}
              <span className="text-[11px] font-semibold text-zinc-300">
                {isUploading ? "Uploading files..." : "Drag or Click to upload"}
              </span>
              <span className="text-[9px] text-zinc-500 mt-1">
                {selectedBrand.brandType === "product"
                  ? "Add product photos"
                  : `Upload to ${uploadCategory}/`}
              </span>
            </label>

            {uploadSuccess && (
              <div className="text-[10px] text-emerald-400 font-medium text-center">
                Upload complete. Assets refreshed.
              </div>
            )}

            <div className="text-[10px] text-zinc-500 space-y-1 bg-zinc-900/30 p-2 rounded-xl border border-zinc-800/40">
              <div className="font-semibold text-zinc-400 pb-1 border-b border-zinc-900 mb-1">
                Asset Folders
              </div>

              {isLoadingAssets ? (
                <div className="flex items-center gap-2 py-2 text-zinc-600">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading previews...
                </div>
              ) : (
                categories.map((cat) => {
                  const files = assets[cat] || [];
                  const isExpanded = expandedFolders.has(cat);
                  return (
                    <div key={cat} className="border-b border-zinc-900/60 last:border-0 pb-1">
                      <button
                        type="button"
                        onClick={() => toggleFolder(cat)}
                        className="w-full flex items-center justify-between py-1.5 capitalize hover:text-zinc-300 min-h-[44px]"
                      >
                        <span className="flex items-center gap-1">
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3 text-zinc-500" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-zinc-500" />
                          )}
                          {cat.replace("-", " ")}
                        </span>
                        <span
                          className={`font-bold ${files.length > 0 ? "text-emerald-400" : "text-zinc-600"}`}
                        >
                          {files.length}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="pb-2 pl-4">
                          {files.length === 0 ? (
                            <p className="text-[9px] text-zinc-600 italic py-1">
                              No files yet. Upload above.
                            </p>
                          ) : (
                            <div className="grid grid-cols-3 gap-1.5">
                              {files.map((f) => (
                                <button
                                  key={f.url}
                                  type="button"
                                  onClick={() => setPreviewUrl(f.url)}
                                  className="aspect-square rounded-lg overflow-hidden border border-zinc-800 hover:border-cyan-500/40 transition-colors"
                                >
                                  <img
                                    src={f.url}
                                    alt={f.file}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </section>

      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-50 cursor-zoom-out"
        >
          <img
            src={previewUrl}
            alt="Asset preview"
            className="max-w-full max-h-[90vh] object-contain rounded-xl border border-zinc-800"
          />
        </div>
      )}
    </>
  );
}
