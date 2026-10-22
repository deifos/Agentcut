import { STUDIO_LIBRARY_BASE, studioAssetBase } from "@/lib/studio/bundle";
import type { StudioCompositionProps, StudioLayers, StudioProject } from "@/lib/studio/types";

export function variantSize(project: StudioProject, variant: string) {
  return project.variants[variant] ?? project.variants[project.defaultVariant] ?? { width: 1920, height: 1080 };
}

export function buildInputProps(
  slug: string,
  project: StudioProject,
  layers: StudioLayers,
  variant: string,
  masterGain?: number,
): StudioCompositionProps {
  return {
    project,
    layers,
    variant,
    assetBase: studioAssetBase(slug),
    libraryBase: STUDIO_LIBRARY_BASE,
    ...(masterGain !== undefined ? { masterGain } : {}),
  };
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unreadable blob")));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
