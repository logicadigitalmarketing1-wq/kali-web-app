import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ScopesService } from './scopes.service';
import { CurrentUser, AuthenticatedUser, Roles } from '../common/decorators';

@Controller('scopes')
export class ScopesController {
  constructor(private readonly scopesService: ScopesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    // Regular users only see their assigned scopes
    // Admins see all scopes
    if (user.role === 'ADMIN') {
      return this.scopesService.findAll();
    }
    return this.scopesService.findAllForUser(user.id);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = await this.scopesService.findById(id);
    if (!scope) {
      throw new NotFoundException('Scope not found');
    }
    return scope;
  }

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body()
    body: {
      name: string;
      description?: string;
      cidrs: string[];
      hosts: string[];
    },
  ) {
    return this.scopesService.create(body);
  }

  @Put(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      cidrs?: string[];
      hosts?: string[];
      isActive?: boolean;
    },
  ) {
    const scope = await this.scopesService.findById(id);
    if (!scope) {
      throw new NotFoundException('Scope not found');
    }
    return this.scopesService.update(id, body);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    const scope = await this.scopesService.findById(id);
    if (!scope) {
      throw new NotFoundException('Scope not found');
    }
    await this.scopesService.delete(id);
  }

  @Post(':id/users/:userId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async assignToUser(
    @Param('id') scopeId: string,
    @Param('userId') userId: string,
  ) {
    return this.scopesService.assignToUser(userId, scopeId);
  }

  @Delete(':id/users/:userId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFromUser(
    @Param('id') scopeId: string,
    @Param('userId') userId: string,
  ) {
    await this.scopesService.removeFromUser(userId, scopeId);
  }
}
