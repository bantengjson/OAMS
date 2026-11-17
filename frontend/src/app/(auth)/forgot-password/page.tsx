import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Lupa Password' };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lupa password</CardTitle>
        <CardDescription>Reset password dilakukan oleh administrator.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert variant="info">
          Hubungi Super Admin kantor Anda untuk mengatur ulang password. Setelah direset, Anda
          dapat masuk dan mengganti password sendiri dari menu Profil.
        </Alert>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="hover:text-foreground hover:underline">
            Kembali ke halaman masuk
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
