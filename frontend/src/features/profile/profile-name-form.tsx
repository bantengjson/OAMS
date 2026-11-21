'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { authApi } from '@/lib/api/auth';
import { getErrorMessage } from '@/lib/api/form-errors';
import { useAuth } from '@/lib/auth/use-auth';

export const profileNameSchema = z.object({
  fullName: z
    .string()
    .transform((v) => v.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(2, 'Nama minimal 2 karakter').max(150, 'Nama maksimal 150 karakter')),
});

type FormInput = z.input<typeof profileNameSchema>;
type FormOutput = z.output<typeof profileNameSchema>;

/** Display name, editable by the user themself; it is not the username used to sign in. */
export function ProfileNameForm() {
  const { user, setUser } = useAuth();
  const qc = useQueryClient();
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(profileNameSchema),
    defaultValues: { fullName: user?.fullName ?? '' },
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  useEffect(() => {
    if (user) form.reset({ fullName: user.fullName });
  }, [user?.fullName]); // eslint-disable-line react-hooks/exhaustive-deps -- only when the saved name changes

  const onSubmit = form.handleSubmit(async ({ fullName }) => {
    if (fullName === user?.fullName) {
      form.reset({ fullName });
      return;
    }
    try {
      const fresh = await authApi.updateMe(fullName);
      setUser(fresh);
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Nama berhasil diperbarui.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
      <Field>
        <Label htmlFor="profile-fullName">Nama tampilan</Label>
        <div className="flex gap-2">
          <Input
            id="profile-fullName"
            autoComplete="name"
            aria-invalid={Boolean(errors.fullName)}
            className="flex-1"
            {...form.register('fullName')}
          />
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
        {errors.fullName ? (
          <FieldError>{errors.fullName.message}</FieldError>
        ) : (
          <FieldHint>Nama yang terlihat di aplikasi. Tidak mengubah username untuk login.</FieldHint>
        )}
      </Field>
    </form>
  );
}
