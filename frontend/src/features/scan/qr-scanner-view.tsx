'use client';

import type QrScanner from 'qr-scanner';
import { Camera, CameraOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldSelect } from '@/components/ui/select-panel';

type CameraInfo = { id: string; label: string };
type State = 'idle' | 'starting' | 'scanning' | 'unavailable';

function describeCameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  const text = error instanceof Error ? error.message : String(error ?? '');
  if (name === 'NotAllowedError' || /permission|denied/i.test(text)) {
    return 'Izin kamera ditolak. Izinkan akses kamera di browser, lalu coba lagi.';
  }
  if (name === 'NotFoundError' || /no camera|camera not found/i.test(text)) {
    return 'Kamera tidak ditemukan di perangkat ini.';
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Kamera hanya bisa diakses lewat HTTPS (atau localhost). Gunakan input manual di bawah.';
  }
  return 'Kamera tidak bisa dibuka. Gunakan input manual di bawah.';
}

/**
 * Camera viewfinder built on `qr-scanner`. The library is imported lazily so
 * the page can render on the server and on devices without a camera.
 */
export function QrScannerView({ onDecode, paused = false }: { onDecode: (text: string) => void; paused?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const onDecodeRef = useRef(onDecode);
  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [cameraId, setCameraId] = useState<string>('');

  const stop = () => {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setState('idle');
  };

  const start = async () => {
    const video = videoRef.current;
    if (!video) return;
    setState('starting');
    setMessage(null);
    try {
      const { default: Scanner } = await import('qr-scanner');
      const scanner = new Scanner(
        video,
        (result) => onDecodeRef.current(result.data),
        {
          preferredCamera: cameraId || 'environment',
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 8,
          returnDetailedScanResult: true,
        },
      );
      scannerRef.current = scanner;
      await scanner.start();
      setState('scanning');
      const list = await Scanner.listCameras(true);
      setCameras(list.map((c) => ({ id: c.id, label: c.label || 'Kamera' })));
    } catch (error) {
      scannerRef.current?.destroy();
      scannerRef.current = null;
      setMessage(describeCameraError(error));
      setState('unavailable');
    }
  };

  // Pause decoding while the parent is busy (e.g. navigating) without tearing the camera down.
  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    if (paused) scanner.pause();
    else void scanner.start();
  }, [paused]);

  useEffect(() => {
    return () => {
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, []);

  const switchCamera = async (id: string) => {
    setCameraId(id);
    if (scannerRef.current && id) await scannerRef.current.setCamera(id);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full max-w-md overflow-hidden rounded-lg border border-border bg-black sm:aspect-4/3">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {state !== 'scanning' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 p-4 text-center text-sm text-white">
            {state === 'unavailable' ? <CameraOff className="h-8 w-8" /> : <Camera className="h-8 w-8" />}
            {state === 'starting' ? 'Membuka kamera...' : state === 'unavailable' ? 'Kamera tidak tersedia' : 'Kamera belum dinyalakan'}
          </div>
        ) : null}
      </div>

      {message ? <Alert variant="info">{message}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2">
        {state === 'scanning' || state === 'starting' ? (
          <Button variant="outline" onClick={stop} leftIcon={<CameraOff className="h-4 w-4" />}>Matikan kamera</Button>
        ) : (
          <Button onClick={() => void start()} leftIcon={<Camera className="h-4 w-4" />}>Nyalakan kamera</Button>
        )}
        {cameras.length > 1 ? (
          <FieldSelect
            className="w-60"
            value={cameraId}
            onChange={(v) => void switchCamera(v)}
            placeholder="Kamera belakang (otomatis)"
            emptyLabel="Kamera belakang (otomatis)"
            what="kamera"
            options={cameras.map((c) => ({ value: c.id, label: c.label }))}
          />
        ) : null}
      </div>
    </div>
  );
}
