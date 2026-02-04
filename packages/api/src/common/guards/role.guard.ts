import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Role } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles specified, allow access (must still pass SessionGuard)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Role hierarchy: ADMIN > ENGINEER > VIEWER
    const roleHierarchy: Record<Role, number> = {
      ADMIN: 3,
      ENGINEER: 2,
      VIEWER: 1,
    };

    const userRoleLevel = roleHierarchy[user.role];
    const hasRequiredRole = requiredRoles.some(
      (role) => userRoleLevel >= roleHierarchy[role],
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `Access denied. Required role: ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }
}
