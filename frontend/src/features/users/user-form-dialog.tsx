'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { FormSelect } from '@/components/ui/select-panel';
import { departmentsApi } from '@/lib/api/departments';
import { applyApiError } from '@/lib/api/form-errors';
import { rolesApi } from '@/lib/api/roles';
import { usersApi } from '@/lib/api/users';
import type { User } from '@/types/api';

const passwordRule = z
  .string()
  .min(8, 'Minimal 8 karakter')
  .regex(/[A-Za-z]/, 'Harus mengandung huruf')
  .regex(/\d/, 'Harus mengandung angka');

const usernameRule = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === '' || /^[a-z0-9._-]{3,50}$/.test(v), {
    message: '3-50 karakter: huruf kecil, angka, titik, garis bawah, atau strip',
  })
  .optional();

const createSchema = z.object({
  email: z.email({ message: 'Format email tidak valid' }),
  username: usernameRule,
  fullName: z.string().trim().min(1, 'Nama lengkap wajib diisi').max(150),
  password: passwordRule,
  roleCodes: z.array(z.string()).min(1, 'Pilih minimal satu role'),
  departmentId: z.string().optional(),
  phone: z.string().trim().max(30).optional(),
});

const editSchema = z.object({
  email: z.string().optional(),
  username: usernameRule,
  fullName: z.string().trim().min(1, 'Nama lengkap wajib diisi').max(150),
  password: z.string().optional(),
  roleCodes: z.array(z.string()).optional(),
  departmentId: z.string().optional(),
  phone: z.string().trim().max(30).optional(),
});

type FormValues = z.infer<typeof createSchema>;

export function UserFormDialog({
  open,
  user,
  onClose,
  onSaved,
}: {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={user ? 'Ubah pengguna' : 'Tambah pengguna'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="user-form">
            Simpan
          </Button>
        </>
      }
    >
      {open ? <UserForm key={user?.id ?? 'new'} user={user} onSaved={onSaved} /> : null}
    </Dialog>
  );
}

function UserForm({ user, onSaved }: { user: User | null; onSaved: () => void }) {
  const isEdit = Boolean(user);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver((isEdit ? editSchema : createSchema) as typeof createSchema),
    defaultValues: {
      email: user?.email ?? '',
      username: user?.username ?? '',
      fullName: user?.fullName ?? '',
      password: '',
      roleCodes: user?.roles.map((r) => r.code) ?? [],
      departmentId: user?.department?.id ?? '',
      phone: user?.phone ?? '',
    },
  });
  const { errors } = form.formState;

  const roles = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list, enabled: !isEdit });
  const departments = useQuery({
    queryKey: ['departments', { isActive: true, pageSize: 100 }],
    queryFn: () => departmentsApi.list({ isActive: true, pageSize: 100 }),
  });

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const username = values.username?.trim() ? values.username : null;
      if (user) {
        await usersApi.update(user.id, {
          username,
          fullName: values.fullName,
          phone: values.phone?.trim() ? values.phone : null,
          departmentId: values.departmentId || null,
        });
      } else {
        await usersApi.create({
          email: values.email,
          username,
          fullName: values.fullName,
          password: values.password,
          roleCodes: values.roleCodes,
          phone: values.phone?.trim() ? values.phone : null,
          departmentId: values.departmentId || null,
        });
      }
      toast.success('Pengguna disimpan.');
      onSaved();
    } catch (error) {
      setFormError(
        applyApiError(error, form.setError, [
          'email',
          'username',
          'fullName',
          'password',
          'roleCodes',
          'departmentId',
          'phone',
        ]),
      );
    }
  });

  return (
    <form id="user-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {formError ? <Alert variant="error">{formError}</Alert> : null}

      <Field>
        <Label htmlFor="u-fullName" required>
          Nama lengkap
        </Label>
        <Input
          id="u-fullName"
          aria-invalid={Boolean(errors.fullName)}
          {...form.register('fullName')}
        />
        <FieldError>{errors.fullName?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="u-username">Username</Label>
        <Input
          id="u-username"
          autoComplete="off"
          autoCapitalize="none"
          placeholder="mis. budi"
          aria-invalid={Boolean(errors.username)}
          {...form.register('username')}
        />
        <FieldHint>Opsional. Nama login singkat selain email.</FieldHint>
        <FieldError>{errors.username?.message}</FieldError>
      </Field>

      {!isEdit ? (
        <>
          <Field>
            <Label htmlFor="u-email" required>
              Email
            </Label>
            <Input
              id="u-email"
              type="email"
              autoComplete="off"
              aria-invalid={Boolean(errors.email)}
              {...form.register('email')}
            />
            <FieldError>{errors.email?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor="u-password" required>
              Password awal
            </Label>
            <PasswordInput
              id="u-password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              {...form.register('password')}
            />
            <FieldHint>
              Minimal 8 karakter, mengandung huruf dan angka. Minta pengguna menggantinya setelah
              login.
            </FieldHint>
            <FieldError>{errors.password?.message}</FieldError>
          </Field>
          <Field>
            <Label required>Role</Label>
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              {roles.isPending ? (
                <p className="text-sm text-muted-foreground">Memuat role...</p>
              ) : (
                roles.data?.map((role) => (
                  <label key={role.code} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      value={role.code}
                      className="mt-0.5 h-4 w-4 rounded border-input"
                      {...form.register('roleCodes')}
                    />
                    <span>
                      <span className="font-medium">{role.name}</span>
                      {role.description ? (
                        <span className="block text-xs text-muted-foreground">
                          {role.description}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))
              )}
            </div>
            <FieldError>{errors.roleCodes?.message}</FieldError>
          </Field>
        </>
      ) : null}

      <Field>
        <Label htmlFor="u-department">Unit kerja</Label>
        <FormSelect
          id="u-department"
          control={form.control}
          name="departmentId"
          placeholder="Tidak ada"
          emptyLabel="Tidak ada"
          what="unit kerja"
          options={(departments.data?.data ?? []).map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
        />
        <FieldError>{errors.departmentId?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="u-phone">Telepon</Label>
        <Input id="u-phone" inputMode="tel" {...form.register('phone')} />
        <FieldError>{errors.phone?.message}</FieldError>
      </Field>
    </form>
  );
}
