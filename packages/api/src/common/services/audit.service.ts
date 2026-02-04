import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export enum AuditAction {
  // Auth actions
  LOGIN = 'LOGIN',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  REGISTER = 'REGISTER',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET = 'PASSWORD_RESET',

  // 2FA actions
  TOTP_SETUP = 'TOTP_SETUP',
  TOTP_ENABLED = 'TOTP_ENABLED',
  TOTP_DISABLED = 'TOTP_DISABLED',
  RECOVERY_CODE_USED = 'RECOVERY_CODE_USED',
  RECOVERY_CODES_REGENERATED = 'RECOVERY_CODES_REGENERATED',

  // Run actions
  RUN_CREATED = 'RUN_CREATED',
  RUN_STARTED = 'RUN_STARTED',
  RUN_COMPLETED = 'RUN_COMPLETED',
  RUN_FAILED = 'RUN_FAILED',
  RUN_CANCELLED = 'RUN_CANCELLED',

  // Scope actions
  SCOPE_CREATED = 'SCOPE_CREATED',
  SCOPE_UPDATED = 'SCOPE_UPDATED',
  SCOPE_DELETED = 'SCOPE_DELETED',
  SCOPE_ACCESS_GRANTED = 'SCOPE_ACCESS_GRANTED',
  SCOPE_ACCESS_REVOKED = 'SCOPE_ACCESS_REVOKED',

  // Tool actions
  TOOL_EXECUTED = 'TOOL_EXECUTED',

  // User actions
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  USER_REACTIVATED = 'USER_REACTIVATED',

  // Finding actions
  FINDING_CREATED = 'FINDING_CREATED',
  FINDING_UPDATED = 'FINDING_UPDATED',

  // Admin actions
  SETTINGS_CHANGED = 'SETTINGS_CHANGED',
}

export interface AuditLogData {
  userId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an audit event
   */
  async log(data: AuditLogData): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          details: (data.details as Prisma.InputJsonValue) ?? undefined,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });

      // Also log to console for monitoring
      this.logger.log(
        `[AUDIT] ${data.action} on ${data.resource}${data.resourceId ? `#${data.resourceId}` : ''} by ${data.userId || 'anonymous'}`,
      );
    } catch (error) {
      // Don't throw - audit logging should not break the application
      this.logger.error('Failed to create audit log', error);
    }
  }

  /**
   * Log authentication events
   */
  async logAuth(
    action: AuditAction,
    userId: string | undefined,
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource: 'auth',
      details: { email },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log run events
   */
  async logRun(
    action: AuditAction,
    userId: string,
    runId: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource: 'run',
      resourceId: runId,
      details,
    });
  }

  /**
   * Log tool execution events
   */
  async logToolExecution(
    userId: string,
    toolName: string,
    target: string,
    scopeId: string,
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.TOOL_EXECUTED,
      resource: 'tool',
      resourceId: toolName,
      details: { target, scopeId },
    });
  }

  /**
   * Log user management events
   */
  async logUserAction(
    action: AuditAction,
    actorId: string,
    targetUserId: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      userId: actorId,
      action,
      resource: 'user',
      resourceId: targetUserId,
      details,
    });
  }

  /**
   * Log scope events
   */
  async logScope(
    action: AuditAction,
    userId: string,
    scopeId: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource: 'scope',
      resourceId: scopeId,
      details,
    });
  }

  /**
   * Query audit logs
   */
  async query(params: {
    userId?: string;
    action?: AuditAction;
    resource?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};

    if (params.userId) where.userId = params.userId;
    if (params.action) where.action = params.action;
    if (params.resource) where.resource = params.resource;
    if (params.resourceId) where.resourceId = params.resourceId;

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) (where.createdAt as Record<string, Date>).gte = params.startDate;
      if (params.endDate) (where.createdAt as Record<string, Date>).lte = params.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: params.limit ?? 50,
        skip: params.offset ?? 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }
}
