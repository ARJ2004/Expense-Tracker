import './instrument';
import 'reflect-metadata';
import { SwaggerModule } from '@nestjs/swagger';
import { buildOpenApi, createApp } from './app.factory';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('v1/docs', app, buildOpenApi(app), { jsonDocumentUrl: 'v1/openapi.json' });
  }
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000));
}

void bootstrap();
