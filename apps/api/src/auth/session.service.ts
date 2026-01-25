import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { REDIS_CLIENT } from '../common/redis.module';

const SESSION_TTL_SECONDS = 60 * 60; // 1 hour
const SESSION_PREFIX = 'session:';

interface SessionData {
  userId: string;
  totpVerified: boolean;
  createdAt: string;
  lastAccessAt: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

    // Store in database for persistence
    await this.prisma.session.create({
      data: {
        token,
        userId,
        ipAddress,
        userAgent,
        expiresAt,
        totpVerified: false,
      },
    });

    // Store in Redis for fast access
    const sessionData: SessionData = {
      userId,
      totpVerified: false,
      createdAt: new Date().toISOString(),
      lastAccessAt: new Date().toISOString(),
      ipAddress,
      userAgent,
    };

    await this.redis.setex(
      SESSION_PREFIX + token,
      SESSION_TTL_SECONDS,
      JSON.stringify(sessionData),
    );

    return { token, expiresAt };
  }

  async validateSession(token: string): Promise<SessionData | null> {
    // Try Redis first
    const cached = await this.redis.get(SESSION_PREFIX + token);
    if (cached) {
      const session = JSON.parse(cached) as SessionData;

      // Update last access time
      session.lastAccessAt = new Date().toISOString();
      await this.redis.setex(
        SESSION_PREFIX + token,
        SESSION_TTL_SECONDS,
        JSON.stringify(session),
      );

      return session;
    }

    // Fall back to database
    const dbSession = await this.prisma.session.findUnique({
      where: { token },
    });

    if (!dbSession || dbSession.expiresAt < new Date()) {
      return null;
    }

    // Restore to Redis
    const sessionData: SessionData = {
      userId: dbSession.userId,
      totpVerified: dbSession.totpVerified,
      createdAt: dbSession.createdAt.toISOString(),
      lastAccessAt: new Date().toISOString(),
      ipAddress: dbSession.ipAddress || undefined,
      userAgent: dbSession.userAgent || undefined,
    };

    await this.redis.setex(
      SESSION_PREFIX + token,
      SESSION_TTL_SECONDS,
      JSON.stringify(sessionData),
    );

    // Update last access in database
    await this.prisma.session.update({
      where: { token },
      data: { lastAccessAt: new Date() },
    });

    return sessionData;
  }

  async markTotpVerified(token: string): Promise<void> {
    // Update Redis
    const cached = await this.redis.get(SESSION_PREFIX + token);
    if (cached) {
      const session = JSON.parse(cached) as SessionData;
      session.totpVerified = true;
      await this.redis.setex(
        SESSION_PREFIX + token,
        SESSION_TTL_SECONDS,
        JSON.stringify(session),
      );
    }

    // Update database
    await this.prisma.session.update({
      where: { token },
      data: { totpVerified: true },
    });
  }

  async invalidateSession(token: string): Promise<void> {
    await this.redis.del(SESSION_PREFIX + token);
    await this.prisma.session.delete({ where: { token } }).catch(() => {});
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      select: { token: true },
    });

    for (const session of sessions) {
      await this.redis.del(SESSION_PREFIX + session.token);
    }

    await this.prisma.session.deleteMany({ where: { userId } });
  }

  async rotateSession(oldToken: string): Promise<{ token: string; expiresAt: Date } | null> {
    const session = await this.validateSession(oldToken);
    if (!session) return null;

    // Create new session
    const newSession = await this.createSession(
      session.userId,
      session.ipAddress,
      session.userAgent,
    );

    // Mark TOTP verified if it was
    if (session.totpVerified) {
      await this.markTotpVerified(newSession.token);
    }

    // Invalidate old session
    await this.invalidateSession(oldToken);

    return newSession;
  }
}
