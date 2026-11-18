import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { detectUpload, maxUploadBytes, UNSUPPORTED_FILE_MESSAGE } from './upload-validation.js';

async function pngBuffer(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: '#ff0000' } })
    .png()
    .toBuffer();
}

const pdfBuffer = () => Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');

describe('detectUpload', () => {
  it('accepts a real PNG as a photo and as a document', async () => {
    const png = await pngBuffer();
    expect(await detectUpload(png, 'photo')).toEqual({ mime: 'image/png', ext: 'png' });
    expect(await detectUpload(png, 'document')).toEqual({ mime: 'image/png', ext: 'png' });
  });

  it('accepts a PDF as a document but not as a photo, whatever the file name says', async () => {
    const pdf = pdfBuffer();
    expect(await detectUpload(pdf, 'document')).toEqual({ mime: 'application/pdf', ext: 'pdf' });
    await expect(detectUpload(pdf, 'photo')).rejects.toThrow(BadRequestException);
    await expect(detectUpload(pdf, 'photo')).rejects.toThrow(UNSUPPORTED_FILE_MESSAGE);
  });

  it('rejects unrecognised bytes', async () => {
    const junk = Buffer.from('tidak jelas isinya apa 1234567890');
    await expect(detectUpload(junk, 'photo')).rejects.toThrow(UNSUPPORTED_FILE_MESSAGE);
    await expect(detectUpload(junk, 'document')).rejects.toThrow(UNSUPPORTED_FILE_MESSAGE);
  });

  it('knows the size limits', () => {
    expect(maxUploadBytes('photo')).toBe(10 * 1024 * 1024);
    expect(maxUploadBytes('document')).toBe(20 * 1024 * 1024);
  });
});
