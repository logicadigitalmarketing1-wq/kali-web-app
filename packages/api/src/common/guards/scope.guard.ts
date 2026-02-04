import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    const body = request.body;

    // Admin has access to all scopes
    if (user.role === 'ADMIN') {
      return true;
    }

    // Get scopeId and target from request body
    const scopeId = body?.scopeId;
    const target = body?.target;

    if (!scopeId) {
      // If no scopeId in request, this guard is not applicable
      return true;
    }

    // Check if user has access to this scope
    const userScope = await this.prisma.userScope.findUnique({
      where: {
        userId_scopeId: {
          userId: user.id,
          scopeId: scopeId,
        },
      },
      include: {
        scope: true,
      },
    });

    if (!userScope) {
      throw new ForbiddenException('You do not have access to this scope');
    }

    if (!userScope.scope.isActive) {
      throw new ForbiddenException('This scope is not active');
    }

    // If target is provided, validate it against scope
    if (target) {
      const isValidTarget = this.validateTargetAgainstScope(
        target,
        userScope.scope.cidrs,
        userScope.scope.hosts,
      );

      if (!isValidTarget) {
        throw new ForbiddenException(
          `Target "${target}" is not within the authorized scope`,
        );
      }
    }

    return true;
  }

  private validateTargetAgainstScope(
    target: string,
    cidrs: string[],
    hosts: string[],
  ): boolean {
    const normalizedTarget = target.toLowerCase().trim();

    // Check host patterns
    for (const host of hosts) {
      if (this.matchHostPattern(normalizedTarget, host.toLowerCase())) {
        return true;
      }
    }

    // Check if target is an IP and matches any CIDR
    const ip = this.parseIP(normalizedTarget);
    if (ip) {
      for (const cidr of cidrs) {
        if (this.ipInCidr(ip, cidr)) {
          return true;
        }
      }
    }

    return false;
  }

  private matchHostPattern(target: string, pattern: string): boolean {
    // Exact match
    if (target === pattern) {
      return true;
    }

    // Wildcard match (*.example.com)
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1); // ".example.com"
      return target.endsWith(suffix) || target === pattern.slice(2);
    }

    return false;
  }

  private parseIP(str: string): number[] | null {
    const parts = str.split('.');
    if (parts.length !== 4) {
      return null;
    }

    const nums = parts.map((p) => parseInt(p, 10));
    if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) {
      return null;
    }

    return nums;
  }

  private ipInCidr(ip: number[], cidr: string): boolean {
    const [cidrIp, maskStr] = cidr.split('/');
    const cidrParts = this.parseIP(cidrIp);
    if (!cidrParts) {
      return false;
    }

    const mask = parseInt(maskStr, 10);
    if (isNaN(mask) || mask < 0 || mask > 32) {
      return false;
    }

    // Convert to 32-bit integers
    const ipNum = (ip[0] << 24) | (ip[1] << 16) | (ip[2] << 8) | ip[3];
    const cidrNum =
      (cidrParts[0] << 24) |
      (cidrParts[1] << 16) |
      (cidrParts[2] << 8) |
      cidrParts[3];

    // Create mask
    const maskBits = mask === 0 ? 0 : ~((1 << (32 - mask)) - 1);

    return (ipNum & maskBits) === (cidrNum & maskBits);
  }
}
