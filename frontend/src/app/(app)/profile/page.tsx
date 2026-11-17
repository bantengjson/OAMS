'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ChangePasswordForm } from '@/features/profile/change-password-form';
import { departmentsApi } from '@/lib/api/departments';
import { useAuth } from '@/lib/auth/use-auth';
import { ROLE_LABEL } from '@/types/api';

export default function ProfilePage() {
  const { user } = useAuth();
  const department = useQuery({
    queryKey: ['department', user?.departmentId],
    queryFn: () => departmentsApi.get(user!.departmentId!),
    enabled: Boolean(user?.departmentId),
  });

  if (!user) return null;

  return (
    <>
      <PageHeader title="Profil" description="Data akun Anda dan penggantian password." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informasi akun</CardTitle>
            <CardDescription>Perubahan data akun dilakukan oleh Super Admin.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[8rem_1fr] gap-y-3 text-sm">
              <dt className="text-muted-foreground">Nama</dt>
              <dd className="font-medium">{user.fullName}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{user.email}</dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="flex flex-wrap gap-1">
                {user.roles.map((r) => (
                  <Badge key={r}>{ROLE_LABEL[r] ?? r}</Badge>
                ))}
              </dd>
              <dt className="text-muted-foreground">Unit kerja</dt>
              <dd>
                {user.departmentId
                  ? department.data
                    ? `${department.data.name} (${department.data.code})`
                    : department.isError
                      ? '-'
                      : 'Memuat...'
                  : '-'}
              </dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ganti password</CardTitle>
            <CardDescription>Setelah diganti, semua sesi akan keluar dan Anda perlu login lagi.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
