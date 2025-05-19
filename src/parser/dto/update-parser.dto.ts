import { PartialType } from '@nestjs/mapped-types';
import { CreateParserDto } from './create-parser.dto';

export class UpdateParserDto extends PartialType(CreateParserDto) {}
