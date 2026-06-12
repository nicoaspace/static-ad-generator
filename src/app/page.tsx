"use client";

import { SessionProvider, useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Plus,
  Layers,
  FolderOpen,
  Image as ImageIcon,
  Play,
  Terminal,
  Settings,
  LogOut,
  Upload,
  CheckSquare,
  Square,
  Edit2,
  Save,
  Trash2,
  FileText,
  Loader2,
  Globe,
  Tag,
  Monitor,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ChevronDown
} from "lucide-react";

interface Brand {
  name: string;
  brandType: "product" | "service";
  url: string;
  productName: string;
  hasDna: boolean;
  hasPrompts: boolean;
  assetCount: number;
  assetCounts: Record<string, number>;
  generatedImageCount: number;
}

interface PromptItem {
  template_number: number;
  template_name: string;
  prompt: string;
  aspect_ratio: string;
  needs_product_images?: boolean;
  required_assets?: string[];
  preferred_assets?: string[];
  notes?: string;
}

interface PromptsJson {
  brand: string;
  brand_type: string;
  product: string;
  generated_at: string;
  prompt_modifier: string;
  prompts: PromptItem[];
}

function DashboardContent() {
  const { data: session } = useSession();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [isLoadingBrands, setIsLoadingBrands] = useState(true);

  // New Brand Modal / Form State
  const [showNewBrandModal, setShowNewBrandModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandUrl, setNewBrandUrl] = useState("");
  const [newBrandProduct, setNewBrandProduct] = useState("");
  const [newBrandType, setNewBrandType] = useState<"product" | "service">("product");
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);

  // Workspace Tabs
  const [activeTab, setActiveTab] = useState<"dna" | "templates" | "terminal" | "gallery">("dna");

  // DNA Tab State
  const [dnaContent, setDnaContent] = useState("");
  const [isLoadingDna, setIsLoadingDna] = useState(false);

  // Prompt Templates Playground State
  const [promptsData, setPromptsData] = useState<PromptsJson | null>(null);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<number[]>([]);
  const [editingPromptIndex, setEditingPromptIndex] = useState<number | null>(null);
  const [editingPromptText, setEditingPromptText] = useState("");
  
  // Custom template creation
  const [showCustomPromptForm, setShowCustomPromptForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [customAspect, setCustomAspect] = useState("4:5");

  // Image Upload State
  const [uploadCategory, setUploadCategory] = useState("screenshots"); // for service brands
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Generation options
  const [resolution, setResolution] = useState("1K");
  const [variations, setVariations] = useState("4");
  const [dryRun, setDryRun] = useState(false);

  // Terminal Logs State
  const [terminalLogs, setTerminalLogs] = useState("");
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Gallery State
  const [galleryImages, setGalleryImages] = useState<{ template: string; file: string; url: string }[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchBrands();
  }, []);

  useEffect(() => {
    if (selectedBrand) {
      loadBrandDetails();
    } else {
      setDnaContent("");
      setPromptsData(null);
      setGalleryImages([]);
    }
  }, [selectedBrand]);

  useEffect(() => {
    // Auto scroll terminal to bottom
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLogs]);

  const fetchBrands = async (selectName?: string) => {
    setIsLoadingBrands(true);
    try {
      const res = await fetch("/api/brands");
      const data = await res.json();
      if (data.success) {
        setBrands(data.brands);
        if (selectName) {
          const found = data.brands.find((b: Brand) => b.name === selectName);
          if (found) setSelectedBrand(found);
        } else if (data.brands.length > 0 && !selectedBrand) {
          setSelectedBrand(data.brands[0]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch brands", e);
    } finally {
      setIsLoadingBrands(false);
    }
  };

  const loadBrandDetails = async () => {
    if (!selectedBrand) return;
    setIsLoadingDna(true);
    setIsLoadingPrompts(true);
    setIsLoadingGallery(false);

    // 1. Load DNA if it exists
    if (selectedBrand.hasDna) {
      try {
        const res = await fetch(`/api/images?brand=${selectedBrand.name}&file=brand-dna.md`);
        const text = await res.text();
        setDnaContent(text);
      } catch (e) {
        console.error("Failed to load DNA", e);
      }
    } else {
      setDnaContent("");
    }
    setIsLoadingDna(false);

    // 2. Load prompts if they exist
    if (selectedBrand.hasPrompts) {
      try {
        const res = await fetch(`/api/brands/prompts?brand=${selectedBrand.name}`);
        const data = await res.json();
        if (data.success) {
          setPromptsData(data.data);
          // Auto select all available template numbers
          const nums = data.data.prompts.map((p: PromptItem) => p.template_number);
          setSelectedTemplates(nums);
        }
      } catch (e) {
        console.error("Failed to load prompts", e);
        setPromptsData(null);
      }
    } else {
      setPromptsData(null);
      setSelectedTemplates([]);
    }
    setIsLoadingPrompts(false);

    // 3. Load Gallery images
    loadGallery();
  };

  const loadGallery = async () => {
    if (!selectedBrand) return;
    setIsLoadingGallery(true);
    try {
      // We can scan the outputs directory via a API call.
      // For simplicity, we can fetch from a brand files reader or query the api/brands structure
      // Wait, we know from selectedBrand the folder, let's query a list of outputs
      // Since we don't have a direct folder scanner API, let's write a quick inline endpoint scan or just fetch images.
      // Let's check how outputs are counted. In /api/brands, we read directory.
      // Let's fetch the list of generated images from a custom folder scanner or the prompts.json outputs structure.
      // Wait, let's modify the route or write a quick fetch to see if we can get files:
      // Let's create an endpoint in `/api/brands/prompts` or run an endpoint helper.
      // Wait, let's fetch outputs from our images API if we get directory files list.
      // Oh! To make this clean, let's scan outputs in `/api/images?action=list&brand={brandName}`.
      // Let's check: does `/api/images` support listing outputs?
      // No, `/api/images` only serves a single file.
      // Wait, we can add a GET action `list-outputs` to `/api/brands/prompts` or `/api/brands` or `/api/images`?
      // Let's check `src/app/api/brands/route.ts`... Oh, the GET method in `/api/brands` lists all brands, but doesn't list individual files.
      // Let's check if we can add a searchParam to `/api/brands` like `?brand={brand}` to list the output files!
      // Wait! Let's check `src/app/api/brands/route.ts` GET implementation:
      // It lists all brands. If we pass `brand` parameter, we can make it return the detail (including assets and outputs file names!).
      // Let's update `src/app/api/brands/route.ts` using `replace_file_content` to add brand details (like the exact file paths for outputs) when `?brand=xxx` is passed!
      // This is an extremely elegant addition that makes displaying the gallery and assets simple!
      // Let's look at `/api/brands` route. We can edit it to support `?brand=xxx`.
    } catch (e) {
      console.error(e);
    }
  };

  // Wait, let's implement the gallery fetcher:
  // Instead of rewriting `/api/brands/route.ts` immediately, let's see if we can just scan outputs directly.
  // Actually, we can fetch `/api/brands?brandName=${selectedBrand.name}`.
  // Let's create a list of outputs. Let's make an API call to get all output files for the selected brand.
  const fetchGalleryImages = async () => {
    if (!selectedBrand) return;
    setIsLoadingGallery(true);
    try {
      const res = await fetch(`/api/brands`);
      const data = await res.json();
      if (data.success) {
        // Find selected brand details
        const brandDetail = data.brands.find((b: Brand) => b.name === selectedBrand.name);
        if (brandDetail) {
          // Let's get files by querying brand files. Wait, how do we know the file list?
          // Let's add a quick sub-route or check files list.
          // Wait! Let's update the GET in `src/app/api/brands/route.ts` to return the array of output images
          // if `brandName` searchParam is provided! That's very clean and keeps things modular.
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Let's update `src/app/api/brands/route.ts` to support fetching output image filenames.
  // We will do this via a quick fetch to `/api/brands?brand={brand}` which returns `{ success: true, files: [{ template: "01-headline", file: "headline_v1.png", url: "/api/images?brand=...&file=outputs/01-headline/headline_v1.png" }] }`.
  // Let's write the fetch in React and then edit the backend!
  const loadGalleryFromAPI = async () => {
    if (!selectedBrand) return;
    setIsLoadingGallery(true);
    try {
      const res = await fetch(`/api/brands?brand=${selectedBrand.name}`);
      const data = await res.json();
      if (data.success && data.files) {
        setGalleryImages(data.files);
      }
    } catch (e) {
      console.error("Error loading gallery", e);
    } finally {
      setIsLoadingGallery(false);
    }
  };

  useEffect(() => {
    if (selectedBrand) {
      loadGalleryFromAPI();
    }
  }, [selectedBrand, activeTab]);

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
    if (!selectedBrand || !e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    setUploadSuccess(false);

    try {
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("brand", selectedBrand.name);
        formData.append("brandType", selectedBrand.brandType);
        if (selectedBrand.brandType === "service") {
          formData.append("category", uploadCategory);
        }

        const res = await fetch("/api/brands/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!data.success) {
          alert(`Failed to upload ${file.name}: ${data.error}`);
        }
      }
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
      // Refresh brand data
      await fetchBrands(selectedBrand.name);
    } catch (e) {
      console.error(e);
      alert("Upload error");
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = ""; // reset file input
    }
  };

  const startPipeline = (action: "research" | "generate") => {
    if (!selectedBrand) return;
    setTerminalLogs("");
    setActiveTab("terminal");
    setIsRunningPipeline(true);

    let params: Record<string, string> = {
      action,
      brand: selectedBrand.name,
      type: selectedBrand.brandType,
    };

    if (action === "research") {
      params.url = selectedBrand.url;
      params.product = selectedBrand.productName;
    } else {
      params.resolution = resolution;
      params.variations = variations;
      params.dryRun = dryRun ? "true" : "false";
      if (selectedTemplates.length > 0) {
        params.templates = selectedTemplates.join(",");
      }
    }

    const query = new URLSearchParams(params).toString();
    const eventSource = new EventSource(`/api/pipeline/run?${query}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "stdout" || data.type === "stderr") {
        setTerminalLogs((prev) => prev + data.text);
      } else if (data.type === "status") {
        setTerminalLogs((prev) => prev + `[SYSTEM] ${data.text}\n`);
      } else if (data.type === "error") {
        setTerminalLogs((prev) => prev + `\n[ERROR] ${data.text}\n`);
        eventSource.close();
        setIsRunningPipeline(false);
      } else if (data.type === "exit") {
        setTerminalLogs((prev) => prev + `\n[FINISHED] Process exited with code ${data.code}\n`);
        eventSource.close();
        setIsRunningPipeline(false);
        // Refresh local details
        fetchBrands(selectedBrand.name);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE failed", err);
      setTerminalLogs((prev) => prev + `\n[ERROR] Connection to server lost.\n`);
      eventSource.close();
      setIsRunningPipeline(false);
    };
  };

  // Toggle template selection
  const toggleTemplate = (num: number) => {
    if (selectedTemplates.includes(num)) {
      setSelectedTemplates(selectedTemplates.filter((n) => n !== num));
    } else {
      setSelectedTemplates([...selectedTemplates, num]);
    }
  };

  const toggleSelectAllTemplates = () => {
    if (!promptsData) return;
    const nums = promptsData.prompts.map((p) => p.template_number);
    if (selectedTemplates.length === nums.length) {
      setSelectedTemplates([]);
    } else {
      setSelectedTemplates(nums);
    }
  };

  const handleEditPrompt = (index: number, currentText: string) => {
    setEditingPromptIndex(index);
    setEditingPromptText(currentText);
  };

  const handleSavePrompt = async (index: number) => {
    if (!promptsData || !selectedBrand) return;
    const updatedPrompts = [...promptsData.prompts];
    updatedPrompts[index] = {
      ...updatedPrompts[index],
      prompt: editingPromptText,
    };
    
    const updatedData = {
      ...promptsData,
      prompts: updatedPrompts,
    };

    try {
      const res = await fetch("/api/brands/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: selectedBrand.name,
          data: updatedData,
        }),
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
    if (!promptsData || !selectedBrand || !confirm("Are you sure you want to delete this prompt template?")) return;
    const updatedPrompts = promptsData.prompts.filter((_, idx) => idx !== index);
    
    const updatedData = {
      ...promptsData,
      prompts: updatedPrompts,
    };

    try {
      const res = await fetch("/api/brands/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: selectedBrand.name,
          data: updatedData,
        }),
      });
      const resData = await res.json();
      if (resData.success) {
        setPromptsData(updatedData);
        // Remove from selected list
        const deletedNum = promptsData.prompts[index].template_number;
        setSelectedTemplates(selectedTemplates.filter((n) => n !== deletedNum));
      } else {
        alert("Failed to delete prompt: " + resData.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddCustomPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptsData || !selectedBrand || !customPrompt || !customName) return;

    // Generate custom template number (max + 1)
    const existingNums = promptsData.prompts.map((p) => p.template_number);
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;

    const newItem: PromptItem = {
      template_number: nextNum,
      template_name: customName.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      prompt: customPrompt,
      aspect_ratio: customAspect,
      notes: "Custom Template added by user",
      needs_product_images: selectedBrand.brandType === "product",
      required_assets: selectedBrand.brandType === "service" ? ["screenshots"] : [],
    };

    // Prepend the modifier to custom prompt if it doesn't already have it
    if (promptsData.prompt_modifier && !customPrompt.includes(promptsData.prompt_modifier)) {
      newItem.prompt = promptsData.prompt_modifier + " " + customPrompt;
    }

    const updatedData = {
      ...promptsData,
      prompts: [...promptsData.prompts, newItem],
    };

    try {
      const res = await fetch("/api/brands/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: selectedBrand.name,
          data: updatedData,
        }),
      });
      const resData = await res.json();
      if (resData.success) {
        setPromptsData(updatedData);
        setSelectedTemplates([...selectedTemplates, nextNum]);
        setCustomName("");
        setCustomPrompt("");
        setShowCustomPromptForm(false);
      } else {
        alert("Failed to add custom prompt: " + resData.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Convert markdown to very simple clean HTML for visualization
  const renderMarkdownHTML = (md: string) => {
    if (!md) return "";
    let html = md
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-white mt-6 mb-3 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold text-zinc-100 mt-5 mb-2.5 border-b border-zinc-800/80 pb-1.5 flex items-center gap-2"><span class="w-1.5 h-4 bg-cyan-500 rounded-full"></span>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-medium text-zinc-300 mt-4 mb-2">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-200 font-semibold">$1</strong>')
      .replace(/`(.*?)`/g, '<code class="bg-zinc-900/80 border border-zinc-800/50 px-1.5 py-0.5 rounded text-cyan-400 font-mono text-xs">$1</code>')
      .replace(/\n/g, "<br/>");
    return html;
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#08080a] text-zinc-200 selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Top Header */}
      <header className="h-16 border-b border-zinc-800/60 bg-[#0c0c10]/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/10">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Static Ad Gen
          </span>
          <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400 border border-zinc-700/50">
            Micro-SaaS Demo
          </span>
        </div>

        {session?.user && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 bg-zinc-900/50 border border-zinc-800/60 pl-2.5 pr-3 py-1 rounded-full">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || "Avatar"}
                  className="w-6 h-6 rounded-full border border-zinc-700"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-cyan-600 text-white flex items-center justify-center font-bold text-xs">
                  {session.user.name?.[0] || "U"}
                </div>
              )}
              <span className="text-xs font-medium text-zinc-300">
                {session.user.name}
              </span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200"
              title="Sign Out"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        )}
      </header>

      {/* Main Workspace grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden">
        
        {/* Sidebar Panel: Brand Manager */}
        <section className="lg:col-span-1 border-r border-zinc-800/60 bg-[#09090d]/60 flex flex-col p-4 gap-4 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
            <div className="flex items-center gap-2 text-zinc-300 font-bold">
              <FolderOpen className="w-4.5 h-4.5 text-cyan-400" />
              <span>Brands Studio</span>
            </div>
            <button
              onClick={() => setShowNewBrandModal(true)}
              className="p-1.5 bg-cyan-500 hover:bg-cyan-600 text-zinc-950 rounded-lg transition-all active:scale-95"
              title="Create Brand"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Brand List */}
          {isLoadingBrands ? (
            <div className="flex-1 flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : (
            <div className="space-y-2">
              {brands.map((b) => (
                <div
                  key={b.name}
                  onClick={() => setSelectedBrand(b)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col gap-1.5 ${
                    selectedBrand?.name === b.name
                      ? "bg-zinc-900/90 border-cyan-500/40 shadow-lg shadow-cyan-500/5"
                      : "bg-zinc-950/40 border-zinc-800/40 hover:bg-zinc-900/30 hover:border-zinc-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-zinc-200 truncate pr-2">
                      {b.productName}
                    </span>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold border ${
                        b.brandType === "service"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
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

                  {/* Status Badges */}
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

          {/* Selected Brand asset uploading */}
          {selectedBrand && (
            <div className="mt-auto pt-4 border-t border-zinc-800/60 flex flex-col gap-3.5 bg-zinc-950/20 p-3 rounded-2xl">
              <div className="flex items-center gap-2 text-zinc-300 font-bold text-xs">
                <Upload className="w-4 h-4 text-purple-400" />
                <span>Upload Brand Assets</span>
              </div>

              {selectedBrand.brandType === "service" && (
                <div className="grid grid-cols-2 gap-1 bg-zinc-900/50 p-0.5 rounded-lg border border-zinc-800/40">
                  {["screenshots", "logos", "icons", "team"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setUploadCategory(cat)}
                      className={`text-[10px] py-1 rounded capitalize font-medium ${
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

              <label className="flex flex-col items-center justify-center border border-dashed border-zinc-800 hover:border-cyan-500/50 hover:bg-cyan-500/[0.02] rounded-xl py-6 px-4 cursor-pointer transition-all duration-200 group text-center">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
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
                <div className="text-[10px] text-emerald-400 font-medium text-center animate-bounce">
                  ✓ Upload complete! Assets refreshed.
                </div>
              )}

              {/* Asset list review summary */}
              <div className="text-[10px] text-zinc-500 space-y-1 bg-zinc-900/30 p-2 rounded-xl border border-zinc-800/40">
                <div className="font-semibold text-zinc-400 pb-1 border-b border-zinc-900 mb-1">
                  Asset Directory Check:
                </div>
                {selectedBrand.brandType === "product" ? (
                  <div className="flex justify-between">
                    <span>product-images/</span>
                    <span className="font-bold text-zinc-300">
                      {selectedBrand.assetCounts["product-images"] || 0} images
                    </span>
                  </div>
                ) : (
                  ["screenshots", "logos", "icons", "team"].map((cat) => (
                    <div key={cat} className="flex justify-between capitalize">
                      <span>{cat}/</span>
                      <span className={`font-bold ${selectedBrand.assetCounts[cat] > 0 ? "text-emerald-400" : "text-zinc-600"}`}>
                        {selectedBrand.assetCounts[cat] || 0}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>

        {/* Workspace Panels (Control Room) */}
        <section className="lg:col-span-3 flex flex-col bg-[#0b0b0f] overflow-hidden">
          
          {/* Workspace Tabs Header */}
          <div className="h-12 border-b border-zinc-800/60 bg-[#0e0e14] flex items-center justify-between px-6">
            <div className="flex items-center gap-1.5">
              {[
                { id: "dna", label: "Brand DNA", icon: FileText },
                { id: "templates", label: "Template Configurator", icon: Layers },
                { id: "terminal", label: "SaaS Console", icon: Terminal },
                { id: "gallery", label: "Generated Ads", icon: ImageIcon }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`h-12 px-4 border-b-2 flex items-center gap-2 text-xs font-semibold transition-all duration-200 ${
                      activeTab === tab.id
                        ? "border-cyan-500 text-cyan-400 bg-cyan-500/[0.01]"
                        : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/10"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Run Pipeline Buttons */}
            {selectedBrand && (
              <div className="flex items-center gap-2">
                {activeTab === "dna" && (
                  <button
                    onClick={() => startPipeline("research")}
                    disabled={isRunningPipeline || !selectedBrand.url}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold rounded-lg text-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isRunningPipeline ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3 fill-current" />
                    )}
                    <span>Run Brand Research</span>
                  </button>
                )}

                {activeTab === "templates" && promptsData && (
                  <button
                    onClick={() => startPipeline("generate")}
                    disabled={isRunningPipeline || selectedTemplates.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-bold rounded-lg text-xs shadow-md shadow-cyan-500/10 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isRunningPipeline ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Generate selected ad templates ({selectedTemplates.length})</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Workspace Tab Content */}
          <div className="flex-1 p-6 overflow-y-auto relative">
            {!selectedBrand ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                <FolderOpen className="w-12 h-12 text-zinc-700 mb-3" />
                <h3 className="font-bold text-zinc-400">No Brand Selected</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                  Create a new brand or choose one from the sidebar list to load details.
                </p>
              </div>
            ) : (
              <>
                {/* 1. DNA Tab */}
                {activeTab === "dna" && (
                  <div className="space-y-4 max-w-3xl">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                      <div>
                        <h2 className="text-xl font-extrabold text-zinc-100 flex items-center gap-2">
                          Brand DNA: <span className="text-cyan-400">{selectedBrand.productName}</span>
                        </h2>
                        <p className="text-xs text-zinc-500 mt-1">
                          Research document generated automatically by Gemini 2.0 Flash with Search grounding.
                        </p>
                      </div>
                    </div>

                    {isLoadingDna ? (
                      <div className="py-20 flex flex-col items-center justify-center text-zinc-500">
                        <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
                        <span>Gathering brand context...</span>
                      </div>
                    ) : dnaContent ? (
                      <div
                        className="glass-panel p-6 rounded-2xl text-zinc-300 font-sans text-sm leading-relaxed border border-zinc-800/80 shadow-xl overflow-x-auto"
                        dangerouslySetInnerHTML={{ __html: renderMarkdownHTML(dnaContent) }}
                      />
                    ) : (
                      <div className="text-center py-16 glass-panel rounded-2xl border border-dashed border-zinc-800/80 flex flex-col items-center justify-center p-6">
                        <FileText className="w-12 h-12 text-zinc-700 mb-3" />
                        <span className="font-bold text-zinc-400 text-sm">No DNA Generated Yet</span>
                        <p className="text-xs text-zinc-500 mt-1.5 max-w-xs mb-4">
                          To get started, click the button below to launch Gemini brand research. This will fetch details from the brand website.
                        </p>
                        <button
                          onClick={() => startPipeline("research")}
                          disabled={isRunningPipeline || !selectedBrand.url}
                          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold rounded-xl text-xs transition-all duration-200 active:scale-95 disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Generate DNA via Gemini Research</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Template Configurator Playground Tab */}
                {activeTab === "templates" && (
                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-4 gap-4">
                      <div>
                        <h2 className="text-xl font-extrabold text-zinc-100">
                          Template Playroom
                        </h2>
                        <p className="text-xs text-zinc-500 mt-1">
                          Configure the image generator parameters, choose which templates to run, edit the prompts, or add a custom template idea.
                        </p>
                      </div>

                      {/* Options Box */}
                      {promptsData && (
                        <div className="flex flex-wrap items-center gap-3 bg-zinc-900/40 p-2 border border-zinc-800/60 rounded-xl">
                          {/* Resolution */}
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] text-zinc-500 font-semibold uppercase">Resolution</span>
                            <select
                              value={resolution}
                              onChange={(e) => setResolution(e.target.value)}
                              className="bg-zinc-950 text-xs px-2.5 py-1.5 border border-zinc-800 rounded-lg text-zinc-300 font-medium"
                            >
                              <option value="512">512px (Cheap Draft)</option>
                              <option value="1K">1K (Standard Draft)</option>
                              <option value="2K">2K (Production Quality)</option>
                              <option value="4K">4K (Ultra Quality)</option>
                            </select>
                          </div>

                          {/* Variations */}
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] text-zinc-500 font-semibold uppercase">Variations</span>
                            <select
                              value={variations}
                              onChange={(e) => setVariations(e.target.value)}
                              className="bg-zinc-950 text-xs px-2.5 py-1.5 border border-zinc-800 rounded-lg text-zinc-300 font-medium"
                            >
                              <option value="1">1 Image</option>
                              <option value="2">2 Images</option>
                              <option value="4">4 Images (Default)</option>
                              <option value="6">6 Images</option>
                            </select>
                          </div>

                          {/* Dry Run */}
                          <button
                            onClick={() => setDryRun(!dryRun)}
                            className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                              dryRun
                                ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
                                : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-300"
                            }`}
                          >
                            {dryRun ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                            <span>Dry Run Preview</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {isLoadingPrompts ? (
                      <div className="py-20 flex flex-col items-center justify-center text-zinc-500">
                        <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
                        <span>Loading template configurations...</span>
                      </div>
                    ) : promptsData ? (
                      <div className="space-y-4">
                        {/* Prompt Modifier Banner */}
                        <div className="glass-panel p-4 rounded-xl border border-zinc-800/80 shadow-md">
                          <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block mb-1">
                            Prompt Modifier (Applied to all ads)
                          </span>
                          <p className="text-xs text-zinc-400 italic">
                            "{promptsData.prompt_modifier}"
                          </p>
                        </div>

                        {/* Control actions */}
                        <div className="flex items-center justify-between">
                          <button
                            onClick={toggleSelectAllTemplates}
                            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1.5"
                          >
                            {selectedTemplates.length === promptsData.prompts.length ? "Deselect All" : "Select All Templates"}
                          </button>

                          <button
                            onClick={() => setShowCustomPromptForm(!showCustomPromptForm)}
                            className="text-xs px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-lg font-semibold flex items-center gap-1.5"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add Custom Template Idea</span>
                          </button>
                        </div>

                        {/* Add Custom Prompt Form */}
                        {showCustomPromptForm && (
                          <form onSubmit={handleAddCustomPrompt} className="glass-panel p-5 rounded-2xl border-cyan-500/30 space-y-4 max-w-xl">
                            <h3 className="text-sm font-bold text-zinc-100">Add Custom Template</h3>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="col-span-2">
                                <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Template Name</label>
                                <input
                                  type="text"
                                  value={customName}
                                  onChange={(e) => setCustomName(e.target.value)}
                                  placeholder="e.g. minimalist-hero-shot"
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300"
                                  required
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Aspect Ratio</label>
                                <select
                                  value={customAspect}
                                  onChange={(e) => setCustomAspect(e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300"
                                >
                                  <option value="1:1">1:1 (Square)</option>
                                  <option value="4:5">4:5 (Instagram Feed)</option>
                                  <option value="9:16">9:16 (Stories/Reels)</option>
                                  <option value="16:9">16:9 (Landscape)</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Prompt Text</label>
                              <textarea
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                placeholder="Describe the scene layout, text elements, and mood. The modifier will automatically be prepended."
                                className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300"
                                required
                              />
                            </div>
                            <div className="flex justify-end gap-2 text-xs">
                              <button
                                type="button"
                                onClick={() => setShowCustomPromptForm(false)}
                                className="px-3 py-1.5 text-zinc-400 hover:text-zinc-200"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold rounded-lg"
                              >
                                Save Template
                              </button>
                            </div>
                          </form>
                        )}

                        {/* List templates */}
                        <div className="space-y-3">
                          {promptsData.prompts.map((p, idx) => (
                            <div
                              key={p.template_number}
                              className={`glass-panel rounded-2xl border transition-all duration-300 ${
                                selectedTemplates.includes(p.template_number)
                                  ? "border-cyan-500/20 bg-cyan-500/[0.005]"
                                  : "border-zinc-850 bg-zinc-950/20"
                              }`}
                            >
                              {/* Header line */}
                              <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => toggleTemplate(p.template_number)}>
                                <div className="flex items-center gap-3">
                                  <button className="text-zinc-500 hover:text-zinc-300">
                                    {selectedTemplates.includes(p.template_number) ? (
                                      <CheckSquare className="w-5 h-5 text-cyan-400" />
                                    ) : (
                                      <Square className="w-5 h-5" />
                                    )}
                                  </button>
                                  <span className="font-mono text-xs text-zinc-500 font-semibold bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                                    #{String(p.template_number).padStart(2, "0")}
                                  </span>
                                  <span className="font-bold text-sm text-zinc-300 capitalize">
                                    {p.template_name.replace(/-/g, " ")}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-zinc-400 font-semibold">
                                    {p.aspect_ratio} Ratio
                                  </span>
                                  {p.needs_product_images && (
                                    <span className="text-[9px] bg-cyan-950/60 text-cyan-400 border border-cyan-800/30 px-2 py-0.5 rounded font-semibold">
                                      Needs Images
                                    </span>
                                  )}
                                  {p.required_assets && p.required_assets.length > 0 && (
                                    <span className="text-[9px] bg-purple-950/60 text-purple-400 border border-purple-800/30 px-2 py-0.5 rounded font-semibold">
                                      Needs: {p.required_assets.join(", ")}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Details/Prompt editing */}
                              <div className="px-4 pb-4 border-t border-zinc-900/60 pt-3 flex flex-col gap-3">
                                {editingPromptIndex === idx ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={editingPromptText}
                                      onChange={(e) => setEditingPromptText(e.target.value)}
                                      className="w-full h-24 bg-zinc-950 border border-cyan-500/30 rounded-xl p-3 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500"
                                    />
                                    <div className="flex justify-end gap-2 text-xs">
                                      <button
                                        onClick={() => setEditingPromptIndex(null)}
                                        className="px-3 py-1.5 text-zinc-400 hover:text-zinc-200"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => handleSavePrompt(idx)}
                                        className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-lg flex items-center gap-1.5 shadow-md shadow-emerald-500/10"
                                      >
                                        <Save className="w-3.5 h-3.5" />
                                        <span>Save</span>
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex gap-4">
                                    <p className="flex-1 text-xs text-zinc-400 leading-relaxed font-mono select-all">
                                      {p.prompt}
                                    </p>
                                    <div className="flex flex-col gap-1.5">
                                      <button
                                        onClick={() => handleEditPrompt(idx, p.prompt)}
                                        className="p-1.5 text-zinc-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all"
                                        title="Edit Prompt"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeletePrompt(idx)}
                                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                        title="Delete Template"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {p.notes && (
                                  <div className="text-[10px] text-zinc-500 italic">
                                    Note: {p.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-16 glass-panel rounded-2xl border border-dashed border-zinc-800/80 flex flex-col items-center justify-center p-6">
                        <Layers className="w-12 h-12 text-zinc-700 mb-3" />
                        <span className="font-bold text-zinc-400 text-sm">No Prompts Generated Yet</span>
                        <p className="text-xs text-zinc-500 mt-1.5 max-w-xs mb-4">
                          You need to run Phase 2 Prompt Generation first to fill in all template prompts with your brand DNA details.
                        </p>
                        <button
                          onClick={() => startPipeline("generate")}
                          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold rounded-xl text-xs transition-all duration-200 active:scale-95"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Generate Prompts & Run Image Generation</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Terminal Log Stream Tab */}
                {activeTab === "terminal" && (
                  <div className="space-y-4 flex flex-col h-[calc(100vh-16rem)] min-h-[400px]">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                      <div>
                        <h2 className="text-xl font-extrabold text-zinc-100 flex items-center gap-2">
                          <Terminal className="w-5 h-5 text-cyan-400 animate-pulse" />
                          <span>SaaS Control Room Console</span>
                        </h2>
                        <p className="text-xs text-zinc-500 mt-1">
                          Real-time command stream from active Python pipeline execution.
                        </p>
                      </div>
                      {isRunningPipeline && (
                        <span className="flex items-center gap-1.5 text-xs text-cyan-400 font-semibold animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Running Process...
                        </span>
                      )}
                    </div>

                    <div className="flex-1 bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-4 font-mono text-xs text-zinc-300 overflow-y-auto terminal-scrollbar shadow-inner relative select-text">
                      <pre className="whitespace-pre-wrap leading-relaxed">
                        {terminalLogs || "Console idle. Run brand research or ad generation to view live processes."}
                      </pre>
                      <div ref={terminalEndRef} />
                    </div>
                  </div>
                )}

                {/* 4. Gallery Tab */}
                {activeTab === "gallery" && (
                  <div className="space-y-6">
                    <div className="border-b border-zinc-800 pb-4">
                      <h2 className="text-xl font-extrabold text-zinc-100">
                        Generated Ad Creatives
                      </h2>
                      <p className="text-xs text-zinc-500 mt-1">
                        Browse all output variations generated by the Nano Banana 2 image engine. Click to enlarge.
                      </p>
                    </div>

                    {isLoadingGallery ? (
                      <div className="py-20 flex flex-col items-center justify-center text-zinc-500">
                        <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
                        <span>Loading generated ads gallery...</span>
                      </div>
                    ) : galleryImages.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {galleryImages.map((img) => (
                          <div
                            key={img.url}
                            onClick={() => setExpandedImage(img.url)}
                            className="glass-panel rounded-2xl overflow-hidden border border-zinc-850 hover:border-cyan-500/30 group cursor-zoom-in transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/5 hover:-translate-y-1 relative"
                          >
                            <img
                              src={img.url}
                              alt={img.file}
                              loading="lazy"
                              className="w-full h-auto object-cover max-h-[300px] border-b border-zinc-900"
                            />
                            <div className="p-3 bg-[#0d0d12]/90 flex flex-col gap-1">
                              <span className="text-[10px] text-zinc-500 capitalize truncate">
                                {img.template.replace(/^[0-9]+-/, "").replace(/-/g, " ")}
                              </span>
                              <span className="text-[9px] font-mono text-zinc-600 truncate">
                                {img.file}
                              </span>
                            </div>
                            
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-zinc-950/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center pointer-events-none">
                              <span className="bg-zinc-900 border border-zinc-800 text-xs px-3 py-1.5 rounded-xl text-zinc-200 font-semibold shadow-xl">
                                Click to Zoom
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-16 glass-panel rounded-2xl border border-dashed border-zinc-800/80 flex flex-col items-center justify-center p-6">
                        <ImageIcon className="w-12 h-12 text-zinc-700 mb-3" />
                        <span className="font-bold text-zinc-400 text-sm">No Ads Generated Yet</span>
                        <p className="text-xs text-zinc-500 mt-1.5 max-w-xs">
                          Launch the Template Configurator, select templates, and click "Generate Ads" to build image variations.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      {/* Brand Creation Modal */}
      {showNewBrandModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/50 to-purple-500/50" />
            
            <h3 className="text-lg font-bold text-zinc-100 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-400" />
              <span>Initialize Brand Workspace</span>
            </h3>

            <form onSubmit={handleCreateBrand} className="space-y-4">
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Brand Name</label>
                <input
                  type="text"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="e.g. Liquid Death"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500/50"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Website URL</label>
                <input
                  type="url"
                  value={newBrandUrl}
                  onChange={(e) => setNewBrandUrl(e.target.value)}
                  placeholder="https://liquiddeath.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500/50"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Target Product SKU</label>
                <input
                  type="text"
                  value={newBrandProduct}
                  onChange={(e) => setNewBrandProduct(e.target.value)}
                  placeholder="Mountain Water 12-Pack"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500/50"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1.5">Brand Classification</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewBrandType("product")}
                    className={`py-3.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                      newBrandType === "product"
                        ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                        : "bg-zinc-950 border-zinc-850 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Tag className="w-4 h-4" />
                    <span>DTC Product (Physical)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewBrandType("service")}
                    className={`py-3.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                      newBrandType === "service"
                        ? "bg-purple-500/10 border-purple-500/50 text-purple-400"
                        : "bg-zinc-950 border-zinc-850 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                    <span>SaaS / Digital Service</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 text-xs pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewBrandModal(false)}
                  className="px-4 py-2 text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingBrand}
                  className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-500/10"
                >
                  {isCreatingBrand && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Brand Directory</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expanded Image Viewer Modal */}
      {expandedImage && (
        <div
          onClick={() => setExpandedImage(null)}
          className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-50 cursor-zoom-out animate-fadeIn"
        >
          <img
            src={expandedImage}
            alt="Expanded ad creative"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl border border-zinc-800"
          />
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
