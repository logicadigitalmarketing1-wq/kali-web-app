import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from './auth.service';

export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';
export const SKIP_2FA_KEY = 'skip2fa';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Get session token from cookie
    const sessionToken = request.cookies?.session;
    if (!sessionToken) {
      throw new UnauthorizedException('Authentication required');
    }

    // Validate session
    const session = await this.authService.validateSession(sessionToken);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Check 2FA requirement
    const skip2fa = this.reflector.get<boolean>(SKIP_2FA_KEY, context.getHandler());
    if (!skip2fa && session.user.role.name !== 'viewer') {
      // For non-viewers, check if 2FA is verified
      const user = session.user as any;
      if (user.totpEnabled && !session.totpVerified) {
        throw new ForbiddenException('2FA verification required');
      }
    }

    // Check role requirements
    const requiredRoles = this.reflector.get<string[]>(ROLES_KEY, context.getHandler());
    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(session.user.role.name)) {
        throw new ForbiddenException('Insufficient role');
      }
    }

    // Check permission requirements
    const requiredPermissions = this.reflector.get<string[]>(
      PERMISSIONS_KEY,
      context.getHandler(),
    );
    if (requiredPermissions && requiredPermissions.length > 0) {
      const userPermissions = session.user.role.permissions as string[];
      const hasPermission = requiredPermissions.every((perm) =>
        userPermissions.includes(perm),
      );
      if (!hasPermission) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    // Attach user to request
    (request as any).user = session.user;
    (request as any).userId = session.userId;
    (request as any).sessionToken = sessionToken;

    return true;
  }
}
