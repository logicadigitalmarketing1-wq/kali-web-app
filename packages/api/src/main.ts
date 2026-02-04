import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookie from '@fastify/cookie';
import { AppModule } from './app.module';

async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter({
    logger: true,
  });

  // Register Fastify cookie plugin on the underlying Fastify instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (fastifyAdapter.getInstance() as any).register(cookie, {
    secret: process.env.SESSION_SECRET || 'hexstrike-dev-secret',
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('API_PORT', 4000);
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  });

  // API prefix
  app.setGlobalPrefix('api');

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 HexStrike API running on http://localhost:${port}`);
}

bootstrap();
