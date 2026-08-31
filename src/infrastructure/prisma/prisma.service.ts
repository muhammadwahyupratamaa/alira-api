import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  readonly databaseSchema: string;

  constructor(configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>('DATABASE_URL');
    const schema = new URL(connectionString).searchParams.get('schema');
    const adapter = new PrismaPg(
      { connectionString },
      schema ? { schema } : undefined,
    );
    super({ adapter });
    this.databaseSchema =
      schema && /^[A-Za-z_][A-Za-z0-9_]*$/.test(schema) ? schema : 'public';
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
