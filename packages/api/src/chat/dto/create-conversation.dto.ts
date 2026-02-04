import {
  IsString,
  IsOptional,
  IsObject,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'title must not exceed 200 characters' })
  title?: string;

  @IsOptional()
  @IsObject({ message: 'context must be an object' })
  context?: Record<string, unknown>;
}
