import {
  IsString,
  IsUUID,
  IsObject,
  IsNotEmpty,
  MaxLength,
  Matches,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRunDto {
  @IsString({ message: 'toolSlug must be a string' })
  @IsNotEmpty({ message: 'toolSlug is required' })
  toolSlug: string;

  @IsString({ message: 'scopeId must be a string' })
  @IsNotEmpty({ message: 'scopeId is required' })
  scopeId: string;

  @IsObject({ message: 'params must be an object' })
  params: Record<string, unknown>;

  @IsString()
  @IsNotEmpty({ message: 'target is required' })
  @MaxLength(255, { message: 'target must not exceed 255 characters' })
  @Matches(/^[a-zA-Z0-9.\-_:\/]+$/, {
    message: 'target contains invalid characters',
  })
  target: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(3600)
  timeout?: number;
}

export class QueryRunsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  status?: string;
}

export class RunIdParamDto {
  @IsString({ message: 'id must be a string' })
  @IsNotEmpty({ message: 'id is required' })
  id: string;
}
