import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log: ['warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'production') {
      const models = Reflect.ownKeys(this).filter(
        (key) => typeof key === 'string' && !key.startsWith('_') && !key.startsWith('$'),
      );

      for (const model of models) {
        try {
          await (this as any)[model]?.deleteMany?.();
        } catch {
          // Ignore errors for non-model properties
        }
      }
    }
  }
}
