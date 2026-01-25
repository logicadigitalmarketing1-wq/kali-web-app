import { IsEmail, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(1)
  password: string;
}

export class VerifyTotpDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP code or recovery code' })
  @IsString()
  @MinLength(1)
  token: string;
}

export class SetupTotpDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP code to verify setup' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Token must be a 6-digit code' })
  token: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'currentPassword123!' })
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @ApiProperty({ example: 'newSecurePassword123!' })
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  newPassword: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'username' })
  @IsString()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Username can only contain letters, numbers, underscores, and hyphens' })
  username: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  @MinLength(12)
  password: string;

  @ApiProperty({ example: 'engineer', enum: ['admin', 'engineer', 'viewer'] })
  @IsString()
  role: string;
}
