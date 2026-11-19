'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { UserLookup } from '@/features/assets/user-lookup';
import { departmentsApi } from '@/lib/api/departments';
import { employeesApi } from '@/lib/api/employees';
import { applyApiError } from '@/lib/api/form-errors';
import type { Employee } from '@/types/api';

const optional = (max: number) => z.string().trim().max(max, `Maksimal ${max} karakter`);

const schema = z.object({
  fullName: z.string().trim().min(1, 'Nama wajib diisi').max(150, 'Maksimal 150 karakter'),
  employeeNumber: optional(30),
  departmentId: z.string(),
  position: optional(100),
  phone: optional(30),
  email: z
    .string()
    .trim()
    .refine((v) => v === '' || z.email().safeParse(v).success, 'Format email tidak valid'),
  userId: z.string(),
});

type FormValues = z.infer<typeof schema>;
const FIELDS = ['fullName', 'employeeNumber', 'departmentId', 'position', 'phone', 'email', 'userId'] as const;

const orNull = (v: string) => (v.trim() ? v.trim() : null);

export function EmployeeFormDialog({
  open,
  employee,
  onClose,
  onSaved,
}: {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={employee ? 'Ubah pegawai' : 'Tambah pegawai'}
      description="Daftar pegawai dipakai untuk penanggung jawab barang, peminjam, dan penjamin."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="employee-form">
            Simpan
          </Button>
        </>
      }
    >
      {open ? <EmployeeForm key={employee?.id ?? 'new'} employee={employee} onSaved={onSaved} /> : null}
    </Dialog>
  );
}

function EmployeeForm({ employee, onSaved }: { employee: Employee | null; onSaved: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState<string | null>(employee?.user?.fullName ?? null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: employee?.fullName ?? '',
      employeeNumber: employee?.employeeNumber ?? '',
      departmentId: employee?.department?.id ?? '',
      position: employee?.position ?? '',
      phone: employee?.phone ?? '',
      email: employee?.email ?? '',
      userId: employee?.user?.id ?? '',
    },
  });
  const { errors } = form.formState;
  const departments = useQuery({
    queryKey: ['departments', { isActive: true, pageSize: 100 }],
    queryFn: () => departmentsApi.list({ isActive: true, pageSize: 100 }),
    staleTime: 60_000,
  });

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    const input = {
      fullName: values.fullName.trim(),
      employeeNumber: orNull(values.employeeNumber),
      departmentId: orNull(values.departmentId),
      position: orNull(values.position),
      phone: orNull(values.phone),
      email: orNull(values.email),
      userId: orNull(values.userId),
    };
    try {
      if (employee) await employeesApi.update(employee.id, input);
      else await employeesApi.create(input);
      toast.success(employee ? 'Data pegawai tersimpan.' : 'Pegawai ditambahkan.');
      onSaved();
    } catch (error) {
      setFormError(applyApiError(error, form.setError, [...FIELDS]));
    }
  });

  return (
    <form id="employee-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      {formError ? <Alert variant="error" className="sm:col-span-2">{formError}</Alert> : null}
      <Field className="sm:col-span-2">
        <Label htmlFor="emp-fullName" required>Nama lengkap</Label>
        <Input id="emp-fullName" autoFocus {...form.register('fullName')} />
        <FieldError>{errors.fullName?.message}</FieldError>
      </Field>
      <Field>
        <Label htmlFor="emp-number">Nomor pegawai / NIP</Label>
        <Input id="emp-number" placeholder="Opsional" {...form.register('employeeNumber')} />
        <FieldError>{errors.employeeNumber?.message}</FieldError>
      </Field>
      <Field>
        <Label htmlFor="emp-department">Unit kerja</Label>
        <Select id="emp-department" {...form.register('departmentId')}>
          <option value="">Tidak ada</option>
          {departments.data?.data.map((d) => (
            <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
          ))}
        </Select>
        <FieldError>{errors.departmentId?.message}</FieldError>
      </Field>
      <Field>
        <Label htmlFor="emp-position">Jabatan</Label>
        <Input id="emp-position" placeholder="Opsional" {...form.register('position')} />
        <FieldError>{errors.position?.message}</FieldError>
      </Field>
      <Field>
        <Label htmlFor="emp-phone">Kontak</Label>
        <Input id="emp-phone" placeholder="Nomor HP, opsional" {...form.register('phone')} />
        <FieldError>{errors.phone?.message}</FieldError>
      </Field>
      <Field className="sm:col-span-2">
        <Label htmlFor="emp-email">Email</Label>
        <Input id="emp-email" type="email" placeholder="Opsional" {...form.register('email')} />
        <FieldError>{errors.email?.message}</FieldError>
      </Field>
      <Field className="sm:col-span-2">
        <Label htmlFor="emp-user">Akun login</Label>
        <Controller
          control={form.control}
          name="userId"
          render={({ field }) => (
            <UserLookup
              id="emp-user"
              value={field.value}
              label={userLabel}
              invalid={Boolean(errors.userId)}
              onChange={(id, label) => {
                field.onChange(id);
                setUserLabel(label);
              }}
            />
          )}
        />
        <FieldHint>Opsional. Tautkan bila pegawai ini punya akun OAMS; satu akun untuk satu pegawai.</FieldHint>
        <FieldError>{errors.userId?.message}</FieldError>
      </Field>
    </form>
  );
}
