import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ParserController } from './parser.controller';
import { ParserService } from './parser.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [ParserController],
  providers: [ParserService],
})
export class ParserModule {}
