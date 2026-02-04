import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    timestamp: string;
    path: string;
    method: string;
    statusCode: number;
  };
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message: string;
    let details: string[] | undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      const responseObj = exceptionResponse as Record<string, unknown>;
      message = (responseObj.message as string) || exception.message;

      // Handle validation errors from class-validator
      if (Array.isArray(responseObj.message)) {
        message = 'Validation failed';
        details = responseObj.message as string[];
      }
    } else {
      message = exception.message;
    }

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: this.getErrorCode(status),
        message,
        ...(details && { details }),
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        statusCode: status,
      },
    };

    // Log error for server errors (5xx)
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status} - ${message}`,
        exception.stack,
      );
    } else if (status >= 400) {
      const detailsStr = details ? ` | Details: ${JSON.stringify(details)}` : '';
      this.logger.warn(`${request.method} ${request.url} ${status} - ${message}${detailsStr}`);
    }

    response.status(status).send(errorResponse);
  }

  private getErrorCode(status: number): string {
    const codes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
      [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
      [HttpStatus.BAD_GATEWAY]: 'BAD_GATEWAY',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
    };

    return codes[status] || 'UNKNOWN_ERROR';
  }
}
