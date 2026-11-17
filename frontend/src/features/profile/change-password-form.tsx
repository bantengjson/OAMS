'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Password saat ini wajib diisi'),
    newPassword: z
      .string()
      .min(8, 'Minimal 8 karakter')
      .regex(/[A-Za-z]/, 'Harus mengandung huruf')
      .regex(/\d/, 'Harus mengandung angka'),
    confirmPassword: z.string().min(1, 'Ulangi password baru'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Konfirmasi password tidak sama',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export function ChangePasswordForm() {
  const { logout } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await authApi.changePassword(values.currentPassword, values.newPassword);
      toast.success('Password berhasil diubah. Silakan login kembali.');
      await logout();
      router.replace('/login');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Terjadi kesalahan.');
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4" noValidate>
      {formError ? <Alert variant="error">{formError}</Alert> : null}
      <Field>
        <Label htmlFor="currentPassword" required>
          Password saat ini
        </Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.currentPassword)}
          {...form.register('currentPassword')}
        />
        <FieldError>{errors.currentPassword?.message}</FieldError>
      </Field>
      <Field>
        <Label htmlFor="newPassword" required>
          Password baru
        </Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.newPassword)}
          {...form.register('newPassword')}
        />
        <FieldHint>Minimal 8 karakter, mengandung huruf dan angka.</FieldHint>
        <FieldError>{errors.newPassword?.message}</FieldError>
      </Field>
      <Field>
        <Label htmlFor="confirmPassword" required>
          Ulangi password baru
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirmPassword)}
          {...form.register('confirmPassword')}
        />
        <FieldError>{errors.confirmPassword?.message}</FieldError>
      </Field>
      <div>
        <Button type="submit" loading={isSubmitting}>
          Simpan password baru
        </Button>
      </div>
    </form>
  );
}
