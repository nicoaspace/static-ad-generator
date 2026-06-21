"use client";

import { SessionProvider, useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles,
  Plus,
  Layers,
  FolderOpen,
  Image as ImageIcon,
  Play,
  Terminal,
  LogOut,
  FileText,
  Loader2,
  Tag,
  Monitor,
} from "lucide-react";
import { BrandSidebar } from "@/components/BrandSidebar";
import { TemplateGrid } from "@/components/TemplateGrid";
import { GalleryGrouped } from "@/components/GalleryGrouped";
import { GenerationCompleteModal } from "@/components/GenerationCompleteModal";
import type { Brand, GalleryImage, GenerationRun, PromptsJson, TemplateEligibility, UsageSummary } from "@/lib/types";
import { formatDuration, formatElapsed } from "@/lib/pipeline-estimate";
import { formatPipelineError, type PipelineErrorKind } from "@/lib/pipeline-errors";

function DashboardContent() {
  const { data: session } = useSession();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [isLoadingBrands, setIsLoadingBrands] = useState(true);

  const [showNewBrandModal, setShowNewBrandModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandUrl, setNewBrandUrl] = useState("");
  const [newBrandProduct, setNewBrandProduct] = useState("");
  const [newBrandType, setNewBrandType] = useState<"product" | "service">("product");
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);

  const [activeTab, setActiveTab] = useState<"dna" | "templates" | "terminal" | "gallery">("dna");

  const [dnaContent, setDnaContent] = useState("");
  const [isLoadingDna, setIsLoadingDna] = useState(false);

  const [promptsData, setPromptsData] = useState<PromptsJson | null>(null);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<number[]>([]);
  const [expandedTemplate, setExpandedTemplate] = useState<number | null>(null);
  const [editingPromptIndex, setEditingPromptIndex] = useState<number | null>(null);
  const [editingPromptText, setEditingPromptText] = useState("");
  const [generatedCounts, setGeneratedCounts] = useState<Record<number, number>>({});
  const [latestThumbnails, setLatestThumbnails] = useState<Record<number, string>>({});
  const [eligibility, setEligibility] = useState<TemplateEligibility[]>([]);

  const [showCustomPromptForm, setShowCustomPromptForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [customAspect, setCustomAspect] = useState("4:5");

  const [uploadCategory, setUploadCategory] = useState("screenshots");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [assetsRefreshKey, setAssetsRefreshKey] = useState(0);

  const [resolution, setResolution] = useState("512");
  const [variations, setVariations] = useState("2");
  const [dryRun, setDryRun] = useState(false);

  const [terminalLogs, setTerminalLogs] = useState("");
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [pipelineProgress, setPipelineProgress] = useState<{
    percent: number;
    message: string;
    estimatedSeconds?: number;
    secondsPerImage?: number;
  } | null>(null);
  const [pipelineStartedAt, setPipelineStartedAt] = useState<number | null>(null);
  const [pipelineElapsed, setPipelineElapsed] = useState(0);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineErrorKind, setPipelineErrorKind] = useState<PipelineErrorKind>("failure");
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [galleryHighlight, setGalleryHighlight] = useState<number | null>(null);
  const [generationRun, setGenerationRun] = useState<GenerationRun | null>(null);
  const [revealRun, setRevealRun] = useState<GenerationRun | null>(null);
  const [showGenerationComplete, setShowGenerationComplete] = useState(false);
  const [scrollToTemplate, setScrollToTemplate] = useState<number | null>(null);
  const [profileImgError, setProfileImgError] = useState(false);
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  const maxTemplates = usage?.limits.maxTemplatesPerGenerate ?? 3;
  const maxVariations = usage?.limits.maxVariations ?? 2;
  const resolutionOptions = usage?.limits.allowedResolutions ?? ["512", "1K"];

  useEffect(() => {
    if (!resolutionOptions.includes(resolution)) {
      setResolution(resolutionOptions[0]);
    }
  }, [resolution, resolutionOptions]);

  useEffect(() => {
    setVariations((prev) => {
      const v = parseInt(prev, 10);
      if (!Number.isFinite(v) || v > maxVariations) return String(maxVariations);
      if (v < 1) return "1";
      return prev;
    });
  }, [maxVariations]);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage");
      const data = await res.json();
      if (data.success) setUsage(data.usage);
    } catch (e) {
      console.error("Failed to fetch usage", e);
    }
  }, []);

  const canRunResearch =
    !!selectedBrand?.url && !selectedBrand.hasDna && !isRunningPipeline;

  const fetchBrands = useCallback(async (selectName?: string) => {
    setIsLoadingBrands(true);
    try {
      const res = await fetch("/api/brands");
      const data = await res.json();
      if (data.success) {
        setBrands(data.brands);
        if (selectName) {
          const found = data.brands.find((b: Brand) => b.name === selectName);
          if (found) setSelectedBrand(found);
        } else if (data.brands.length > 0) {
          setSelectedBrand((prev) => prev ?? data.brands[0]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch brands", e);
    } finally {
      setIsLoadingBrands(false);
    }
  }, []);

  const loadBrandDetail = useCallback(async () => {
    if (!selectedBrand) return;

    setIsLoadingDna(true);
    setIsLoadingPrompts(true);

    if (selectedBrand.hasDna) {
      try {
        const res = await fetch(`/api/images?brand=${selectedBrand.name}&file=brand-dna.md`);
        setDnaContent(await res.text());
      } catch (e) {
        console.error("Failed to load DNA", e);
        setDnaContent("");
      }
    } else {
      setDnaContent("");
    }
    setIsLoadingDna(false);

    if (selectedBrand.hasPrompts) {
      try {
        const res = await fetch(`/api/brands/prompts?brand=${selectedBrand.name}`);
        const data = await res.json();
        if (data.success) {
          setPromptsData(data.data);
          setSelectedTemplates([]);
        } else {
          setPromptsData(null);
          setSelectedTemplates([]);
        }
      } catch (e) {
        console.error("Failed to load prompts", e);
        setPromptsData(null);
        setSelectedTemplates([]);
      }
    } else {
      setPromptsData(null);
      setSelectedTemplates([]);
    }
    setIsLoadingPrompts(false);

    try {
      const res = await fetch(`/api/brands/recommend?brand=${encodeURIComponent(selectedBrand.name)}`);
      const data = await res.json();
      if (data.success) setEligibility(data.eligibility || []);
    } catch (e) {
      console.error("Failed to load eligibility", e);
      setEligibility([]);
    }
  }, [selectedBrand]);

  const loadGalleryFromAPI = useCallback(async () => {
    if (!selectedBrand) return;
    setIsLoadingGallery(true);
    try {
      const res = await fetch(`/api/brands?brand=${encodeURIComponent(selectedBrand.name)}`);
      const data = await res.json();
      if (data.success) {
        setGalleryImages(data.files || []);
        setGeneratedCounts(data.generatedCounts || {});
        setLatestThumbnails(data.latestThumbnails || {});
      }
    } catch (e) {
      console.error("Error loading gallery", e);
    } finally {
      setIsLoadingGallery(false);
    }
  }, [selectedBrand]);

  useEffect(() => {
    fetchBrands();
    fetchUsage();
  }, [fetchBrands, fetchUsage]);

  useEffect(() => {
    setRevealRun(null);
    setShowGenerationComplete(false);
    setScrollToTemplate(null);

    if (selectedBrand) {
      loadBrandDetail();
      loadGalleryFromAPI();
    } else {
      setDnaContent("");
      setPromptsData(null);
      setGalleryImages([]);
      setGeneratedCounts({});
      setLatestThumbnails({});
      setEligibility([]);
    }
  }, [selectedBrand, loadBrandDetail, loadGalleryFromAPI]);

  useEffect(() => {
    setProfileImgError(false);
  }, [session?.user?.image]);

  useEffect(() => {
    if (showGenerationComplete || !revealRun) return;
    const id = window.setTimeout(() => setRevealRun(null), 60_000);
    return () => window.clearTimeout(id);
  }, [showGenerationComplete, revealRun]);

  useEffect(() => {
    if (activeTab === "gallery" && selectedBrand) {
      loadGalleryFromAPI();
    }
  }, [activeTab, selectedBrand, loadGalleryFromAPI]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs]);

  useEffect(() => {
    if (!isRunningPipeline || !pipelineStartedAt) return;
    const tick = () => setPipelineElapsed(Math.floor((Date.now() - pipelineStartedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [isRunningPipeline, pipelineStartedAt]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const countNewImages = useCallback((files: GalleryImage[], run: GenerationRun) => {
    return files.filter(
      (img) =>
        img.modifiedAt &&
        img.modifiedAt >= run.startedAt - 2000 &&
        run.templateFolders.includes(img.template)
    ).length;
  }, []);

  const finishGenerationSuccess = useCallback(
    async (brandName: string, run?: GenerationRun | null) => {
      setTerminalLogs((prev) => prev + `\n[FINISHED] Process completed successfully.\n`);
      setIsRunningPipeline(false);
      setPipelineProgress({ percent: 100, message: "Complete" });
      setPipelineStartedAt(null);
      setGenerationRun(null);
      setActiveTab("gallery");

      await loadGalleryFromAPI();
      fetchBrands(brandName);
      loadBrandDetail();
      fetchUsage();

      if (run) {
        setRevealRun(run);
        setShowGenerationComplete(true);
      }
    },
    [fetchBrands, loadGalleryFromAPI, loadBrandDetail, fetchUsage]
  );

  const dismissGenerationReveal = useCallback(() => {
    setShowGenerationComplete(false);
    setRevealRun(null);
    setScrollToTemplate(null);
  }, []);

  const viewGenerationInGallery = useCallback(() => {
    if (revealRun?.templates[0] != null) {
      setScrollToTemplate(revealRun.templates[0]);
    }
    setShowGenerationComplete(false);
  }, [revealRun]);

  const showPipelineFailure = useCallback((message: string, kind: PipelineErrorKind = "failure") => {
    setGenerationRun(null);
    setPipelineError(message);
    setPipelineErrorKind(kind);
    setIsRunningPipeline(false);
    setPipelineProgress(null);
    setPipelineStartedAt(null);
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    fetchUsage();
  }, [fetchUsage]);

  const recoverFromDisconnect = useCallback(
    async (brandName: string, run: GenerationRun) => {
      setPipelineProgress((prev) => ({
        percent: prev?.percent ?? 10,
        message: "Connection lost — still checking if your ads finished generating…",
        estimatedSeconds: prev?.estimatedSeconds,
      }));

      for (let attempt = 0; attempt < 72; attempt++) {
        await new Promise((r) => setTimeout(r, 5000));

        try {
          const [statusRes, galleryRes] = await Promise.all([
            fetch("/api/pipeline/status"),
            fetch(`/api/brands?brand=${encodeURIComponent(brandName)}`),
          ]);
          const status = await statusRes.json();
          const galleryData = await galleryRes.json();
          const files: GalleryImage[] = galleryData.files || [];

          if (galleryData.success) {
            setGalleryImages(files);
            setGeneratedCounts(galleryData.generatedCounts || {});
            setLatestThumbnails(galleryData.latestThumbnails || {});
          }

          const newCount = countNewImages(files, run);
          const expected = run.templates.length * run.variations;

          if (newCount >= expected) {
            finishGenerationSuccess(brandName, run);
            return;
          }

          if (!status.running) {
            if (newCount > 0) {
              setTerminalLogs(
                (prev) =>
                  prev +
                  `\n[FINISHED] Generation ended with ${newCount}/${expected} new image(s).\n`
              );
              setIsRunningPipeline(false);
              setPipelineProgress({
                percent: Math.round((newCount / expected) * 100),
                message: `Done — ${newCount} of ${expected} images`,
              });
              setPipelineStartedAt(null);
              fetchBrands(brandName);
              fetchUsage();
              return;
            }
            break;
          }

          setPipelineProgress((prev) => ({
            percent: Math.max(
              prev?.percent ?? 10,
              expected > 0 ? Math.round((newCount / expected) * 100) : 10
            ),
            message: `Still generating… ${newCount}/${expected} images ready`,
            estimatedSeconds: prev?.estimatedSeconds,
          }));
        } catch {
          /* keep polling */
        }
      }

      showPipelineFailure(
        "We lost connection and couldn't confirm whether generation finished. Check the gallery — your images may still appear shortly.",
        "disconnect"
      );
    },
    [countNewImages, finishGenerationSuccess, fetchBrands, fetchUsage, showPipelineFailure]
  );

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName) return;
    setIsCreatingBrand(true);
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: newBrandName,
          url: newBrandUrl,
          productName: newBrandProduct,
          brandType: newBrandType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewBrandName("");
        setNewBrandUrl("");
        setNewBrandProduct("");
        setShowNewBrandModal(false);
        await fetchBrands(data.folderName);
        await fetchUsage();
      } else {
        alert(data.error || "Failed to create brand");
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred");
    } finally {
      setIsCreatingBrand(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedBrand || !e.target.files?.length) return;
    setIsUploading(true);
    setUploadSuccess(false);

    try {
      for (const file of e.target.files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("brand", selectedBrand.name);
        formData.append("brandType", selectedBrand.brandType);
        if (selectedBrand.brandType === "service") {
          formData.append("category", uploadCategory);
        }

        const res = await fetch("/api/brands/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!data.success) alert(`Failed to upload ${file.name}: ${data.error}`);
      }
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
      setAssetsRefreshKey((k) => k + 1);
      await fetchBrands(selectedBrand.name);
      await fetchUsage();
      const recRes = await fetch(`/api/brands/recommend?brand=${encodeURIComponent(selectedBrand.name)}`);
      const recData = await recRes.json();
      if (recData.success) setEligibility(recData.eligibility || []);
    } catch (e) {
      console.error(e);
      alert("Upload error");
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  useEffect(() => {
    if ((!isRunningPipeline && !generationRun) || !selectedBrand) return;
    const id = window.setInterval(() => {
      loadGalleryFromAPI();
    }, 8000);
    return () => window.clearInterval(id);
  }, [isRunningPipeline, generationRun, selectedBrand, loadGalleryFromAPI]);

  const startPipeline = (action: "research" | "generate") => {
    if (!selectedBrand) return;
    eventSourceRef.current?.close();
    setTerminalLogs("");
    setPipelineError(null);
    setPipelineProgress(null);
    setPipelineElapsed(0);
    const startedAt = Date.now();
    setPipelineStartedAt(startedAt);
    setIsRunningPipeline(true);

    const params: Record<string, string> = {
      action,
      brand: selectedBrand.name,
      type: selectedBrand.brandType,
    };

    let activeGenerationRun: GenerationRun | null = null;

    if (action === "research") {
      setGenerationRun(null);
      setActiveTab("terminal");
      params.url = selectedBrand.url;
      params.product = selectedBrand.productName;
    } else {
      const effectiveVariations = Math.min(
        parseInt(variations, 10) || 2,
        maxVariations
      );
      const templateFolders = selectedTemplates.map((num) => {
        const item = promptsData?.prompts.find((p) => p.template_number === num);
        const name = item?.template_name ?? `template-${num}`;
        return `${String(num).padStart(2, "0")}-${name}`;
      });

      activeGenerationRun = {
        startedAt,
        templates: [...selectedTemplates],
        variations: effectiveVariations,
        templateFolders,
        resolution,
      };
      setGenerationRun(activeGenerationRun);
      setActiveTab("gallery");
      if (selectedTemplates.length === 1) {
        setGalleryHighlight(selectedTemplates[0]);
      }

      params.resolution = resolution;
      params.variations = String(effectiveVariations);
      params.dryRun = dryRun ? "true" : "false";
      if (selectedTemplates.length > 0) {
        params.templates = selectedTemplates.join(",");
      }
    }

    const eventSource = new EventSource(`/api/pipeline/run?${new URLSearchParams(params)}`);
    eventSourceRef.current = eventSource;
    let pipelineStarted = false;
    let accumulatedLogs = "";

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "stdout" || data.type === "stderr") {
        accumulatedLogs += data.text;
        setTerminalLogs((prev) => prev + data.text);
      } else if (data.type === "status") {
        pipelineStarted = true;
        setTerminalLogs((prev) => prev + `[SYSTEM] ${data.text}\n`);
      } else if (data.type === "progress") {
        pipelineStarted = true;
        setPipelineProgress((prev) => ({
          percent: typeof data.percent === "number" ? data.percent : prev?.percent ?? 0,
          message: data.message || prev?.message || "Working…",
          estimatedSeconds:
            typeof data.estimatedSeconds === "number"
              ? data.estimatedSeconds
              : prev?.estimatedSeconds,
          secondsPerImage:
            typeof data.secondsPerImage === "number"
              ? data.secondsPerImage
              : prev?.secondsPerImage,
        }));
      } else if (data.type === "error") {
        eventSource.close();
        eventSourceRef.current = null;
        setTerminalLogs((prev) => prev + `\n[ERROR] ${data.text}\n`);
        showPipelineFailure(
          data.text ||
            "We encountered an error and couldn't finish generating your ads. Please try again in a few minutes."
        );
      } else if (data.type === "exit") {
        eventSource.close();
        eventSourceRef.current = null;
        if (data.success) {
          if (action === "generate") {
            void finishGenerationSuccess(selectedBrand.name, activeGenerationRun);
          } else {
            setTerminalLogs((prev) => prev + `\n[FINISHED] Process completed successfully.\n`);
            setIsRunningPipeline(false);
            setPipelineProgress({ percent: 100, message: "Complete" });
            setPipelineStartedAt(null);
            fetchBrands(selectedBrand.name);
            loadGalleryFromAPI();
            loadBrandDetail();
            fetchUsage();
          }
        } else {
          if (data.message) {
            setTerminalLogs((prev) => prev + `\n[ERROR] ${data.message}\n`);
          }
          const friendlyError =
            formatPipelineError(accumulatedLogs) ||
            (typeof data.message === "string" ? data.message : null);
          showPipelineFailure(
            friendlyError ||
              "We encountered an error and couldn't finish generating your ads. Please try again in a few minutes.",
            "failure"
          );
        }
      }
    };

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) return;
      eventSource.close();
      eventSourceRef.current = null;
      if (action === "generate" && activeGenerationRun && pipelineStarted) {
        setTerminalLogs(
          (prev) => prev + `\n[WARN] Connection to server lost. Checking if generation is still running…\n`
        );
        void recoverFromDisconnect(selectedBrand.name, activeGenerationRun);
      } else {
        showPipelineFailure(
          "We lost connection to the server while your ads were generating. Please try again in a few minutes."
        );
      }
    };
  };

  const toggleTemplate = (num: number) => {
    setSelectedTemplates((prev) => {
      if (prev.includes(num)) return prev.filter((n) => n !== num);
      if (prev.length >= maxTemplates) {
        alert(`You can select at most ${maxTemplates} templates per run.`);
        return prev;
      }
      return [...prev, num];
    });
  };

  const toggleSelectAllTemplates = () => {
    if (!promptsData) return;
    const nums = promptsData.prompts.map((p) => p.template_number);
    setSelectedTemplates((prev) => (prev.length === nums.length ? [] : nums));
  };

  const handleSavePrompt = async (index: number) => {
    if (!promptsData || !selectedBrand) return;
    const updatedPrompts = [...promptsData.prompts];
    updatedPrompts[index] = { ...updatedPrompts[index], prompt: editingPromptText };
    const updatedData = { ...promptsData, prompts: updatedPrompts };

    try {
      const res = await fetch("/api/brands/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: selectedBrand.name, data: updatedData }),
      });
      const resData = await res.json();
      if (resData.success) {
        setPromptsData(updatedData);
        setEditingPromptIndex(null);
      } else {
        alert("Failed to save prompt: " + resData.error);
      }
    } catch (e) {
      console.error(e);
      alert("Error saving prompt");
    }
  };

  const handleDeletePrompt = async (index: number) => {
    if (!promptsData || !selectedBrand || !confirm("Delete this prompt template?")) return;
    const deletedNum = promptsData.prompts[index].template_number;
    const updatedData = {
      ...promptsData,
      prompts: promptsData.prompts.filter((_, idx) => idx !== index),
    };

    try {
      const res = await fetch("/api/brands/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: selectedBrand.name, data: updatedData }),
      });
      const resData = await res.json();
      if (resData.success) {
        setPromptsData(updatedData);
        setSelectedTemplates((prev) => prev.filter((n) => n !== deletedNum));
        if (expandedTemplate === deletedNum) setExpandedTemplate(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddCustomPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptsData || !selectedBrand || !customPrompt || !customName) return;

    const existingNums = promptsData.prompts.map((p) => p.template_number);
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;

    const newItem = {
      template_number: nextNum,
      template_name: customName.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      prompt: customPrompt,
      aspect_ratio: customAspect,
      notes: "Custom Template added by user",
      needs_product_images: selectedBrand.brandType === "product",
      required_assets: selectedBrand.brandType === "service" ? ["screenshots"] : [],
    };

    if (promptsData.prompt_modifier && !customPrompt.includes(promptsData.prompt_modifier)) {
      newItem.prompt = promptsData.prompt_modifier + " " + customPrompt;
    }

    const updatedData = { ...promptsData, prompts: [...promptsData.prompts, newItem] };

    try {
      const res = await fetch("/api/brands/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: selectedBrand.name, data: updatedData }),
      });
      const resData = await res.json();
      if (resData.success) {
        setPromptsData(updatedData);
        setCustomName("");
        setCustomPrompt("");
        setShowCustomPromptForm(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const viewGalleryForTemplate = (templateNum: number) => {
    setGalleryHighlight(templateNum);
    setActiveTab("gallery");
  };

  const renderMarkdownHTML = (md: string) => {
    if (!md) return "";
    return md
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-3 text-cyan-400">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold text-zinc-100 mt-5 mb-2.5 border-b border-zinc-800/80 pb-1.5 flex items-center gap-2"><span class="w-1.5 h-4 bg-cyan-500 rounded-full"></span>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-medium text-zinc-300 mt-4 mb-2">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-200 font-semibold">$1</strong>')
      .replace(/`(.*?)`/g, '<code class="bg-zinc-900/80 border border-zinc-800/50 px-1.5 py-0.5 rounded text-cyan-400 font-mono text-xs">$1</code>')
      .replace(/\n/g, "<br/>");
  };

  const tabs = [
    { id: "dna" as const, label: "Brand DNA", icon: FileText },
    { id: "templates" as const, label: "Templates", icon: Layers },
    { id: "terminal" as const, label: "Console", icon: Terminal },
    { id: "gallery" as const, label: "Generated Ads", icon: ImageIcon },
  ];

  const formatMb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#08080a] text-zinc-200 selection:bg-cyan-500/30 selection:text-cyan-200">
      <header className="h-16 border-b border-zinc-800/60 bg-[#0c0c10]/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/10">
            <Sparkles className="w-5 h-5 text-zinc-950" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-zinc-100">Static Ad Gen - Tu Publicas</span>
          <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400 border border-zinc-700/50">
            Micro-SaaS Demo
          </span>
        </div>

        {session?.user && (
          <div className="flex items-center gap-3 sm:gap-4">
            {usage && (
              <div
                className="hidden md:flex items-center gap-3 text-[10px] text-zinc-500 border border-zinc-800/60 rounded-full px-3 py-1.5 bg-zinc-900/40"
                title="Your usage limits (resets daily at midnight UTC)"
              >
                <span>
                  Brands {usage.brands.used}/{usage.brands.limit}
                </span>
                <span className="text-zinc-700">|</span>
                <span>
                  Storage {formatMb(usage.storage.usedBytes)}/{formatMb(usage.storage.limitBytes)}
                </span>
                <span className="text-zinc-700">|</span>
                <span>
                  Research {usage.daily.research.used}/{usage.daily.research.limit}
                </span>
                <span className="text-zinc-700">|</span>
                <span>
                  Generate {usage.daily.generate.used}/{usage.daily.generate.limit}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2.5 bg-zinc-900/50 border border-zinc-800/60 pl-2.5 pr-3 py-1 rounded-full">
              {session.user.image && !profileImgError ? (
                <img
                  src={session.user.image}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setProfileImgError(true)}
                  className="w-6 h-6 rounded-full border border-zinc-700 object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-cyan-600 text-zinc-950 flex items-center justify-center font-bold text-xs">
                  {session.user.name?.[0] || "U"}
                </div>
              )}
              <span className="text-xs font-medium text-zinc-300">{session.user.name}</span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Sign Out"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden">
        <BrandSidebar
          brands={brands}
          selectedBrand={selectedBrand}
          isLoadingBrands={isLoadingBrands}
          onSelectBrand={setSelectedBrand}
          onCreateBrand={() => {
            if (usage && usage.brands.used >= usage.brands.limit) {
              alert(`Brand limit reached (${usage.brands.limit} per user).`);
              return;
            }
            setShowNewBrandModal(true);
          }}
          uploadCategory={uploadCategory}
          onUploadCategoryChange={setUploadCategory}
          isUploading={isUploading}
          uploadSuccess={uploadSuccess}
          onFileUpload={handleFileUpload}
          assetsRefreshKey={assetsRefreshKey}
        />

        <section className="lg:col-span-3 flex flex-col bg-[#0b0b0f] overflow-hidden">
          <div className="h-12 border-b border-zinc-800/60 bg-[#0e0e14] flex items-center justify-between px-4 sm:px-6 gap-2">
            <div className="flex items-center gap-1 overflow-x-auto flex-nowrap scrollbar-thin min-w-0 flex-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`h-12 px-3 sm:px-4 border-b-2 flex items-center gap-2 text-xs font-semibold transition-all shrink-0 whitespace-nowrap min-h-[44px] ${
                      activeTab === tab.id
                        ? "border-cyan-500 text-cyan-400"
                        : "border-transparent text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {selectedBrand && (
              <div className="flex items-center gap-2 shrink-0">
                {activeTab === "dna" && !selectedBrand.hasDna && (
                  <button
                    onClick={() => startPipeline("research")}
                    disabled={!canRunResearch}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold rounded-lg text-xs disabled:opacity-50 min-h-[44px]"
                  >
                    {isRunningPipeline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                    <span className="hidden sm:inline">Run Research</span>
                  </button>
                )}
                {activeTab === "templates" && promptsData && (
                  <button
                    onClick={() => startPipeline("generate")}
                    disabled={isRunningPipeline || selectedTemplates.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold rounded-lg text-xs disabled:opacity-50 min-h-[44px]"
                  >
                    {isRunningPipeline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>Generate ({selectedTemplates.length})</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 p-4 sm:p-6 overflow-y-auto relative">
            {!selectedBrand ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                <FolderOpen className="w-12 h-12 text-zinc-700 mb-3" />
                <h3 className="font-bold text-zinc-400">No Brand Selected</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs">Create or select a brand from the sidebar.</p>
              </div>
            ) : (
              <>
                {activeTab === "dna" && (
                  <div className="space-y-4 max-w-3xl">
                    <div className="border-b border-zinc-800 pb-3">
                      <h2 className="text-xl font-extrabold text-zinc-100">
                        Brand DNA: <span className="text-cyan-400">{selectedBrand.name}</span>
                      </h2>
                      <p className="text-xs text-zinc-500 mt-1">Generated with OpenRouter (Nemotron + Grok Imagine).</p>
                    </div>

                    {isLoadingDna ? (
                      <div className="py-20 flex flex-col items-center text-zinc-500">
                        <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
                        <span>Loading brand DNA...</span>
                      </div>
                    ) : dnaContent ? (
                      <div
                        className="glass-panel p-6 rounded-2xl text-zinc-300 text-sm leading-relaxed border border-zinc-800/80"
                        dangerouslySetInnerHTML={{ __html: renderMarkdownHTML(dnaContent) }}
                      />
                    ) : (
                      <div className="text-center py-16 glass-panel rounded-2xl border border-dashed border-zinc-800/80 p-6">
                        <FileText className="w-12 h-12 text-zinc-700 mb-3 mx-auto" />
                        <span className="font-bold text-zinc-400 text-sm block">No DNA Generated Yet</span>
                        <button
                          onClick={() => startPipeline("research")}
                          disabled={!canRunResearch}
                          className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold rounded-xl text-xs disabled:opacity-50 min-h-[44px]"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Generate DNA
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "templates" && (
                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-4 gap-4">
                      <div>
                        <h2 className="text-xl font-extrabold text-zinc-100">Template Playroom</h2>
                        <p className="text-xs text-zinc-500 mt-1">
                          Select up to {maxTemplates} templates from the grid. Expand a card to edit its prompt.
                          {usage?.provider ? (
                            <>
                              {" "}
                              Images via {usage.provider.imageModel} (~{usage.provider.secondsPerImage}s each).
                            </>
                          ) : null}
                        </p>
                      </div>

                      {promptsData && (
                        <div className="flex flex-wrap items-center gap-3 bg-zinc-900/40 p-2 border border-zinc-800/60 rounded-xl">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] text-zinc-500 font-semibold uppercase">Resolution</span>
                            <select
                              value={resolution}
                              onChange={(e) => setResolution(e.target.value)}
                              className="bg-zinc-950 text-xs px-2.5 py-1.5 border border-zinc-800 rounded-lg text-zinc-300 min-h-[44px]"
                            >
                              {resolutionOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt === "1K" ? "1K" : `${opt}px`}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] text-zinc-500 font-semibold uppercase">Variations</span>
                            <select
                              value={variations}
                              onChange={(e) => setVariations(e.target.value)}
                              className="bg-zinc-950 text-xs px-2.5 py-1.5 border border-zinc-800 rounded-lg text-zinc-300 min-h-[44px]"
                            >
                              {Array.from({ length: maxVariations }, (_, i) => i + 1).map((n) => (
                                <option key={n} value={String(n)}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </div>
                          {selectedTemplates.length > 0 && (
                            <div className="text-[10px] text-zinc-500 self-end pb-1">
                              = {selectedTemplates.length * Math.min(parseInt(variations, 10) || 2, maxVariations)} images
                            </div>
                          )}
                          <button
                            onClick={() => setDryRun(!dryRun)}
                            className={`px-3 py-2 rounded-lg border text-xs font-semibold min-h-[44px] ${
                              dryRun
                                ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
                                : "bg-zinc-950 border-zinc-800 text-zinc-400"
                            }`}
                          >
                            Dry Run
                          </button>
                        </div>
                      )}
                    </div>

                    {isLoadingPrompts ? (
                      <div className="py-20 flex flex-col items-center text-zinc-500">
                        <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
                        <span>Loading templates...</span>
                      </div>
                    ) : promptsData ? (
                      <TemplateGrid
                        promptsData={promptsData}
                        selectedTemplates={selectedTemplates}
                        generatedCounts={generatedCounts}
                        latestThumbnails={latestThumbnails}
                        eligibility={eligibility}
                        editingPromptIndex={editingPromptIndex}
                        editingPromptText={editingPromptText}
                        showCustomPromptForm={showCustomPromptForm}
                        customName={customName}
                        customPrompt={customPrompt}
                        customAspect={customAspect}
                        expandedTemplate={expandedTemplate}
                        onToggleTemplate={toggleTemplate}
                        onToggleSelectAll={toggleSelectAllTemplates}
                        onExpandTemplate={setExpandedTemplate}
                        onEditPrompt={(idx, text) => {
                          setEditingPromptIndex(idx);
                          setEditingPromptText(text);
                        }}
                        onEditingTextChange={setEditingPromptText}
                        onSavePrompt={handleSavePrompt}
                        onCancelEdit={() => setEditingPromptIndex(null)}
                        onDeletePrompt={handleDeletePrompt}
                        onShowCustomForm={setShowCustomPromptForm}
                        onCustomNameChange={setCustomName}
                        onCustomPromptChange={setCustomPrompt}
                        onCustomAspectChange={setCustomAspect}
                        onAddCustomPrompt={handleAddCustomPrompt}
                        onViewGallery={viewGalleryForTemplate}
                      />
                    ) : (
                      <div className="text-center py-16 glass-panel rounded-2xl border border-dashed border-zinc-800/80 p-6">
                        <Layers className="w-12 h-12 text-zinc-700 mb-3 mx-auto" />
                        <span className="font-bold text-zinc-400 text-sm block">No Prompts Yet</span>
                        <p className="text-xs text-zinc-500 mt-1.5 max-w-xs mx-auto">
                          Run Phase 2 prompt generation first.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "terminal" && (
                  <div className="space-y-4 flex flex-col h-[calc(100vh-16rem)] min-h-[400px]">
                    <div className="border-b border-zinc-800 pb-3">
                      <h2 className="text-xl font-extrabold text-zinc-100 flex items-center gap-2">
                        <Terminal className="w-5 h-5 text-cyan-400" />
                        Pipeline Console
                      </h2>
                    </div>

                    {(isRunningPipeline || pipelineProgress) && (
                      <div className="glass-panel rounded-2xl border border-zinc-800/80 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-zinc-300 font-semibold truncate">
                            {pipelineProgress?.message || "Running pipeline…"}
                          </span>
                          <span className="text-cyan-400 font-bold shrink-0">
                            {pipelineProgress?.percent ?? 0}%
                          </span>
                        </div>
                        <div className="h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-500 ease-out"
                            style={{ width: `${Math.min(100, pipelineProgress?.percent ?? 0)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
                          <span>
                            {isRunningPipeline ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Loader2 className="w-3 h-3 animate-spin text-cyan-500" />
                                In progress
                              </span>
                            ) : (
                              "Finished"
                            )}
                          </span>
                          <span>
                            Elapsed: {formatElapsed(pipelineElapsed)}
                            {pipelineProgress?.secondsPerImage
                              ? ` · ~${pipelineProgress.secondsPerImage}s/image`
                              : ""}
                            {pipelineProgress?.estimatedSeconds
                              ? ` · Est. total: ${formatDuration(pipelineProgress.estimatedSeconds)}`
                              : ""}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex-1 bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-4 font-mono text-xs text-zinc-300 overflow-y-auto terminal-scrollbar">
                      <pre className="whitespace-pre-wrap leading-relaxed">
                        {terminalLogs || "Console idle. Run research or generation to see output."}
                      </pre>
                      <div ref={terminalEndRef} />
                    </div>
                  </div>
                )}

                {activeTab === "gallery" && (
                  <div className="space-y-6">
                    <div className="border-b border-zinc-800 pb-4">
                      <h2 className="text-xl font-extrabold text-zinc-100">Generated Ad Creatives</h2>
                      <p className="text-xs text-zinc-500 mt-1">Grouped by template. Click to enlarge.</p>
                    </div>
                    <GalleryGrouped
                      brandName={selectedBrand.name}
                      images={galleryImages}
                      isLoading={isLoadingGallery}
                      highlightTemplate={galleryHighlight}
                      onHighlightConsumed={() => setGalleryHighlight(null)}
                      isGenerating={isRunningPipeline && !!generationRun}
                      generationRun={generationRun}
                      revealRun={revealRun}
                      scrollToTemplate={scrollToTemplate}
                      onScrollComplete={() => setScrollToTemplate(null)}
                      pipelineProgress={pipelineProgress}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      {showGenerationComplete && revealRun && (
        <GenerationCompleteModal
          run={revealRun}
          images={galleryImages}
          onViewInGallery={viewGenerationInGallery}
          onDismiss={dismissGenerationReveal}
        />
      )}

      {pipelineError && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 relative shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-red-500/50" />
            <h3 className="text-lg font-bold text-zinc-100 mb-2">
              {pipelineErrorKind === "disconnect" ? "Generation interrupted" : "Generation failed"}
            </h3>
            <p
              className={`text-sm text-zinc-400 leading-relaxed ${
                pipelineErrorKind === "disconnect" ? "mb-1" : "mb-6"
              }`}
            >
              {pipelineError}
            </p>
            {pipelineErrorKind === "disconnect" && (
              <p className="text-xs text-zinc-500 mb-6">
                Your daily generation limit was not used for this attempt.
              </p>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPipelineError(null)}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold rounded-xl text-sm min-h-[44px]"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewBrandModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 relative shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-cyan-500/50" />

            <h3 className="text-lg font-bold text-zinc-100 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-400" />
              Initialize Brand Workspace
            </h3>

            <form onSubmit={handleCreateBrand} className="space-y-4">
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Brand Name</label>
                <input
                  type="text"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-300 min-h-[44px]"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Website URL</label>
                <input
                  type="url"
                  value={newBrandUrl}
                  onChange={(e) => setNewBrandUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-300 min-h-[44px]"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Target Product</label>
                <input
                  type="text"
                  value={newBrandProduct}
                  onChange={(e) => setNewBrandProduct(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-300 min-h-[44px]"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1.5">Brand Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewBrandType("product")}
                    className={`py-3.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 min-h-[44px] ${
                      newBrandType === "product"
                        ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                        : "bg-zinc-950 border-zinc-850 text-zinc-500"
                    }`}
                  >
                    <Tag className="w-4 h-4" />
                    DTC Product
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewBrandType("service")}
                    className={`py-3.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 min-h-[44px] ${
                      newBrandType === "service"
                        ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                        : "bg-zinc-950 border-zinc-850 text-zinc-500"
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                    SaaS / Service
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2.5 pt-4">
                <button type="button" onClick={() => setShowNewBrandModal(false)} className="px-4 py-2 text-zinc-400 min-h-[44px]">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingBrand}
                  className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold rounded-xl flex items-center gap-2 min-h-[44px]"
                >
                  {isCreatingBrand && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <SessionProvider>
      <DashboardContent />
    </SessionProvider>
  );
}
