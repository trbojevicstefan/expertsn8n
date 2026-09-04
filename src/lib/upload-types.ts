/**
 * What the storage rules will actually accept, checked before a byte is sent.
 *
 * The rules reject a file whose content type is not on their list, and Firebase
 * reports that refusal as `storage/unauthorized` -- which surfaced to experts
 * as "you do not have permission to access this file" about their own upload.
 * Checking here means the reason given is the real one.
 */
export const DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  // An iPhone shoots HEIC unless told otherwise. Documents are downloaded, so
  // a format browsers cannot render is no obstacle here -- unlike the profile
  // photo, which is served straight into an <img> and stays JPG/PNG/WebP.
  "image/heic",
  "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Browsers leave `file.type` empty often enough to matter -- a .doc picked on
 * Windows, anything arriving through a share sheet -- and an empty type is
 * exactly what the rules refuse. The extension is the better answer when the
 * browser has none.
 */
const BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function resolveContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return BY_EXTENSION[ext] || "";
}

function readable(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(0) + " MB";
}

/** Null when the file is fine; otherwise the sentence to show. */
export function rejectionReason(
  file: File,
  allowed: readonly string[],
  maxBytes: number,
  label: string,
): string | null {
  const type = resolveContentType(file);

  if (!type) {
    return `We could not tell what kind of file "${file.name}" is. Rename it with its proper extension and try again.`;
  }
  if (!allowed.includes(type)) {
    return `${label} — this one is ${type}.`;
  }
  if (file.size > maxBytes) {
    return `"${file.name}" is ${readable(file.size)}. The limit is ${readable(maxBytes)}.`;
  }
  return null;
}

export const DOCUMENT_HINT =
  "Documents must be a PDF, a Word file, or an image (JPG, PNG, WebP or HEIC)";
export const PHOTO_HINT = "A profile photo must be a JPG, PNG or WebP image";

/**
 * The rules answer a rejected type or size with a permissions code, so a raw
 * relay of it accuses people of not owning their own file.
 */
export function describeUploadError(error: unknown, hint: string): string {
  const code = (error as { code?: string })?.code || "";
  if (code === "storage/unauthorized") {
    return `${hint}, within the size limit. This file was refused.`;
  }
  if (code === "storage/retry-limit-exceeded" || code === "storage/canceled") {
    return "The upload did not finish. Check your connection and try again.";
  }
  return error instanceof Error ? error.message : "Upload failed.";
}
