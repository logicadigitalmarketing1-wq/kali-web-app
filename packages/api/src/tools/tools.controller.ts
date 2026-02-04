import {
  Controller,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ToolsService } from './tools.service';

// Tools endpoints require authentication (session guard applied globally)
// Users need to be authenticated to see available tools
@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll() {
    return this.toolsService.findAll();
  }

  @Get('categories')
  @HttpCode(HttpStatus.OK)
  async getCategories() {
    return this.toolsService.getCategories();
  }

  @Get(':slug')
  @HttpCode(HttpStatus.OK)
  async findBySlug(@Param('slug') slug: string) {
    const tool = await this.toolsService.findBySlug(slug);

    if (!tool) {
      throw new NotFoundException(`Tool "${slug}" not found`);
    }

    return tool;
  }
}
