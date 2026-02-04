import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { CurrentUser, AuthenticatedUser, Roles } from '../common/decorators';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('ADMIN')
  async findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserDto) {
    try {
      return await this.usersService.create(dto);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('A user with this email already exists');
      }
      throw error;
    }
  }

  @Get(':id')
  @Roles('ADMIN')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Put(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() body: { role?: Role; isActive?: boolean },
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent admin from demoting themselves
    if (id === currentUser.id && body.role && body.role !== 'ADMIN') {
      throw new ForbiddenException('Cannot demote yourself');
    }

    // Prevent admin from deactivating themselves
    if (id === currentUser.id && body.isActive === false) {
      throw new ForbiddenException('Cannot deactivate yourself');
    }

    return this.usersService.update(id, body);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent admin from deleting themselves
    if (id === currentUser.id) {
      throw new ForbiddenException('Cannot delete yourself');
    }

    await this.usersService.delete(id);
  }
}
