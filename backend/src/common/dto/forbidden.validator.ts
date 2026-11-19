import { ValidatorConstraint } from 'class-validator';
import type { ValidationArguments, ValidatorConstraintInterface } from 'class-validator';

/**
 * Always fails: for DTO keys that exist only to be refused with a per-field
 * message, e.g. `@Validate(Forbidden, ['Ubah lewat mutasi']) locationId?: unknown`.
 * Combine with `@IsOptional()` so an absent key passes.
 */
@ValidatorConstraint({ name: 'forbiddenField', async: false })
export class Forbidden implements ValidatorConstraintInterface {
  validate(): boolean {
    return false;
  }
  defaultMessage(args: ValidationArguments): string {
    return String(args.constraints?.[0] ?? 'Kolom ini tidak boleh diubah di sini');
  }
}
