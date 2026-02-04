import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class SendDirectMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'content is required' })
  @MaxLength(10000, { message: 'content must not exceed 10000 characters' })
  content: string;
}
