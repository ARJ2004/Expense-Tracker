import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AccountsModule } from './accounts';
import { AuthModule } from './auth';
import { CategoriesModule } from './categories';
import { CommonModule } from './common';
import { DashboardModule } from './dashboard';
import { validateConfig } from './config/app-config';
import { HealthModule } from './health/health.module';
import { ImportsModule } from './imports';
import { TransactionsModule } from './transactions';
import { UsersModule } from './users';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateConfig }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
        // Never log bodies, SMS text, narrations or tokens: only route, status and latency.
        serializers: {
          req: (req: { id: string; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
          res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
        },
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    // Modules react to each other through typed domain events (transaction.created, import.confirmed).
    EventEmitterModule.forRoot(),
    CommonModule,
    HealthModule,
    UsersModule,
    AuthModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    ImportsModule,
    DashboardModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
