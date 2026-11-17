import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from './client';

export function getErrorMessage(error: unknown, fallback = 'Terjadi kesalahan.'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Maps `ApiError.errors` onto react-hook-form fields. Returns the message to
 * show as a general alert, or null when every server error landed on a field.
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  if (!(error instanceof ApiError)) return getErrorMessage(error);
  if (!error.errors) return error.message;

  let unmapped = false;
  for (const [field, messages] of Object.entries(error.errors)) {
    if ((fields as readonly string[]).includes(field)) {
      setError(field as Path<T>, { type: 'server', message: messages[0] });
    } else {
      unmapped = true;
    }
  }
  return unmapped || Object.keys(error.errors).length === 0 ? error.message : null;
}
