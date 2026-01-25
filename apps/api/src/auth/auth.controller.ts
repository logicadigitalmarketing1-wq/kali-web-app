import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { TotpService } from './totp.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser, CurrentSession } from './decorators';
import { LoginDto, VerifyTotpDto, ChangePasswordDto, SetupTotpDto } from './dto';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60 * 1000, // 1 hour
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly totpService: TotpService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      dto.email,
      dto.password,
      req.ip,
      req.headers['user-agent'],
    );

    res.cookie('session', result.sessionToken, COOKIE_OPTIONS);

    return {
      success: true,
      requiresTwoFactor: result.requiresTwoFactor,
      user: result.user,
    };
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate session' })
  async logout(
    @CurrentSession() sessionToken: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(sessionToken, req.ip, req.headers['user-agent']);
    res.clearCookie('session');
    return { success: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get current user info' })
  async me(@CurrentUser() user: any) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role.name,
    };
  }

  @Post('2fa/setup')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Start 2FA setup' })
  async setupTotp(@CurrentUser() user: any) {
    const result = await this.totpService.setupTotp(user.id);
    return {
      qrCodeUrl: result.qrCodeUrl,
      recoveryCodes: result.recoveryCodes,
    };
  }

  @Post('2fa/verify-setup')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Verify and enable 2FA' })
  async verifySetup(@CurrentUser() user: any, @Body() dto: SetupTotpDto) {
    await this.totpService.verifyAndEnableTotp(user.id, dto.token);
    return { success: true, message: '2FA has been enabled' };
  }

  @Post('2fa/verify')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Verify 2FA token for current session' })
  async verifyTotp(
    @CurrentUser() user: any,
    @CurrentSession() sessionToken: string,
    @Body() dto: VerifyTotpDto,
  ) {
    const success = await this.totpService.verifyTotp(user.id, sessionToken, dto.token);
    if (!success) {
      return { success: false, message: 'Invalid verification code' };
    }
    return { success: true };
  }

  @Post('2fa/verify-recovery')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Verify using recovery code' })
  async verifyRecovery(
    @CurrentUser() user: any,
    @CurrentSession() sessionToken: string,
    @Body() dto: VerifyTotpDto,
  ) {
    const success = await this.totpService.verifyRecoveryCode(user.id, sessionToken, dto.token);
    if (!success) {
      return { success: false, message: 'Invalid recovery code' };
    }
    return { success: true };
  }

  @Post('2fa/disable')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Disable 2FA' })
  async disableTotp(@CurrentUser() user: any, @Body('password') password: string) {
    await this.totpService.disableTotp(user.id, password);
    return { success: true, message: '2FA has been disabled' };
  }

  @Post('2fa/regenerate-recovery')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Regenerate recovery codes' })
  async regenerateRecoveryCodes(@CurrentUser() user: any, @Body('password') password: string) {
    const codes = await this.totpService.regenerateRecoveryCodes(user.id, password);
    return { recoveryCodes: codes };
  }

  @Post('password/change')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Change password' })
  async changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
    return { success: true, message: 'Password changed successfully' };
  }
}
