import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles, UserId } from '../auth/decorators';

@ApiTags('admin')
@Controller('admin')
@UseGuards(AuthGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ===== Users =====
  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async getUsers(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.adminService.getUsers(
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }

  @Post('users')
  @ApiOperation({ summary: 'Create a new user' })
  async createUser(
    @UserId() userId: string,
    @Body() body: {
      email: string;
      username: string;
      password: string;
      role: string;
    },
  ) {
    return this.adminService.createUser({
      email: body.email,
      username: body.username,
      password: body.password,
      roleName: body.role,
      createdBy: userId,
    });
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update a user' })
  async updateUser(
    @Param('id') id: string,
    @UserId() userId: string,
    @Body() body: { isActive?: boolean; roleId?: string },
  ) {
    return this.adminService.updateUser(id, body, userId);
  }

  @Post('users/:id/unlock')
  @ApiOperation({ summary: 'Unlock a locked user account' })
  async unlockUser(@Param('id') id: string, @UserId() userId: string) {
    return this.adminService.unlockUser(id, userId);
  }

  // ===== Scopes =====
  @Get('scopes')
  @ApiOperation({ summary: 'List all scopes' })
  async getScopes() {
    return this.adminService.getScopes();
  }

  @Post('scopes')
  @ApiOperation({ summary: 'Create a new scope' })
  async createScope(
    @UserId() userId: string,
    @Body() body: {
      name: string;
      displayName: string;
      description?: string;
      allowedHosts: string[];
      allowedCidrs: string[];
    },
  ) {
    return this.adminService.createScope({
      ...body,
      createdBy: userId,
    });
  }

  @Put('scopes/:id')
  @ApiOperation({ summary: 'Update a scope' })
  async updateScope(
    @Param('id') id: string,
    @UserId() userId: string,
    @Body() body: {
      displayName?: string;
      description?: string;
      allowedHosts?: string[];
      allowedCidrs?: string[];
      isActive?: boolean;
    },
  ) {
    return this.adminService.updateScope(id, body, userId);
  }

  @Post('users/:userId/scopes/:scopeId')
  @ApiOperation({ summary: 'Assign scope to user' })
  async assignScope(
    @Param('userId') targetUserId: string,
    @Param('scopeId') scopeId: string,
    @UserId() userId: string,
  ) {
    return this.adminService.assignScopeToUser(targetUserId, scopeId, userId);
  }

  @Delete('users/:userId/scopes/:scopeId')
  @ApiOperation({ summary: 'Remove scope from user' })
  async removeScope(
    @Param('userId') targetUserId: string,
    @Param('scopeId') scopeId: string,
    @UserId() userId: string,
  ) {
    return this.adminService.removeScopeFromUser(targetUserId, scopeId, userId);
  }

  // ===== Audit Logs =====
  @Get('audit')
  @ApiOperation({ summary: 'Get audit logs' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'resource', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async getAuditLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.adminService.getAuditLogs({
      userId,
      action,
      resource,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  // ===== Roles =====
  @Get('roles')
  @ApiOperation({ summary: 'List all roles' })
  async getRoles() {
    return this.adminService.getRoles();
  }
}
