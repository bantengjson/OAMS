'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { UserAvatar } from '@/components/ui/user-avatar';
import { authApi } from '@/lib/api/auth';
import { getErrorMessage } from '@/lib/api/form-errors';
import { useAuth } from '@/lib/auth/use-auth';

export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp';
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** Client-side check before uploading; the server checks again. Returns an error message or null. */
export function avatarFileProblem(file: Pick<File, 'type' | 'size'>): string | null {
  if (!AVATAR_ACCEPT.split(',').includes(file.type)) return 'Pilih foto berformat JPG, PNG, atau WebP.';
  if (file.size > AVATAR_MAX_BYTES) return 'Ukuran foto maksimal 5 MB.';
  return null;
}

/** Large avatar with a camera button to change the photo and a link to remove it. */
export function ProfilePhoto() {
  const { user, setUser } = useAuth();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const done = (message: string) => (fresh: Awaited<ReturnType<typeof authApi.me>>) => {
    setUser(fresh);
    void qc.invalidateQueries({ queryKey: ['users'] });
    toast.success(message);
  };
  const upload = useMutation({
    mutationFn: (file: File) => authApi.uploadAvatar(file),
    onSuccess: done('Foto profil diperbarui.'),
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => authApi.removeAvatar(),
    onSuccess: (fresh) => {
      done('Foto profil dihapus.')(fresh);
      setConfirmRemove(false);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (!user) return null;
  const busy = upload.isPending || remove.isPending;

  const onPick = (files: FileList | null) => {
    const file = files?.[0];
    if (input.current) input.current.value = '';
    if (!file) return;
    const problem = avatarFileProblem(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    upload.mutate(file);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <UserAvatar name={user.fullName} avatarUrl={user.avatarUrl} size="xl" className="ring-4 ring-card shadow-sm" />
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white">
            <Spinner />
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="absolute right-0 bottom-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm transition hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
          aria-label={user.avatarUrl ? 'Ganti foto profil' : 'Unggah foto profil'}
          title={user.avatarUrl ? 'Ganti foto profil' : 'Unggah foto profil'}
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
        </button>
        <input
          ref={input}
          type="file"
          accept={AVATAR_ACCEPT}
          className="hidden"
          onChange={(e) => onPick(e.target.files)}
          data-testid="avatar-input"
        />
      </div>
      {user.avatarUrl ? (
        <button
          type="button"
          onClick={() => setConfirmRemove(true)}
          disabled={busy}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-60"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Hapus foto
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">JPG, PNG, atau WebP · maks 5 MB</p>
      )}
      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => remove.mutate()}
        title="Hapus foto profil?"
        confirmLabel="Hapus foto"
        destructive
        loading={remove.isPending}
      >
        Foto akan diganti dengan inisial nama Anda. Anda bisa mengunggah foto baru kapan saja.
      </ConfirmDialog>
    </div>
  );
}
