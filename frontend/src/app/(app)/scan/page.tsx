'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field, FieldHint, Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { QrScannerView } from '@/features/scan/qr-scanner-view';
import { parseScannedValue } from '@/lib/scan';

export default function ScanPage() {
  const router = useRouter();
  const [manual, setManual] = useState('');
  const [navigating, setNavigating] = useState(false);
  const lastRejected = useRef<string | null>(null);

  const open = (raw: string, source: 'camera' | 'manual') => {
    const parsed = parseScannedValue(raw);
    if (!parsed) {
      // A camera keeps decoding the same wrong code many times per second; warn once per value.
      if (source === 'manual' || lastRejected.current !== raw) {
        lastRejected.current = raw;
        toast.error('Kode ini bukan QR inventaris OAMS.');
      }
      return;
    }
    setNavigating(true);
    router.push(`/a/${parsed.token}`);
  };

  return (
    <>
      <PageHeader title="Scan QR" description="Arahkan kamera ke stiker QR barang untuk membuka informasinya." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Kamera</CardTitle>
            <CardDescription>Di ponsel, kamera hanya bisa dibuka lewat alamat HTTPS yang sertifikatnya dipercaya.</CardDescription>
          </CardHeader>
          <CardContent>
            <QrScannerView onDecode={(text) => open(text, 'camera')} paused={navigating} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Input manual</CardTitle>
            <CardDescription>Tempel alamat dari stiker atau tokennya bila kamera tidak tersedia.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                open(manual, 'manual');
              }}
            >
              <Field>
                <Label htmlFor="scan-manual">Alamat atau token</Label>
                <Input
                  id="scan-manual"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="https://.../a/..."
                  autoComplete="off"
                  spellCheck={false}
                />
                <FieldHint>Alat pemindai (barcode scanner) biasanya mengetik hasilnya di sini lalu menekan Enter.</FieldHint>
              </Field>
              <Button type="submit" disabled={!manual.trim() || navigating} leftIcon={<Search className="h-4 w-4" />}>
                Buka
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
