import { PrismaClient, RiskLevel } from '@prisma/client';
import * as argon2 from 'argon2';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

async function main() {
  console.log('🌱 Starting database seed...');

  // ============================================================================
  // Roles
  // ============================================================================
  console.log('Creating roles...');

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      displayName: 'Administrator',
      description: 'Full system access including user management and tool configuration',
      permissions: [
        'users:read',
        'users:write',
        'users:delete',
        'roles:read',
        'roles:write',
        'scopes:read',
        'scopes:write',
        'scopes:delete',
        'tools:read',
        'tools:write',
        'tools:delete',
        'runs:read',
        'runs:write',
        'runs:delete',
        'findings:read',
        'findings:write',
        'findings:delete',
        'chat:read',
        'chat:write',
        'audit:read',
        'system:config',
      ],
    },
  });

  const engineerRole = await prisma.role.upsert({
    where: { name: 'engineer' },
    update: {},
    create: {
      name: 'engineer',
      displayName: 'Security Engineer',
      description: 'Run tools within assigned scopes and manage findings',
      permissions: [
        'tools:read',
        'runs:read',
        'runs:write',
        'findings:read',
        'findings:write',
        'chat:read',
        'chat:write',
        'scopes:read',
      ],
    },
  });

  const viewerRole = await prisma.role.upsert({
    where: { name: 'viewer' },
    update: {},
    create: {
      name: 'viewer',
      displayName: 'Viewer',
      description: 'Read-only access to runs and findings',
      permissions: ['tools:read', 'runs:read', 'findings:read', 'scopes:read'],
    },
  });

  console.log(`  Created roles: admin, engineer, viewer`);

  // ============================================================================
  // Admin User
  // ============================================================================
  console.log('Creating admin user...');

  const adminPassword = process.env.ADMIN_PASSWORD || 'SecureScope2024!';
  const adminPasswordHash = await argon2.hash(adminPassword, ARGON2_OPTIONS);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@securescope.local' },
    update: {},
    create: {
      email: 'admin@securescope.local',
      username: 'admin',
      passwordHash: adminPasswordHash,
      roleId: adminRole.id,
      isActive: true,
    },
  });

  console.log(`  Created admin user: admin@securescope.local`);
  console.log(`  Default password: ${adminPassword}`);

  // ============================================================================
  // Demo Engineer User
  // ============================================================================
  console.log('Creating demo engineer user...');

  const engineerPassword = 'Engineer2024!';
  const engineerPasswordHash = await argon2.hash(engineerPassword, ARGON2_OPTIONS);

  const engineerUser = await prisma.user.upsert({
    where: { email: 'engineer@securescope.local' },
    update: {},
    create: {
      email: 'engineer@securescope.local',
      username: 'engineer',
      passwordHash: engineerPasswordHash,
      roleId: engineerRole.id,
      isActive: true,
    },
  });

  console.log(`  Created engineer user: engineer@securescope.local`);

  // ============================================================================
  // Default Scopes
  // ============================================================================
  console.log('Creating scopes...');

  const localhostScope = await prisma.scope.upsert({
    where: { name: 'localhost' },
    update: {},
    create: {
      name: 'localhost',
      displayName: 'Localhost',
      description: 'Local machine only - for testing',
      allowedHosts: ['localhost', '127.0.0.1'],
      allowedCidrs: ['127.0.0.0/8'],
      isDefault: true,
      isActive: true,
    },
  });

  const internalScope = await prisma.scope.upsert({
    where: { name: 'internal' },
    update: {},
    create: {
      name: 'internal',
      displayName: 'Internal Network',
      description: 'RFC1918 private networks',
      allowedHosts: [],
      allowedCidrs: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
      isDefault: false,
      isActive: true,
    },
  });

  const demoScope = await prisma.scope.upsert({
    where: { name: 'demo' },
    update: {},
    create: {
      name: 'demo',
      displayName: 'Demo Targets',
      description: 'Safe demo targets for testing (scanme.nmap.org, etc.)',
      allowedHosts: ['scanme.nmap.org', 'example.com', 'httpbin.org'],
      allowedCidrs: [],
      isDefault: false,
      isActive: true,
    },
  });

  console.log(`  Created scopes: localhost, internal, demo`);

  // Assign scopes to users
  await prisma.userScope.upsert({
    where: { userId_scopeId: { userId: adminUser.id, scopeId: localhostScope.id } },
    update: {},
    create: { userId: adminUser.id, scopeId: localhostScope.id, assignedBy: 'system' },
  });

  await prisma.userScope.upsert({
    where: { userId_scopeId: { userId: adminUser.id, scopeId: internalScope.id } },
    update: {},
    create: { userId: adminUser.id, scopeId: internalScope.id, assignedBy: 'system' },
  });

  await prisma.userScope.upsert({
    where: { userId_scopeId: { userId: adminUser.id, scopeId: demoScope.id } },
    update: {},
    create: { userId: adminUser.id, scopeId: demoScope.id, assignedBy: 'system' },
  });

  await prisma.userScope.upsert({
    where: { userId_scopeId: { userId: engineerUser.id, scopeId: localhostScope.id } },
    update: {},
    create: { userId: engineerUser.id, scopeId: localhostScope.id, assignedBy: 'system' },
  });

  await prisma.userScope.upsert({
    where: { userId_scopeId: { userId: engineerUser.id, scopeId: demoScope.id } },
    update: {},
    create: { userId: engineerUser.id, scopeId: demoScope.id, assignedBy: 'system' },
  });

  console.log(`  Assigned scopes to users`);

  // ============================================================================
  // Tool Categories
  // ============================================================================
  console.log('Creating tool categories...');

  const categories = [
    { name: 'network-diagnostics', displayName: 'Network Diagnostics', description: 'Network scanning and diagnostics tools', icon: 'network', sortOrder: 1 },
    { name: 'tls-http', displayName: 'TLS/HTTP', description: 'TLS, SSL, and HTTP analysis tools', icon: 'lock', sortOrder: 2 },
    { name: 'dns', displayName: 'DNS', description: 'DNS lookup and analysis tools', icon: 'globe', sortOrder: 3 },
    { name: 'inventory', displayName: 'Asset Inventory', description: 'Asset discovery and inventory tools', icon: 'list', sortOrder: 4 },
    { name: 'compliance', displayName: 'Compliance', description: 'Compliance checking and validation tools', icon: 'clipboard-check', sortOrder: 5 },
    { name: 'log-analysis', displayName: 'Log/Config Analysis', description: 'Log file and configuration analysis tools', icon: 'file-text', sortOrder: 6 },
  ];

  const categoryMap: Record<string, string> = {};

  for (const cat of categories) {
    const created = await prisma.toolCategory.upsert({
      where: { name: cat.name },
      update: { displayName: cat.displayName, description: cat.description, icon: cat.icon, sortOrder: cat.sortOrder },
      create: cat,
    });
    categoryMap[cat.name] = created.id;
  }

  console.log(`  Created ${categories.length} categories`);

  // ============================================================================
  // Tools from Manifests
  // ============================================================================
  console.log('Loading tool manifests...');

  const manifestsDir = path.join(__dirname, '../../../tools/manifests');
  const manifestFiles = fs.readdirSync(manifestsDir).filter((f) => f.endsWith('.json'));

  for (const file of manifestFiles) {
    const manifestPath = path.join(manifestsDir, file);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    const categoryId = categoryMap[manifest.category];
    if (!categoryId) {
      console.warn(`  Warning: Unknown category ${manifest.category} for tool ${manifest.name}`);
      continue;
    }

    const riskLevelMap: Record<string, RiskLevel> = {
      info: RiskLevel.INFO,
      low: RiskLevel.LOW,
      medium: RiskLevel.MEDIUM,
      high: RiskLevel.HIGH,
      critical: RiskLevel.CRITICAL,
    };

    const tool = await prisma.tool.upsert({
      where: { name: manifest.name },
      update: {
        displayName: manifest.displayName,
        description: manifest.description,
        riskLevel: riskLevelMap[manifest.riskLevel] || RiskLevel.LOW,
        prerequisites: manifest.prerequisites?.join('\n'),
        safeUsageNotes: manifest.safeUsageNotes?.join('\n'),
        exampleCommands: manifest.exampleCommands,
      },
      create: {
        name: manifest.name,
        displayName: manifest.displayName,
        description: manifest.description,
        categoryId,
        riskLevel: riskLevelMap[manifest.riskLevel] || RiskLevel.LOW,
        isEnabled: true,
        prerequisites: manifest.prerequisites?.join('\n'),
        safeUsageNotes: manifest.safeUsageNotes?.join('\n'),
        exampleCommands: manifest.exampleCommands,
      },
    });

    // Create manifest version
    const existingVersions = await prisma.toolManifestVersion.count({
      where: { toolId: tool.id },
    });

    const newVersion = await prisma.toolManifestVersion.create({
      data: {
        toolId: tool.id,
        version: existingVersions + 1,
        manifest,
        changelog: existingVersions === 0 ? 'Initial version' : 'Updated manifest',
        createdBy: 'system',
      },
    });

    // Set as current version
    await prisma.tool.update({
      where: { id: tool.id },
      data: { currentVersionId: newVersion.id },
    });

    console.log(`  Loaded tool: ${manifest.name} (v${existingVersions + 1})`);
  }

  // ============================================================================
  // System Configuration
  // ============================================================================
  console.log('Setting system configuration...');

  const configs = [
    {
      key: 'auth.session_timeout_minutes',
      value: 60,
      description: 'Session timeout in minutes',
    },
    {
      key: 'auth.max_failed_attempts',
      value: 5,
      description: 'Maximum failed login attempts before lockout',
    },
    {
      key: 'auth.lockout_duration_minutes',
      value: 30,
      description: 'Account lockout duration in minutes',
    },
    {
      key: 'execution.max_concurrent_runs',
      value: 10,
      description: 'Maximum concurrent tool executions',
    },
    {
      key: 'execution.default_timeout_ms',
      value: 300000,
      description: 'Default tool execution timeout in milliseconds',
    },
    {
      key: 'llm.enabled',
      value: true,
      description: 'Enable LLM interpretation of results',
    },
    {
      key: 'llm.model',
      value: 'claude-3-sonnet-20240229',
      description: 'Claude model to use for interpretation',
    },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: { value: config.value, description: config.description },
      create: config,
    });
  }

  console.log(`  Set ${configs.length} configuration values`);

  // ============================================================================
  // Initial Audit Log
  // ============================================================================
  await prisma.auditLog.create({
    data: {
      action: 'system.seed',
      resource: 'system',
      details: {
        message: 'Database seeded successfully',
        toolsLoaded: manifestFiles.length,
        categoriesCreated: categories.length,
      },
      success: true,
    },
  });

  console.log('\n✅ Seed completed successfully!');
  console.log('\n📋 Summary:');
  console.log(`   - Roles: 3 (admin, engineer, viewer)`);
  console.log(`   - Users: 2 (admin, engineer)`);
  console.log(`   - Scopes: 3 (localhost, internal, demo)`);
  console.log(`   - Categories: ${categories.length}`);
  console.log(`   - Tools: ${manifestFiles.length}`);
  console.log(`\n🔐 Default Credentials:`);
  console.log(`   Admin: admin@securescope.local / ${adminPassword}`);
  console.log(`   Engineer: engineer@securescope.local / ${engineerPassword}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
