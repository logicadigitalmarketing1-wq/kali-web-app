import { IsString, Length, Matches, IsOptional, MinLength } from 'class-validator';

export class Setup2faDto {
  // No body required for setup - just initiates the process
}

export class Verify2faDto {
  @IsString()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'TOTP code must contain only digits' })
  code: string;
}

export class Disable2faDto {
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password: string;

  @IsString()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'TOTP code must contain only digits' })
  code: string;
}

export class VerifyRecoveryCodeDto {
  @IsString()
  @Length(8, 8, { message: 'Recovery code must be exactly 8 characters' })
  recoveryCode: string;
}

export class Login2faDto {
  @IsString()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'TOTP code must contain only digits' })
  @IsOptional()
  code?: string;

  @IsString()
  @Length(8, 8, { message: 'Recovery code must be exactly 8 characters' })
  @IsOptional()
  recoveryCode?: string;
}
