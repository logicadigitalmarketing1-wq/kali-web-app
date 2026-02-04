import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const { status, code, message } = this.getErrorDetails(exception);

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        statusCode: status,
      },
    };

    this.logger.warn(
      `Prisma Error [${exception.code}]: ${exception.message}`,
      { meta: exception.meta },
    );

    response.status(status).send(errorResponse);
  }

  private getErrorDetails(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    code: string;
    message: string;
  } {
    switch (exception.code) {
      case 'P2002': {
        // Unique constraint violation
        const target = (exception.meta?.target as string[])?.join(', ') || 'field';
        return {
          status: HttpStatus.CONFLICT,
          code: 'DUPLICATE_ENTRY',
          message: `A record with this ${target} already exists`,
        };
      }

      case 'P2003': {
        // Foreign key constraint violation
        return {
          status: HttpStatus.BAD_REQUEST,
          code: 'FOREIGN_KEY_ERROR',
          message: 'Referenced record does not exist',
        };
      }

      case 'P2025': {
        // Record not found
        return {
          status: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'The requested record was not found',
        };
      }

      case 'P2014': {
        // Required relation violation
        return {
          status: HttpStatus.BAD_REQUEST,
          code: 'RELATION_ERROR',
          message: 'Required relation constraint violated',
        };
      }

      case 'P2016': {
        // Query interpretation error
        return {
          status: HttpStatus.BAD_REQUEST,
          code: 'QUERY_ERROR',
          message: 'Invalid query parameters',
        };
      }

      case 'P2021': {
        // Table does not exist
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'DATABASE_ERROR',
          message: 'Database schema error',
        };
      }

      case 'P2022': {
        // Column does not exist
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'DATABASE_ERROR',
          message: 'Database schema error',
        };
      }

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'DATABASE_ERROR',
          message: 'A database error occurred',
        };
    }
  }
}

@Catch(Prisma.PrismaClientValidationError)
export class PrismaValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaValidationExceptionFilter.name);

  catch(exception: Prisma.PrismaClientValidationError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    this.logger.error('Prisma Validation Error', exception.message);

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid data provided',
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        statusCode: HttpStatus.BAD_REQUEST,
      },
    };

    response.status(HttpStatus.BAD_REQUEST).send(errorResponse);
  }
}
