import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../common/prisma.service';
import { SessionService } from './session.service';
import { TotpService } from './totp.service';
import { PinoLoggerService } from '../common/logger.service';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly totpService: TotpService,
    private readonly configService: ConfigService,
    private readonly logger: PinoLoggerService,
  ) {}

  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ sessionToken: string; requiresTwoFactor: boolean; user: { id: string; email: string; username: string; role: string } }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: true },
    });

    if (!user) {
      await this.logAudit('user.login.failed', null, { email, reason: 'User not found' }, false, ipAddress, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.isLocked) {
      const lockExpiry = user.lockedAt ? new Date(user.lockedAt.getTime() + LOCKOUT_DURATION_MS) : new Date();
      if (new Date() < lockExpiry) {
        await this.logAudit('user.login.failed', user.id, { reason: 'Account locked' }, false, ipAddress, userAgent);
        throw new UnauthorizedException('Account is locked. Please try again later.');
      }
      // Unlock the account
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isLocked: false, lockedAt: null, lockReason: null, failedAttempts: 0 },
      });
    }

    // Check if account is active
    if (!user.isActive) {
      await this.logAudit('user.login.failed', user.id, { reason: 'Account inactive' }, false, ipAddress, userAgent);
      throw new UnauthorizedException('Account is inactive');
    }

    // Verify password
    const validPassword = await argon2.verify(user.passwordHash, password);
    if (!validPassword) {
      // Increment failed attempts
      const failedAttempts = user.failedAttempts + 1;
      const shouldLock = failedAttempts >= MAX_FAILED_ATTEMPTS;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts,
          lastFailedAt: new Date(),
          isLocked: shouldLock,
          lockedAt: shouldLock ? new Date() : null,
          lockReason: shouldLock ? 'Too many failed login attempts' : null,
        },
      });

      await this.logAudit('user.login.failed', user.id, { reason: 'Invalid password', failedAttempts }, false, ipAddress, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful password verification
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: 0,
        lastFailedAt: null,
        lastLoginAt: new Date(),
      },
    });

    // Create session
    const session = await this.sessionService.createSession(user.id, ipAddress, userAgent);

    await this.logAudit('user.login.success', user.id, { requiresTwoFactor: user.totpEnabled }, true, ipAddress, userAgent);

    return {
      sessionToken: session.token,
      requiresTwoFactor: user.totpEnabled,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role.name,
      },
    };
  }

  async logout(sessionToken: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const session = await this.sessionService.validateSession(sessionToken);
    if (session) {
      await this.logAudit('user.logout', session.userId, {}, true, ipAddress, userAgent);
      await this.sessionService.invalidateSession(sessionToken);
    }
  }

  async validateSession(sessionToken: string): Promise<{
    userId: string;
    user: { id: string; email: string; username: string; role: { name: string; permissions: unknown } };
    totpVerified: boolean;
  } | null> {
    const session = await this.sessionService.validateSession(sessionToken);
    if (!session) return null;

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      include: { role: true },
    });

    if (!user || !user.isActive) return null;

    return {
      userId: session.userId,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: {
          name: user.role.name,
          permissions: user.role.permissions,
        },
      },
      totpVerified: session.totpVerified,
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const validPassword = await argon2.verify(user.passwordHash, currentPassword);
    if (!validPassword) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Validate new password
    this.validatePasswordStrength(newPassword);

    const newPasswordHash = await argon2.hash(newPassword, ARGON2_OPTIONS);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
      },
    });

    // Invalidate all other sessions
    await this.sessionService.invalidateAllUserSessions(userId);

    await this.logAudit('user.password.changed', userId, {}, true);
  }

  async createUser(
    email: string,
    username: string,
    password: string,
    roleName: string,
    createdBy: string,
  ): Promise<{ id: string; email: string; username: string }> {
    // Validate password
    this.validatePasswordStrength(password);

    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new BadRequestException('Invalid role');

    const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username,
        passwordHash,
        roleId: role.id,
      },
    });

    await this.logAudit('user.created', createdBy, { newUserId: user.id, email: user.email }, true);

    return { id: user.id, email: user.email, username: user.username };
  }

  private validatePasswordStrength(password: string): void {
    if (password.length < 12) {
      throw new BadRequestException('Password must be at least 12 characters');
    }
    if (!/[a-z]/.test(password)) {
      throw new BadRequestException('Password must contain lowercase letters');
    }
    if (!/[A-Z]/.test(password)) {
      throw new BadRequestException('Password must contain uppercase letters');
    }
    if (!/[0-9]/.test(password)) {
      throw new BadRequestException('Password must contain numbers');
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
      throw new BadRequestException('Password must contain special characters');
    }
  }

  private async logAudit(
    action: string,
    userId: string | null,
    details: Record<string, unknown>,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          userId,
          resource: 'auth',
          details,
          success,
          ipAddress,
          userAgent,
        },
      });
    } catch (error) {
      this.logger.error('Failed to write audit log', String(error), 'AuthService');
    }
  }
}
