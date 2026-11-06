export const ACCEPTED_EXTENSIONS = [".csv", ".edf", ".bdf"] as const;
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = "25 MB";
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(",");

export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot === -1 ? "" : fileName.slice(lastDot).toLowerCase();
}

export function validateDemoEegFile(file: File): string | undefined {
  const extension = getFileExtension(file.name);

  if (!ACCEPTED_EXTENSIONS.some((accepted) => accepted === extension)) {
    return "Choose a .csv, .edf, or .bdf demo file.";
  }

  if (file.size === 0) {
    return "The selected file is empty. Choose a non-empty demo file.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `The selected file is larger than ${MAX_FILE_SIZE_LABEL}. Choose a smaller demo file.`;
  }

  return undefined;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(kilobytes < 10 ? 1 : 0)} KB`;
  }

  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(megabytes < 10 ? 1 : 0)} MB`;
}
