import { Controller, Get } from '@nestjs/common';
import { New, ParserService } from './parser.service';

@Controller('parser')
export class ParserController {
  constructor(private readonly parserService: ParserService) {}

  @Get()
  async getAllNews(): Promise<New[]> {
    return await this.parserService.getAllNews();
  }
}
