import { BadRequestException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';

export type AllowedKind = 'photo' | 'document';

export const UNSUPPORTED_FILE_MESSAGE = 'Jenis berkas tidak didukung.';
export const FILE_TOO_LARGE_MESSAGE = 'Ukuran berkas melebihi batas.';
export const FILE_REQUIRED_MESSAGE = 'Berkas wajib diunggah.';

const PHOTO_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOCUMENT_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
]);

export function maxUploadBytes(kind: AllowedKind): number {
  return kind === 'photo' ? 10 * 1024 * 1024 : 20 * 1024 * 1024;
}

/** A file shape independent of multer's typings. */
export interface UploadedFileLike {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/**
 * Decides the real type from the bytes (magic numbers), never from the file
 * name or the client's Content-Type. Throws 400 when not allowed for `kind`.
 */
export async function detectUpload(
  buffer: Buffer,
  kind: AllowedKind,
): Promise<{ mime: string; ext: string }> {
  const detected = await fileTypeFromBuffer(buffer);
  const allowed = kind === 'photo' ? PHOTO_MIMES : DOCUMENT_MIMES;
  if (!detected || !allowed.has(detected.mime)) {
    throw new BadRequestException(UNSUPPORTED_FILE_MESSAGE);
  }
  return { mime: detected.mime, ext: detected.ext };
}

/** Keeps a user-supplied file name printable and short; never used as a path. */
export function sanitizeOriginalName(name: string): string {
  // oxlint-disable-next-line no-control-regex -- control characters are exactly what we strip
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  return (cleaned || 'berkas').slice(0, 255);
}
