import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Standard: Set Global Prefix for your logic (v1, v2, etc.)
  app.setGlobalPrefix('api/v1');

  // 2. Standard: Data Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // 3. Enable CORS for House Padi frontend apps
  app.enableCors();

  // 4. Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('House Padi API')
    .setDescription('Core Property Management Engine')
    .setVersion('1.0')
    .addBearerAuth() // For JWT security later
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // 5. THE FIX: Set the path specifically to 'api/docs'
  // This will be accessible at http://localhost:3000/api/docs
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3000);
  console.log(`🚀 API running on http://localhost:3000/api/v1`);
  console.log(`📄 Swagger available on http://localhost:3000/api/docs`);
}
void bootstrap();
