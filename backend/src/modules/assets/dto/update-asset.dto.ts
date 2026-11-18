import { PartialType } from '@nestjs/swagger';
import { CreateAssetDto } from './create-asset.dto.js';

/** Every field optional; nullable fields accept `null` to clear the value. */
export class UpdateAssetDto extends PartialType(CreateAssetDto) {}
