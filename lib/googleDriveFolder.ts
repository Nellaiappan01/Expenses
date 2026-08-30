/** Extract a Drive folder id from a pasted URL or a raw id. */
export function parseGoogleDriveFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const fromFolders = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (fromFolders?.[1]) return fromFolders[1];

  const fromQuery = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fromQuery?.[1]) return fromQuery[1];

  if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) return trimmed;

  return null;
}

export function normalizeGoogleDriveFolderUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const id = parseGoogleDriveFolderId(trimmed);
  if (!id) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://drive.google.com/drive/folders/${id}`;
}

export function driveViewUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}

export function driveFileOpenUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}

/** URL to write in the Google Sheet Drive File URL column. */
export function sheetDriveFileUrl(entry: {
  attachmentDriveUrl?: string;
  attachmentPublicId?: string;
  attachmentUrl?: string;
}): string {
  const stored = entry.attachmentDriveUrl?.trim();
  if (stored) return stored;

  const publicId = entry.attachmentPublicId?.trim() || "";
  if (publicId.startsWith("drive:")) {
    const id = publicId.slice("drive:".length).trim();
    if (id) return driveFileOpenUrl(id);
  }

  const url = entry.attachmentUrl?.trim() || "";
  if (/drive\.google\.com/i.test(url)) return url;
  return "";
}
