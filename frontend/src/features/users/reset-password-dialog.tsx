'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { applyApiError } from '@/lib/api/form-errors';
import { usersApi } from '@/lib/api/users';
import type { User } from '@/types/api';

const schema = z.object({
  newPassword: z
    .string()
    .min(8, 'Minimal 8 karakter')
    .regex(/[A-Za-z]/, 'Harus mengandung huruf')
    .regex(/\d/, 'Harus mengandung angka'),
});

type FormValues = z.infer<typeof schema>;

export function ResetPasswordDialog({
  user,
  onClose,
  onSaved,
}: {
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog
      open={Boolean(user)}
      onClose={onClose}
      title="Reset password"
      description={user ? `${user.fullName} · ${user.email}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="reset-password-form">
            Reset
          </Button>
        </>
      }
    >
      {user ? <ResetPasswordForm key={user.id} user={user} onSaved={onSaved} /> : null}
    </Dialog>
  );
}

function ResetPasswordForm({ user, onSaved }: { user: User; onSaved: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '' },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await usersApi.resetPassword(user.id, values.newPassword);
      toast.success('Password direset. Semua sesi pengguna tersebut dicabut.');
      onSaved();
    } catch (error) {
      setFormError(applyApiError(error, form.setError, ['newPassword']));
    }
  });

  return (
    <form id="reset-password-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {formError ? <Alert variant="error">{formError}</Alert> : null}
      <Field>
        <Label htmlFor="rp-password" required>
          Password baru
        </Label>
        <Input
          id="rp-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.newPassword)}
          {...form.register('newPassword')}
        />
        <FieldHint>
          Sampaikan password ini kepada pengguna secara aman dan minta ia menggantinya.
        </FieldHint>
        <FieldError>{errors.newPassword?.message}</FieldError>
      </Field>
    </form>
  );
}
