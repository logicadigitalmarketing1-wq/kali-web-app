import { Module, Global } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { SessionGuard } from './guards/session.guard';
import { RoleGuard } from './guards/role.guard';
import {
  HttpExceptionFilter,
  PrismaExceptionFilter,
  PrismaValidationExceptionFilter,
  AllExceptionsFilter,
} from './filters';
import {
  LoggingInterceptor,
  TransformInterceptor,
  TimeoutInterceptor,
} from './interceptors';
import { AuditService } from './services/audit.service';

@Global()
@Module({
  providers: [
    // Services
    AuditService,

    // Global Guards (order matters: Session -> Role)
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RoleGuard,
    },

    // Global Exception Filters (order: specific -> generic)
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: PrismaValidationExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },

    // Global Interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useFactory: () => new TimeoutInterceptor(30000),
    },
  ],
  exports: [AuditService],
})
export class CommonModule {}
