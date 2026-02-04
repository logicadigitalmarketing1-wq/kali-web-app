/**
 * Script to sync SmartScanFindings to the Finding table
 *
 * This script is needed because SmartScan findings are stored in the SmartScanFinding table,
 * but the Runs and Findings pages query the Finding table.
 *
 * Run with: npx ts-node -r tsconfig-paths/register src/scripts/sync-smart-scan-findings.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncFindings() {
  console.log('🔄 Starting SmartScanFinding to Finding sync...\n');

  // Find all SmartScanSessions that have findings
  const sessions = await prisma.smartScanSession.findMany({
    where: {
      status: {
        in: ['COMPLETED', 'FAILED', 'CANCELLED'],
      },
    },
    include: {
      findings: true,
    },
  });

  console.log(`📊 Found ${sessions.length} completed/failed/cancelled SmartScan sessions`);

  let totalSynced = 0;
  let totalSkipped = 0;

  for (const session of sessions) {
    console.log(`\n📋 Processing session: ${session.id}`);
    console.log(`   Target: ${session.target}`);
    console.log(`   SmartScan Findings: ${session.findings.length}`);

    // Find the associated Run
    const run = await prisma.run.findFirst({
      where: {
        userId: session.userId,
        target: session.target,
        params: {
          path: ['smartScanSessionId'],
          equals: session.id,
        },
      },
    });

    if (!run) {
      console.log(`   ⚠️  No associated Run found, skipping...`);
      totalSkipped += session.findings.length;
      continue;
    }

    console.log(`   Run ID: ${run.id}`);

    // Check existing findings count
    const existingCount = await prisma.finding.count({
      where: { runId: run.id },
    });

    console.log(`   Existing Findings in Run: ${existingCount}`);

    if (existingCount > 0 && existingCount === session.findings.length) {
      console.log(`   ✅ Already synced, skipping...`);
      continue;
    }

    // Delete existing findings and recreate (to ensure consistency)
    if (existingCount > 0) {
      console.log(`   🗑️  Deleting ${existingCount} existing findings...`);
      await prisma.finding.deleteMany({ where: { runId: run.id } });
    }

    // Sync findings
    let synced = 0;
    for (const finding of session.findings) {
      try {
        await prisma.finding.create({
          data: {
            runId: run.id,
            title: finding.title,
            description: finding.description || '',
            severity: finding.severity,
            confidence: finding.confidence || 0.8,
            cweId: null,
            owaspId: null,
            evidence: finding.evidence || null,
            remediation: finding.remediation || null,
            references: finding.references || [],
            metadata: {
              smartScanFindingId: finding.id,
              smartScanSessionId: session.id,
              category: finding.category,
              tool: finding.tool,
              target: finding.target,
            },
            status: finding.status || 'open',
          },
        });
        synced++;
      } catch (error) {
        console.log(`   ❌ Failed to sync finding "${finding.title}": ${error}`);
      }
    }

    console.log(`   ✅ Synced ${synced}/${session.findings.length} findings`);
    totalSynced += synced;
  }

  // Update Run statuses to match SmartScan status
  console.log('\n🔄 Updating Run statuses...');

  for (const session of sessions) {
    const run = await prisma.run.findFirst({
      where: {
        userId: session.userId,
        target: session.target,
        params: {
          path: ['smartScanSessionId'],
          equals: session.id,
        },
      },
    });

    if (run) {
      const runStatus = session.status === 'COMPLETED' ? 'COMPLETED' :
                        session.status === 'FAILED' ? 'FAILED' :
                        session.status === 'CANCELLED' ? 'CANCELLED' :
                        session.status === 'RUNNING' ? 'RUNNING' : 'PENDING';

      if (run.status !== runStatus) {
        await prisma.run.update({
          where: { id: run.id },
          data: {
            status: runStatus as any,
            completedAt: session.completedAt,
            startedAt: session.startedAt,
          },
        });
        console.log(`   Updated Run ${run.id} status: ${run.status} → ${runStatus}`);
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Sync complete!`);
  console.log(`   Total findings synced: ${totalSynced}`);
  console.log(`   Total findings skipped (no Run): ${totalSkipped}`);
  console.log('='.repeat(50));
}

syncFindings()
  .catch((error) => {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
