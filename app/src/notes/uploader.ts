/**
 * Native no-op twin of uploader.web.ts: nothing to upload on native in V1
 * (clipboard paste is web-only; remote blobs render via direct URLs).
 */

export async function drainUploads(): Promise<void> {}

export function startUploader(): void {}
