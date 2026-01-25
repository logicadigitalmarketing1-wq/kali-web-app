import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { ROLES_KEY, PERMISSIONS_KEY, SKIP_2FA_KEY } from './auth.guard';

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});

export const CurrentSession = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.sessionToken;
});

export const UserId = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.userId;
});

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const Skip2FA = () => SetMetadata(SKIP_2FA_KEY, true);
