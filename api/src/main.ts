import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
async function bootstrap(){
  const app=await NestFactory.create(AppModule,{logger:['log','warn','error'],rawBody:true});
  app.use(helmet());app.enableCors({origin:process.env.WEB_ORIGIN?.split(',')??true,credentials:true});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));
  const config=new DocumentBuilder().setTitle('IdeaBid API').setDescription('Idea discovery, upvotes and paid conviction platform').setVersion('1.0').addBearerAuth().build();
  SwaggerModule.setup('docs',app,SwaggerModule.createDocument(app,config));await app.listen(process.env.PORT??4000);
} bootstrap();
