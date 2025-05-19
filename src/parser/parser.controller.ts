import { Controller, Get } from '@nestjs/common';
import { New, ParserService } from './parser.service';

@Controller('parser')
export class ParserController {
  constructor(private readonly parserService: ParserService) {}

  @Get()
  getAllNews(): New[] {
    return this.parserService.getAllNews();
  }
}
