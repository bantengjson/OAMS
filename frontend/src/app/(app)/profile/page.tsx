'use client';

import { useQuery } from '@tanstack/react-query';
import { AtSign, Building2, Clock, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChangePasswordForm } from '@/features/profile/change-password-form';
import { ProfileNameForm } from '@/features/profile/profile-name-form';
import { ProfilePhoto } from '@/features/profile/profile-photo';
import { departmentsApi } from '@/lib/api/departments';
import { useAuth } from '@/lib/auth/use-auth';
import { formatDateTime } from '@/lib/utils';
import { ROLE_LABEL } from '@/types/api';

function InfoRow({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium break-words text-foreground">{children}</dd>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const department = useQuery({
    queryKey: ['department', user?.departmentId],
    queryFn: () => departmentsApi.get(user!.departmentId!),
    enabled: Boolean(user?.departmentId),
  });

  if (!user) return null;

  const departmentText = user.departmentId
    ? department.data
      ? `${department.data.name} (${department.data.code})`
      : department.isError
        ? '-'
        : 'Memuat...'
    : '-';

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary via-tone-violet to-tone-teal sm:h-28" aria-hidden="true" />
        <CardContent className="-mt-14 flex flex-col items-center gap-4 pb-6 text-center sm:-mt-12 sm:flex-row sm:items-start sm:text-left">
          <ProfilePhoto />
          <div className="min-w-0 flex-1 sm:pt-16">
            <h1 className="truncate text-xl font-semibold text-foreground">{user.fullName}</h1>
            <p className="text-sm text-muted-foreground">
              {user.username ? `@${user.username}` : user.email}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-1 sm:justify-start">
              {user.roles.map((r) => (
                <Badge key={r}>{ROLE_LABEL[r] ?? r}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-primary" aria-hidden="true" />
              Informasi akun
            </CardTitle>
            <CardDescription>Nama tampilan bisa Anda ubah sendiri. Username, email, role, dan unit kerja diubah oleh Super Admin.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <ProfileNameForm />
            <dl className="divide-y divide-border">
              <InfoRow icon={AtSign} label="Username (untuk login)">
                {user.username ?? '-'}
              </InfoRow>
              <InfoRow icon={Mail} label="Email">
                {user.email}
              </InfoRow>
              <InfoRow icon={ShieldCheck} label="Role">
                {user.roles.map((r) => ROLE_LABEL[r] ?? r).join(', ') || '-'}
              </InfoRow>
              <InfoRow icon={Building2} label="Unit kerja">
                {departmentText}
              </InfoRow>
              <InfoRow icon={Clock} label="Login terakhir">
                {formatDateTime(user.lastLoginAt)}
              </InfoRow>
            </dl>
          </CardContent>
        </Card>
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
              Ganti password
            </CardTitle>
            <CardDescription>Setelah diganti, semua sesi akan keluar dan Anda perlu login lagi.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
