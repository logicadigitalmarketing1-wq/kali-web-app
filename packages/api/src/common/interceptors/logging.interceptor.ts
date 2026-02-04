import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();

    const requestId = randomUUID();
    const startTime = Date.now();
    const { method, url, ip } = request;
    const userAgent = request.headers['user-agent'] || 'unknown';
    const userId = (request as any).user?.id || 'anonymous';

    // Attach request ID for correlation
    (request as any).requestId = requestId;

    this.logger.log(
      `[${requestId}] --> ${method} ${url} - User: ${userId} - IP: ${ip}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          this.logger.log(
            `[${requestId}] <-- ${method} ${url} ${statusCode} - ${duration}ms`,
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          this.logger.warn(
            `[${requestId}] <-- ${method} ${url} ${statusCode} - ${duration}ms - ${error.message}`,
          );
        },
      }),
    );
  }
}
