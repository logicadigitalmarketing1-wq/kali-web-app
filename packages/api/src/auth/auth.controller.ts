import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';

// Type helpers for Fastify with @fastify/cookie support
// Using intersection types instead of extends to avoid type conflicts
type FastifyRequestWithCookies = FastifyRequest & {
  cookies?: Record<string, string>;
};

type FastifyReplyWithCookies = FastifyReply & {
  setCookie(name: string, value: string, options?: Record<string, unknown>): FastifyReplyWithCookies;
  clearCookie(name: string, options?: Record<string, unknown>): FastifyReplyWithCookies;
};
import { PrismaService } from '../prisma/prisma.service';
import {
  RegisterDto,
  LoginDto,
  Verify2faDto,
  Disable2faDto,
  Login2faDto,
} from './dto';
import { Public, CurrentUser, AuthenticatedUser } from '../common/decorators';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const passwordHash = await this.authService.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    const session = await this.authService.createSession(
      user.id,
      req.headers['user-agent'] as string,
      req.ip,
    );

    this.setSessionCookie(res, session.token);

    return { user };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        failedLogins: true,
        lockedUntil: true,
        isActive: true,
        totpSecret: {
          select: { verified: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesRemaining = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ForbiddenException(
        `Account is locked. Try again in ${minutesRemaining} minutes.`,
      );
    }

    const valid = await this.authService.verifyPassword(
      user.passwordHash,
      dto.password,
    );

    if (!valid) {
      const newFailedLogins = user.failedLogins + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: newFailedLogins,
          lockedUntil:
            newFailedLogins >= 5
              ? new Date(Date.now() + 15 * 60 * 1000)
              : null,
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed logins on successful login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
    });

    const totpEnabled = user.totpSecret?.verified ?? false;

    const session = await this.authService.createSession(
      user.id,
      req.headers['user-agent'] as string,
      req.ip,
    );

    this.setSessionCookie(res, session.token);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        totpEnabled,
      },
      requiresTotpVerification: totpEnabled,
    };
  }

  @Public()
  @Post('login/2fa')
  @HttpCode(HttpStatus.OK)
  async login2fa(
    @Body() dto: Login2faDto,
    @Req() req: FastifyRequestWithCookies,
  ) {
    // This endpoint is used after initial login when 2FA is required
    const token = req.cookies?.session;
    if (!token) {
      throw new UnauthorizedException('Session required');
    }

    const session = await this.authService.validateSession(token);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    let verified = false;

    if (dto.code) {
      verified = await this.authService.verifyTotpCode(session.userId, dto.code);
    } else if (dto.recoveryCode) {
      verified = await this.authService.useRecoveryCode(
        session.userId,
        dto.recoveryCode,
      );
    }

    if (!verified) {
      throw new UnauthorizedException('Invalid verification code');
    }

    return {
      success: true,
      message: '2FA verification successful',
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: FastifyRequestWithCookies,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const token = req.cookies?.session;
    if (token) {
      await this.authService.deleteSession(token).catch(() => {});
    }

    (res as unknown as FastifyReplyWithCookies).clearCookie('session', { path: '/' });
    return;
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: AuthenticatedUser) {
    const recoveryCodesCount = await this.authService.getRecoveryCodesCount(
      user.id,
    );

    return {
      user: {
        ...user,
        recoveryCodesRemaining: recoveryCodesCount,
      },
    };
  }

  // ==================== 2FA Endpoints ====================

  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  async setup2fa(@CurrentUser() user: AuthenticatedUser) {
    if (user.totpEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    // Get user email
    const userData = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true },
    });

    if (!userData) {
      throw new UnauthorizedException('User not found');
    }

    const { secret, qrCodeUrl, otpauthUrl } =
      await this.authService.generateTotpSecret(user.id, userData.email);

    return {
      secret,
      qrCodeUrl,
      otpauthUrl,
      message: 'Scan the QR code with your authenticator app, then verify',
    };
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  async verify2fa(
    @Body() dto: Verify2faDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.authService.verifyAndEnableTotp(user.id, dto.code);

    if (!result.success) {
      throw new BadRequestException('Invalid verification code');
    }

    return {
      success: true,
      message: '2FA has been enabled successfully',
      recoveryCodes: result.recoveryCodes,
      warning:
        'Save these recovery codes in a safe place. They can only be shown once.',
    };
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  async disable2fa(
    @Body() dto: Disable2faDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user.totpEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    // First verify the TOTP code
    const totpValid = await this.authService.verifyTotpCode(user.id, dto.code);
    if (!totpValid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    // Then verify the password and disable
    const success = await this.authService.disableTotp(user.id, dto.password);

    if (!success) {
      throw new BadRequestException('Invalid password');
    }

    return {
      success: true,
      message: '2FA has been disabled',
    };
  }

  @Get('2fa/status')
  @HttpCode(HttpStatus.OK)
  async get2faStatus(@CurrentUser() user: AuthenticatedUser) {
    const recoveryCodesCount = await this.authService.getRecoveryCodesCount(
      user.id,
    );

    return {
      enabled: user.totpEnabled,
      recoveryCodesRemaining: recoveryCodesCount,
    };
  }

  @Post('2fa/recovery-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  async regenerateRecoveryCodes(
    @Body() body: { password: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user.totpEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    const codes = await this.authService.regenerateRecoveryCodes(
      user.id,
      body.password,
    );

    if (!codes) {
      throw new BadRequestException('Invalid password');
    }

    return {
      recoveryCodes: codes,
      warning:
        'Your previous recovery codes have been invalidated. Save these new codes.',
    };
  }

  private setSessionCookie(res: FastifyReply, token: string) {
    // @fastify/cookie adds setCookie method to reply
    // sameSite: 'lax' allows cookies to be sent with cross-origin GET requests (SSE)
    // while still protecting against CSRF for POST/PUT/DELETE
    (res as unknown as FastifyReplyWithCookies).setCookie('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60, // 24 hours
    });
  }
}
