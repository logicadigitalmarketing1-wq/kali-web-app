import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ToolsService } from './tools.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles, Permissions, CurrentUser } from '../auth/decorators';

@ApiTags('tools')
@Controller('tools')
@UseGuards(AuthGuard)
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get()
  @ApiOperation({ summary: 'List all enabled tools' })
  @ApiQuery({ name: 'category', required: false })
  async findAll(@Query('category') categoryId?: string) {
    return this.toolsService.findAll(categoryId);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List tool categories' })
  async findCategories() {
    return this.toolsService.findCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tool details' })
  async findOne(@Param('id') id: string) {
    return this.toolsService.findOne(id);
  }

  @Get(':id/manifest')
  @ApiOperation({ summary: 'Get tool manifest' })
  @Permissions('tools:read')
  async getManifest(@Param('id') id: string) {
    return this.toolsService.getManifest(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new tool' })
  @Roles('admin')
  async create(
    @CurrentUser() user: any,
    @Body()
    body: {
      name: string;
      displayName: string;
      description: string;
      categoryId: string;
      manifest: unknown;
    },
  ) {
    return this.toolsService.createTool({
      ...body,
      createdBy: user.id,
    });
  }

  @Put(':id/manifest')
  @ApiOperation({ summary: 'Update tool manifest' })
  @Roles('admin')
  async updateManifest(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { manifest: unknown; changelog: string },
  ) {
    return this.toolsService.updateManifest(id, body.manifest, body.changelog, user.id);
  }

  @Put(':id/toggle')
  @ApiOperation({ summary: 'Enable/disable tool' })
  @Roles('admin')
  async toggle(@Param('id') id: string, @Body('enabled') enabled: boolean) {
    return this.toolsService.toggleEnabled(id, enabled);
  }
}
