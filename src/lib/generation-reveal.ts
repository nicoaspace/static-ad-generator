import type { GalleryImage, GenerationRun } from "@/lib/types";

export function getNewImagesForRun(images: GalleryImage[], run: GenerationRun): GalleryImage[] {
  return images.filter(
    (img) =>
      img.modifiedAt &&
      img.modifiedAt >= run.startedAt - 2000 &&
      run.templateFolders.includes(img.template)
  );
}

export function formatTemplateFolderName(folder: string): string {
  return folder.replace(/^\d+-/, "").replace(/-/g, " ");
}

export function templateNumberFromFolder(folder: string): number | null {
  const match = folder.match(/^(\d+)-/);
  return match ? parseInt(match[1], 10) : null;
}
