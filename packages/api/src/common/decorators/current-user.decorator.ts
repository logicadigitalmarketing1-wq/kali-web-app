import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: 'ADMIN' | 'ENGINEER' | 'VIEWER';
  totpEnabled: boolean;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): AuthenticatedUser | unknown => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as any).user as AuthenticatedUser;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
