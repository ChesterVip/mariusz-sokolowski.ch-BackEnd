import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const configuredOrigins = (configService.get<string>('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const fallbackOrigins = Array.from(
    new Set([
      'https://mariusz-sokolowski.ch',
      'http://localhost:5173',
      'http://localhost:5173/',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5173/',
    ]),
  );

  const whitelistedOrigins = configuredOrigins.length > 0 ? configuredOrigins : fallbackOrigins;

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        return callback(null, true);
      }

      if (whitelistedOrigins.includes(origin)) {
        return callback(null, true);
      }

      logger.warn(`Blocked CORS request from origin: ${origin}`);
      return callback(new Error('Origin not allowed'), false);
    },
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: true,
    }),
  );

  const enableSwagger = configService.get<string>('ENABLE_SWAGGER', 'true') !== 'false';
  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('mariusz-sokolowski.ch API')
      .setDescription('Dokumentacja API backendu')
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Wprowadź token JWT uzyskany po weryfikacji kodu logowania.'
        },
        'bearer'
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
    logger.log('Swagger UI dostępny pod /docs');
  }

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  logger.log(`Backend uruchomiony na porcie ${port}`);
}

bootstrap();
