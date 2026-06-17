"use client";

import { useState, useMemo } from "react";
import {
  CheckSquare,
  Square,
  Edit2,
  Save,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  Image as ImageIcon,
} from "lucide-react";
import type { PromptItem, PromptsJson, TemplateEligibility } from "@/lib/types";

type TemplateFilter = "all" | "selected" | "generated";

interface TemplateGridProps {
  promptsData: PromptsJson;
  selectedTemplates: number[];
  generatedCounts: Record<number, number>;
  latestThumbnails: Record<number, string>;
  eligibility: TemplateEligibility[];
  editingPromptIndex: number | null;
  editingPromptText: string;
  showCustomPromptForm: boolean;
  customName: string;
  customPrompt: string;
  customAspect: string;
  onToggleTemplate: (num: number) => void;
  onToggleSelectAll: () => void;
  onExpandTemplate: (num: number | null) => void;
  expandedTemplate: number | null;
  onEditPrompt: (index: number, text: string) => void;
  onEditingTextChange: (text: string) => void;
  onSavePrompt: (index: number) => void;
  onCancelEdit: () => void;
  onDeletePrompt: (index: number) => void;
  onShowCustomForm: (show: boolean) => void;
  onCustomNameChange: (v: string) => void;
  onCustomPromptChange: (v: string) => void;
  onCustomAspectChange: (v: string) => void;
  onAddCustomPrompt: (e: React.FormEvent) => void;
  onViewGallery?: (templateNum: number) => void;
}

function statusBadge(status: TemplateEligibility["status"] | undefined) {
  if (!status || status === "ready") return null;
  if (status === "blocked") {
    return (
      <span className="text-[8px] bg-red-950/60 text-red-400 border border-red-800/30 px-1 py-0.5 rounded font-semibold">
        Blocked
      </span>
    );
  }
  return (
    <span className="text-[8px] bg-amber-950/60 text-amber-400 border border-amber-800/30 px-1 py-0.5 rounded font-semibold">
      Partial
    </span>
  );
}

export function TemplateGrid({
  promptsData,
  selectedTemplates,
  generatedCounts,
  latestThumbnails,
  eligibility,
  editingPromptIndex,
  editingPromptText,
  showCustomPromptForm,
  customName,
  customPrompt,
  customAspect,
  onToggleTemplate,
  onToggleSelectAll,
  onExpandTemplate,
  expandedTemplate,
  onEditPrompt,
  onEditingTextChange,
  onSavePrompt,
  onCancelEdit,
  onDeletePrompt,
  onShowCustomForm,
  onCustomNameChange,
  onCustomPromptChange,
  onCustomAspectChange,
  onAddCustomPrompt,
  onViewGallery,
}: TemplateGridProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TemplateFilter>("all");

  const eligibilityMap = useMemo(() => {
    const map = new Map<number, TemplateEligibility>();
    eligibility.forEach((e) => map.set(e.num, e));
    return map;
  }, [eligibility]);

  const filteredPrompts = useMemo(() => {
    return promptsData.prompts
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => {
        const name = p.template_name.replace(/-/g, " ").toLowerCase();
        const q = search.toLowerCase();
        if (search && !name.includes(q) && !String(p.template_number).includes(q)) {
          return false;
        }
        if (filter === "selected" && !selectedTemplates.includes(p.template_number)) return false;
        if (filter === "generated" && !(generatedCounts[p.template_number] > 0)) return false;
        return true;
      });
  }, [promptsData.prompts, search, filter, selectedTemplates, generatedCounts]);

  const allSelected = selectedTemplates.length === promptsData.prompts.length;

  return (
    <div className="space-y-4">
      <div className="glass-panel p-4 rounded-xl border border-zinc-800/80 shadow-md">
        <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block mb-1">
          Prompt Modifier (Applied to all ads)
        </span>
        <p className="text-xs text-zinc-400 italic line-clamp-2">&quot;{promptsData.prompt_modifier}&quot;</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-2 text-xs text-zinc-300 min-h-[44px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["all", "selected", "generated"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] px-2.5 py-2 rounded-lg border font-semibold capitalize min-h-[44px] ${
                filter === f
                  ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400"
                  : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onToggleSelectAll}
          className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1.5 min-h-[44px]"
        >
          {allSelected ? "Deselect All" : "Select All Templates"}
          <span className="text-zinc-500">
            ({selectedTemplates.length}/{promptsData.prompts.length})
          </span>
        </button>

        <button
          onClick={() => onShowCustomForm(!showCustomPromptForm)}
          className="text-xs px-3 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-lg font-semibold flex items-center gap-1.5 min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom</span>
        </button>
      </div>

      {showCustomPromptForm && (
        <form onSubmit={onAddCustomPrompt} className="glass-panel p-5 rounded-2xl border-cyan-500/30 space-y-4 max-w-xl">
          <h3 className="text-sm font-bold text-zinc-100">Add Custom Template</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Template Name</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => onCustomNameChange(e.target.value)}
                placeholder="e.g. minimalist-hero-shot"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Aspect Ratio</label>
              <select
                value={customAspect}
                onChange={(e) => onCustomAspectChange(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300"
              >
                <option value="1:1">1:1</option>
                <option value="4:5">4:5</option>
                <option value="9:16">9:16</option>
                <option value="16:9">16:9</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Prompt Text</label>
            <textarea
              value={customPrompt}
              onChange={(e) => onCustomPromptChange(e.target.value)}
              placeholder="Describe the scene layout, text elements, and mood."
              className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300"
              required
            />
          </div>
          <div className="flex justify-end gap-2 text-xs">
            <button type="button" onClick={() => onShowCustomForm(false)} className="px-3 py-1.5 text-zinc-400">
              Cancel
            </button>
            <button type="submit" className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold rounded-lg">
              Save Template
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
        {filteredPrompts.map(({ p, idx }) => {
          const isSelected = selectedTemplates.includes(p.template_number);
          const isExpanded = expandedTemplate === p.template_number;
          const genCount = generatedCounts[p.template_number] || 0;
          const elig = eligibilityMap.get(p.template_number);
          const thumb = latestThumbnails[p.template_number];

          return (
            <div key={p.template_number} className={isExpanded ? "col-span-full" : ""}>
              <div
                className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                  isSelected
                    ? "border-cyan-500/40 bg-cyan-500/[0.04]"
                    : "border-zinc-800/60 bg-zinc-950/40 hover:border-zinc-700"
                } ${elig?.status === "blocked" ? "opacity-60" : ""}`}
              >
                {thumb && (
                  <div className="h-12 bg-zinc-900 border-b border-zinc-800/60 overflow-hidden">
                    <img src={thumb} alt="" className="w-full h-full object-cover opacity-80" loading="lazy" />
                  </div>
                )}

                <div className="p-2 flex flex-col gap-1.5 min-h-[88px]">
                  <div className="flex items-start justify-between gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTemplate(p.template_number);
                      }}
                      className="text-zinc-500 hover:text-cyan-400 shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center -m-2"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onExpandTemplate(isExpanded ? null : p.template_number)}
                      className="flex-1 text-left min-h-[44px]"
                    >
                      <span className="font-mono text-[9px] text-zinc-500">
                        #{String(p.template_number).padStart(2, "0")}
                      </span>
                      <p className="text-[10px] font-semibold text-zinc-300 capitalize line-clamp-2 leading-tight">
                        {p.template_name.replace(/-/g, " ")}
                      </p>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-0.5">
                    <span className="text-[8px] bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800 text-zinc-500">
                      {p.aspect_ratio}
                    </span>
                    {genCount > 0 && (
                      <span className="text-[8px] bg-emerald-950/50 text-emerald-400 px-1 py-0.5 rounded flex items-center gap-0.5">
                        <ImageIcon className="w-2.5 h-2.5" />
                        {genCount}
                      </span>
                    )}
                    {statusBadge(elig?.status)}
                  </div>

                  <button
                    type="button"
                    onClick={() => onExpandTemplate(isExpanded ? null : p.template_number)}
                    className="text-[9px] text-zinc-500 hover:text-cyan-400 flex items-center gap-0.5 mt-auto"
                  >
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    {isExpanded ? "Hide" : "Details"}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-2 glass-panel rounded-xl border border-zinc-800/80 p-4 space-y-3">
                  {editingPromptIndex === idx ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingPromptText}
                        onChange={(e) => onEditingTextChange(e.target.value)}
                        className="w-full h-32 bg-zinc-950 border border-cyan-500/30 rounded-xl p-3 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500"
                      />
                      <div className="flex justify-end gap-2 text-xs">
                        <button onClick={onCancelEdit} className="px-3 py-1.5 text-zinc-400">
                          Cancel
                        </button>
                        <button
                          onClick={() => onSavePrompt(idx)}
                          className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-lg flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-zinc-400 leading-relaxed font-mono line-clamp-4">{p.prompt}</p>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => onEditPrompt(idx, p.prompt)}
                            className="p-2 text-zinc-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                            title="Edit Prompt"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeletePrompt(idx)}
                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                            title="Delete Template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {genCount > 0 && onViewGallery && (
                          <button
                            onClick={() => onViewGallery(p.template_number)}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium"
                          >
                            View {genCount} generated ad{genCount !== 1 ? "s" : ""} →
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {p.notes && <p className="text-[10px] text-zinc-500 italic">Note: {p.notes}</p>}
                  {elig?.status === "blocked" && elig.missing_required.length > 0 && (
                    <p className="text-[10px] text-red-400">
                      Missing required assets: {elig.missing_required.join(", ")}
                    </p>
                  )}
                  {elig?.status === "partial" && elig.missing_preferred.length > 0 && (
                    <p className="text-[10px] text-amber-400">
                      Would improve with: {elig.missing_preferred.join(", ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredPrompts.length === 0 && (
        <p className="text-center text-xs text-zinc-500 py-8">No templates match your search or filter.</p>
      )}
    </div>
  );
}
