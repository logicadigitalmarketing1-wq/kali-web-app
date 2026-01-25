import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ToolManifestSchema, validateManifest } from '@securescope/tool-schemas';
import { z } from 'zod';

@Injectable()
export class ToolsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(categoryId?: string) {
    const where = categoryId ? { categoryId } : {};

    const tools = await this.prisma.tool.findMany({
      where: { ...where, isEnabled: true },
      include: {
        category: true,
        currentVersion: true,
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { displayName: 'asc' }],
    });

    return tools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      displayName: tool.displayName,
      description: tool.description,
      category: {
        id: tool.category.id,
        name: tool.category.name,
        displayName: tool.category.displayName,
      },
      riskLevel: tool.riskLevel.toLowerCase(),
      isEnabled: tool.isEnabled,
    }));
  }

  async findCategories() {
    const categories = await this.prisma.toolCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { tools: { where: { isEnabled: true } } },
        },
      },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      displayName: cat.displayName,
      description: cat.description,
      icon: cat.icon,
      toolCount: cat._count.tools,
    }));
  }

  async findOne(id: string) {
    const tool = await this.prisma.tool.findUnique({
      where: { id },
      include: {
        category: true,
        currentVersion: true,
      },
    });

    if (!tool) {
      throw new NotFoundException('Tool not found');
    }

    const manifest = tool.currentVersion?.manifest as z.infer<typeof ToolManifestSchema> | null;

    return {
      id: tool.id,
      name: tool.name,
      displayName: tool.displayName,
      description: tool.description,
      category: {
        id: tool.category.id,
        name: tool.category.name,
        displayName: tool.category.displayName,
      },
      riskLevel: tool.riskLevel.toLowerCase(),
      isEnabled: tool.isEnabled,
      prerequisites: tool.prerequisites,
      safeUsageNotes: tool.safeUsageNotes,
      exampleCommands: tool.exampleCommands,
      manifest: manifest
        ? {
            argsSchema: manifest.argsSchema,
            timeout: manifest.timeout,
            riskLevel: manifest.riskLevel,
            references: manifest.references,
          }
        : null,
    };
  }

  async findByName(name: string) {
    const tool = await this.prisma.tool.findUnique({
      where: { name },
      include: {
        category: true,
        currentVersion: true,
      },
    });

    if (!tool) {
      throw new NotFoundException('Tool not found');
    }

    return tool;
  }

  async getManifest(toolId: string): Promise<z.infer<typeof ToolManifestSchema>> {
    const tool = await this.prisma.tool.findUnique({
      where: { id: toolId },
      include: { currentVersion: true },
    });

    if (!tool || !tool.currentVersion) {
      throw new NotFoundException('Tool or manifest not found');
    }

    return validateManifest(tool.currentVersion.manifest);
  }

  async createTool(data: {
    name: string;
    displayName: string;
    description: string;
    categoryId: string;
    manifest: unknown;
    createdBy: string;
  }) {
    // Validate manifest
    const validatedManifest = validateManifest(data.manifest);

    // Check category exists
    const category = await this.prisma.toolCategory.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) {
      throw new BadRequestException('Invalid category');
    }

    // Check name is unique
    const existing = await this.prisma.tool.findUnique({
      where: { name: data.name },
    });
    if (existing) {
      throw new BadRequestException('Tool name already exists');
    }

    // Create tool with initial manifest version
    const tool = await this.prisma.tool.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        categoryId: data.categoryId,
        riskLevel: validatedManifest.riskLevel.toUpperCase() as any,
        prerequisites: validatedManifest.prerequisites?.join('\n'),
        safeUsageNotes: validatedManifest.safeUsageNotes?.join('\n'),
        exampleCommands: validatedManifest.exampleCommands,
      },
    });

    // Create manifest version
    const version = await this.prisma.toolManifestVersion.create({
      data: {
        toolId: tool.id,
        version: 1,
        manifest: validatedManifest,
        changelog: 'Initial version',
        createdBy: data.createdBy,
      },
    });

    // Set as current version
    await this.prisma.tool.update({
      where: { id: tool.id },
      data: { currentVersionId: version.id },
    });

    return tool;
  }

  async updateManifest(
    toolId: string,
    manifest: unknown,
    changelog: string,
    updatedBy: string,
  ) {
    const tool = await this.prisma.tool.findUnique({
      where: { id: toolId },
      include: { currentVersion: true },
    });

    if (!tool) {
      throw new NotFoundException('Tool not found');
    }

    // Validate manifest
    const validatedManifest = validateManifest(manifest);

    // Get next version number
    const lastVersion = await this.prisma.toolManifestVersion.findFirst({
      where: { toolId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (lastVersion?.version ?? 0) + 1;

    // Create new version
    const version = await this.prisma.toolManifestVersion.create({
      data: {
        toolId,
        version: nextVersion,
        manifest: validatedManifest,
        changelog,
        createdBy: updatedBy,
      },
    });

    // Update tool with new version
    await this.prisma.tool.update({
      where: { id: toolId },
      data: {
        currentVersionId: version.id,
        riskLevel: validatedManifest.riskLevel.toUpperCase() as any,
        prerequisites: validatedManifest.prerequisites?.join('\n'),
        safeUsageNotes: validatedManifest.safeUsageNotes?.join('\n'),
        exampleCommands: validatedManifest.exampleCommands,
      },
    });

    return version;
  }

  async toggleEnabled(toolId: string, enabled: boolean) {
    return this.prisma.tool.update({
      where: { id: toolId },
      data: { isEnabled: enabled },
    });
  }
}
