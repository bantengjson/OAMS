'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { UserAvatar } from '@/components/ui/user-avatar';
import { authApi } from '@/lib/api/auth';
import { getErrorMessage } from '@/lib/api/form-errors';
import { useAuth } from '@/lib/auth/use-auth';
import { AvatarCropDialog } from './avatar-crop-dialog';

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
  // The page behind an open modal is inert, so the photo viewer has its own picker.
  const viewerInput = useRef<HTMLInputElement>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // A picked photo waits here, in the crop dialog, until the user confirms it.
  const [pending, setPending] = useState<{ file: File; id: number } | null>(null);
  const [viewing, setViewing] = useState(false);

  const done = (message: string) => (fresh: Awaited<ReturnType<typeof authApi.me>>) => {
    setUser(fresh);
    void qc.invalidateQueries({ queryKey: ['users'] });
    toast.success(message);
  };
  const upload = useMutation({
    mutationFn: (file: File) => authApi.uploadAvatar(file),
    onSuccess: (fresh) => {
      done('Foto profil diperbarui.')(fresh);
      setPending(null);
    },
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

  const choose = (file: File) => {
    const problem = avatarFileProblem(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setPending({ file, id: Date.now() });
  };
  const onPick = (files: FileList | null) => {
    const file = files?.[0];
    if (input.current) input.current.value = '';
    if (viewerInput.current) viewerInput.current.value = '';
    if (file) {
      setViewing(false);
      choose(file);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        {user.avatarUrl ? (
          <button
            type="button"
            onClick={() => setViewing(true)}
            className="block rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            aria-label="Lihat foto profil"
            title="Lihat foto profil"
          >
            <UserAvatar name={user.fullName} avatarUrl={user.avatarUrl} size="xl" className="shadow-sm ring-4 ring-card transition hover:brightness-95" />
          </button>
        ) : (
          <UserAvatar name={user.fullName} avatarUrl={user.avatarUrl} size="xl" className="shadow-sm ring-4 ring-card" />
        )}
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
      {pending ? (
        <AvatarCropDialog
          key={pending.id}
          file={pending.file}
          uploading={upload.isPending}
          onClose={() => setPending(null)}
          onPickAnother={choose}
          onConfirm={(cropped) => upload.mutate(cropped)}
        />
      ) : null}
      <Dialog
        open={viewing}
        onClose={() => setViewing(false)}
        title="Foto profil"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setViewing(false)}>
              Tutup
            </Button>
            <Button onClick={() => viewerInput.current?.click()}>
              <Camera className="h-4 w-4" aria-hidden="true" />
              Ganti foto
            </Button>
          </>
        }
      >
        <input
          ref={viewerInput}
          type="file"
          accept={AVATAR_ACCEPT}
          className="hidden"
          onChange={(e) => onPick(e.target.files)}
        />
        <div className="flex flex-col items-center gap-3 py-2">
          <UserAvatar name={user.fullName} avatarUrl={user.avatarUrl} size="2xl" className="shadow-sm" />
          <div className="text-center">
            <p className="font-semibold text-foreground">{user.fullName}</p>
            {user.username ? <p className="text-sm text-muted-foreground">@{user.username}</p> : null}
          </div>
        </div>
      </Dialog>
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
