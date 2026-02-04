import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = (request as FastifyRequest & { cookies?: Record<string, string> }).cookies?.session;

    if (!token) {
      throw new UnauthorizedException('Session token required');
    }

    const session = await this.prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            totpSecret: true,
          },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      throw new UnauthorizedException('Session expired');
    }

    if (!session.user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Attach user to request
    const authenticatedUser: AuthenticatedUser = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      totpEnabled: !!session.user.totpSecret,
    };

    (request as any).user = authenticatedUser;
    (request as any).sessionId = session.id;

    return true;
  }
}
