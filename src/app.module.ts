import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SocketService } from './socket';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, SocketService],
})
export class AppModule {}
