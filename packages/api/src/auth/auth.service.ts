import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

@Injectable()
export class AuthService {
  private readonly TOTP_ISSUER = process.env.TOTP_ISSUER || 'HexStrike';

  constructor(private readonly prisma: PrismaService) {
    // Configure otplib
    authenticator.options = {
      digits: 6,
      step: 30, // 30 seconds
      window: 1, // Allow 1 step tolerance
    };
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  generateSessionToken(): string {
    return randomBytes(32).toString('hex');
  }

  async createSession(userId: string, userAgent?: string, ipAddress?: string) {
    const token = this.generateSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return this.prisma.session.create({
      data: {
        userId,
        token,
        expiresAt,
        userAgent,
        ipAddress,
      },
    });
  }

  async validateSession(token: string) {
    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    return session;
  }

  async deleteSession(token: string) {
    return this.prisma.session.delete({
      where: { token },
    });
  }

  // ==================== 2FA Methods ====================

  /**
   * Generate a new TOTP secret and QR code for 2FA setup
   */
  async generateTotpSecret(userId: string, email: string): Promise<{
    secret: string;
    qrCodeUrl: string;
    otpauthUrl: string;
  }> {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, this.TOTP_ISSUER, secret);

    // Generate QR code as data URL
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    // Store the unverified secret
    await this.prisma.totpSecret.upsert({
      where: { userId },
      create: {
        userId,
        secret,
        verified: false,
      },
      update: {
        secret,
        verified: false,
      },
    });

    return {
      secret,
      qrCodeUrl,
      otpauthUrl,
    };
  }

  /**
   * Verify TOTP code and enable 2FA
   */
  async verifyAndEnableTotp(userId: string, code: string): Promise<{
    success: boolean;
    recoveryCodes?: string[];
  }> {
    const totpRecord = await this.prisma.totpSecret.findUnique({
      where: { userId },
    });

    if (!totpRecord) {
      return { success: false };
    }

    const isValid = authenticator.verify({
      token: code,
      secret: totpRecord.secret,
    });

    if (!isValid) {
      return { success: false };
    }

    // Mark TOTP as verified and generate recovery codes
    const recoveryCodes = await this.generateRecoveryCodes(userId);

    await this.prisma.totpSecret.update({
      where: { userId },
      data: { verified: true },
    });

    return {
      success: true,
      recoveryCodes,
    };
  }

  /**
   * Verify TOTP code during login
   */
  async verifyTotpCode(userId: string, code: string): Promise<boolean> {
    const totpRecord = await this.prisma.totpSecret.findUnique({
      where: { userId },
    });

    if (!totpRecord || !totpRecord.verified) {
      return false;
    }

    return authenticator.verify({
      token: code,
      secret: totpRecord.secret,
    });
  }

  /**
   * Disable 2FA after password verification
   */
  async disableTotp(userId: string, password: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      return false;
    }

    const validPassword = await this.verifyPassword(user.passwordHash, password);
    if (!validPassword) {
      return false;
    }

    // Delete TOTP secret and recovery codes
    await this.prisma.totpSecret.delete({ where: { userId } }).catch(() => {});
    await this.prisma.recoveryCode.deleteMany({ where: { userId } });

    return true;
  }

  /**
   * Generate 10 recovery codes
   */
  private async generateRecoveryCodes(userId: string): Promise<string[]> {
    // Delete existing recovery codes
    await this.prisma.recoveryCode.deleteMany({ where: { userId } });

    const codes: string[] = [];

    for (let i = 0; i < 10; i++) {
      const code = randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);

      await this.prisma.recoveryCode.create({
        data: {
          userId,
          codeHash: await this.hashPassword(code), // Store hashed
        },
      });
    }

    return codes;
  }

  /**
   * Use a recovery code for login
   */
  async useRecoveryCode(userId: string, code: string): Promise<boolean> {
    const recoveryCodes = await this.prisma.recoveryCode.findMany({
      where: {
        userId,
        usedAt: null,
      },
    });

    for (const recoveryCode of recoveryCodes) {
      const isValid = await this.verifyPassword(recoveryCode.codeHash, code);
      if (isValid) {
        // Mark as used
        await this.prisma.recoveryCode.update({
          where: { id: recoveryCode.id },
          data: { usedAt: new Date() },
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Get remaining recovery codes count
   */
  async getRecoveryCodesCount(userId: string): Promise<number> {
    return this.prisma.recoveryCode.count({
      where: {
        userId,
        usedAt: null,
      },
    });
  }

  /**
   * Regenerate recovery codes (requires password verification)
   */
  async regenerateRecoveryCodes(
    userId: string,
    password: string,
  ): Promise<string[] | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      return null;
    }

    const validPassword = await this.verifyPassword(user.passwordHash, password);
    if (!validPassword) {
      return null;
    }

    return this.generateRecoveryCodes(userId);
  }
}
