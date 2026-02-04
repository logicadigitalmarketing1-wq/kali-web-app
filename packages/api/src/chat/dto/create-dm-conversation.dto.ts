import { IsString, IsNotEmpty, IsArray, ArrayMinSize, IsOptional, MaxLength } from 'class-validator';

export class CreateDMConversationDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  participantIds: string[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  initialMessage?: string;
}
