import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

/** `ParseUUIDPipe` with an Indonesian error message. */
export class ParseUuid extends ParseUUIDPipe {
  constructor() {
    super({ exceptionFactory: () => new BadRequestException('ID tidak valid.') });
  }
}
