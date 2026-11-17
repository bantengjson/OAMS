import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';
import { trimUpper } from './transforms.js';

export const CODE_PATTERN = /^[A-Z0-9_]{2,20}$/;
export const CODE_MESSAGE = 'Kode hanya boleh huruf besar, angka dan garis bawah (2-20 karakter).';

/** Trims, upper-cases and validates a master-data code such as `KOMPUTER_IT`. */
export function IsCode(): PropertyDecorator {
  return applyDecorators(Transform(trimUpper), Matches(CODE_PATTERN, { message: CODE_MESSAGE }));
}
