import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
  meta: {
    timestamp: string;
    path: string;
    method: string;
    statusCode: number;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const status = HttpStatus.INTERNAL_SERVER_ERROR;

    // Log the full error
    this.logger.error(
      `Unhandled Exception: ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : exception instanceof Error
              ? exception.message
              : 'An unexpected error occurred',
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        statusCode: status,
      },
    };

    response.status(status).send(errorResponse);
  }
}
