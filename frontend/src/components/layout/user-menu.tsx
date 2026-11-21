'use client';

import { ChevronDown, LogOut, UserCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/lib/auth/use-auth';
import { ROLE_LABEL } from '@/types/api';

export function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  if (!user) return null;

  const roleLabel = user.roles.map((r) => ROLE_LABEL[r] ?? r).join(', ');

  return (
    <DropdownMenu
      align="end"
      trigger={
        <span className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
          <UserAvatar name={user.fullName} avatarUrl={user.avatarUrl} size="sm" />
          <span className="hidden text-left sm:block">
            <span className="block max-w-40 truncate font-medium leading-tight text-foreground">{user.fullName}</span>
            <span className="block max-w-40 truncate text-xs text-muted-foreground">{roleLabel}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </span>
      }
      items={[
        { label: 'Profil', icon: UserCircle, onSelect: () => router.push('/profile') },
        {
          label: 'Keluar',
          icon: LogOut,
          destructive: true,
          onSelect: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ]}
    />
  );
}
