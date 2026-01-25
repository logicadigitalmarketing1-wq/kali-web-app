import { Injectable, BadRequestException } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../common/prisma.service';
import { SessionService } from './session.service';
import { PinoLoggerService } from '../common/logger.service';

const RECOVERY_CODE_COUNT = 8;
const APP_NAME = 'SecureScope';

@Injectable()
export class TotpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly logger: PinoLoggerService,
  ) {
    // Configure authenticator
    authenticator.options = {
      window: 1, // Allow 1 step before/after for clock drift
    };
  }

  async setupTotp(userId: string): Promise<{ secret: string; qrCodeUrl: string; recoveryCodes: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    if (user.totpEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    // Generate secret
    const secret = authenticator.generateSecret();

    // Store secret (not verified yet)
    await this.prisma.totpSecret.upsert({
      where: { userId },
      update: { secret, verifiedAt: null },
      create: { userId, secret },
    });

    // Generate QR code
    const otpAuthUrl = authenticator.keyuri(user.email, APP_NAME, secret);
    const qrCodeUrl = await QRCode.toDataURL(otpAuthUrl);

    // Generate recovery codes
    const recoveryCodes = await this.generateRecoveryCodes(userId);

    await this.logAudit('user.2fa.setup.started', userId, {});

    return { secret, qrCodeUrl, recoveryCodes };
  }

  async verifyAndEnableTotp(userId: string, token: string): Promise<void> {
    const totpSecret = await this.prisma.totpSecret.findUnique({
      where: { userId },
    });

    if (!totpSecret) {
      throw new BadRequestException('2FA setup not started');
    }

    if (totpSecret.verifiedAt) {
      throw new BadRequestException('2FA is already enabled');
    }

    const isValid = authenticator.verify({
      token,
      secret: totpSecret.secret,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    // Enable 2FA
    await this.prisma.$transaction([
      this.prisma.totpSecret.update({
        where: { userId },
        data: { verifiedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { totpEnabled: true },
      }),
    ]);

    await this.logAudit('user.2fa.enabled', userId, {});
  }

  async verifyTotp(userId: string, sessionToken: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { totpSecret: true },
    });

    if (!user?.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('2FA is not enabled');
    }

    const isValid = authenticator.verify({
      token,
      secret: user.totpSecret.secret,
    });

    if (isValid) {
      await this.sessionService.markTotpVerified(sessionToken);
      await this.logAudit('user.2fa.verified', userId, {});
      return true;
    }

    await this.logAudit('user.2fa.failed', userId, {});
    return false;
  }

  async verifyRecoveryCode(userId: string, sessionToken: string, code: string): Promise<boolean> {
    const recoveryCodes = await this.prisma.recoveryCode.findMany({
      where: { userId, usedAt: null },
    });

    for (const recoveryCode of recoveryCodes) {
      const isValid = await argon2.verify(recoveryCode.codeHash, code);
      if (isValid) {
        // Mark code as used
        await this.prisma.recoveryCode.update({
          where: { id: recoveryCode.id },
          data: { usedAt: new Date() },
        });

        await this.sessionService.markTotpVerified(sessionToken);
        await this.logAudit('user.2fa.recovery.used', userId, { codeId: recoveryCode.id });
        return true;
      }
    }

    await this.logAudit('user.2fa.recovery.failed', userId, {});
    return false;
  }

  async disableTotp(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    // Verify password for re-auth
    const validPassword = await argon2.verify(user.passwordHash, password);
    if (!validPassword) {
      throw new BadRequestException('Invalid password');
    }

    // Disable 2FA
    await this.prisma.$transaction([
      this.prisma.totpSecret.delete({ where: { userId } }).catch(() => {}),
      this.prisma.recoveryCode.deleteMany({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: { totpEnabled: false },
      }),
    ]);

    await this.logAudit('user.2fa.disabled', userId, {});
  }

  async regenerateRecoveryCodes(userId: string, password: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    // Verify password for re-auth
    const validPassword = await argon2.verify(user.passwordHash, password);
    if (!validPassword) {
      throw new BadRequestException('Invalid password');
    }

    // Delete old codes and generate new ones
    await this.prisma.recoveryCode.deleteMany({ where: { userId } });
    const codes = await this.generateRecoveryCodes(userId);

    await this.logAudit('user.2fa.recovery.regenerated', userId, {});

    return codes;
  }

  private async generateRecoveryCodes(userId: string): Promise<string[]> {
    const codes: string[] = [];

    for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
      const code = randomBytes(4).toString('hex').toUpperCase();
      const formattedCode = `${code.slice(0, 4)}-${code.slice(4)}`;
      codes.push(formattedCode);

      const codeHash = await argon2.hash(formattedCode, {
        type: argon2.argon2id,
        memoryCost: 16384,
        timeCost: 2,
        parallelism: 1,
      });

      await this.prisma.recoveryCode.create({
        data: { userId, codeHash },
      });
    }

    return codes;
  }

  private async logAudit(action: string, userId: string, details: Record<string, unknown>): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          userId,
          resource: 'auth',
          details,
          success: true,
        },
      });
    } catch (error) {
      this.logger.error('Failed to write audit log', String(error), 'TotpService');
    }
  }
}
