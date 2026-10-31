import { HttpStatus, ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppError, BigIntInterceptor, ErrorFilter } from './common';

/** Applies the global prefix, validation, error shape and serialization. Shared by main.ts and tests. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new AppError(
          'VALIDATION_FAILED',
          errors.flatMap((e) => Object.values(e.constraints ?? {})).join('; '),
          HttpStatus.BAD_REQUEST,
        ),
    }),
  );
  app.useGlobalFilters(new ErrorFilter());
  app.useGlobalInterceptors(new BigIntInterceptor());
  return app;
}

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  return configureApp(app);
}

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Expense Tracker API')
    .setVersion(process.env.npm_package_version ?? '0.0.1')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}
