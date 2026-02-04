import { IsString, IsNotEmpty, MaxLength, IsUUID } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'content is required' })
  @MaxLength(10000, { message: 'content must not exceed 10000 characters' })
  content: string;
}

export class ConversationIdParamDto {
  @IsUUID('4', { message: 'id must be a valid UUID' })
  id: string;
}
