'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field, FieldError, Label } from '@/components/ui/label';
import { PageSpinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

const schema = z.object({
  email: z.email({ message: 'Format email tidak valid' }),
  password: z.string().min(1, 'Password wajib diisi'),
});

type FormValues = z.infer<typeof schema>;

function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNext(searchParams.get('next'));
  const { status, login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (status === 'authenticated') router.replace(nextPath);
  }, [status, nextPath, router]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values.email, values.password);
      router.replace(nextPath);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.errors) {
          for (const [field, messages] of Object.entries(error.errors)) {
            if (field === 'email' || field === 'password') {
              form.setError(field, { message: messages[0] });
            }
          }
        }
        setFormError(error.message);
      } else {
        setFormError('Terjadi kesalahan yang tidak diketahui.');
      }
    }
  });

  if (status === 'loading' || status === 'authenticated') {
    return <PageSpinner label="Memeriksa sesi..." />;
  }

  const { errors, isSubmitting } = form.formState;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Masuk</CardTitle>
        <CardDescription>Gunakan akun yang diberikan oleh administrator.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {formError ? <Alert variant="error">{formError}</Alert> : null}

          <Field>
            <Label htmlFor="email" required>
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="nama@kantor.local"
              aria-invalid={Boolean(errors.email)}
              {...form.register('email')}
            />
            <FieldError>{errors.email?.message}</FieldError>
          </Field>

          <Field>
            <Label htmlFor="password" required>
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              {...form.register('password')}
            />
            <FieldError>{errors.password?.message}</FieldError>
          </Field>

          <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
            Masuk
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            <Link href="/forgot-password" className="hover:text-foreground hover:underline">
              Lupa password?
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageSpinner label="Memuat..." />}>
      <LoginForm />
    </Suspense>
  );
}
