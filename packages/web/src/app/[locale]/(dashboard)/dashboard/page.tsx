'use client';

import { useQueries } from '@tanstack/react-query';
import {
  Play,
  CheckCircle,
  AlertTriangle,
  Activity,
  Shield,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { formatDate, getSeverityColor, getHealthStatusColor } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/status-badge';
import Link from 'next/link';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tFindings = useTranslations('findings');
  // Parallel data fetching with useQueries
  const results = useQueries({
    queries: [
      {
        queryKey: ['dashboard-stats'],
        queryFn: api.getDashboardStats,
      },
      {
        queryKey: ['health'],
        queryFn: api.getHealth,
        refetchInterval: 30000,
      },
    ],
  });

  const [statsQuery, healthQuery] = results;
  const stats = statsQuery.data;
  const healthStatus = healthQuery.data;
  const isLoading = statsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${getHealthStatusColor(healthStatus?.status === 'healthy')}`}
          />
          <span className="text-sm text-muted-foreground">
            HexStrike: {healthStatus?.hexstrike?.tools_available || 0} tools
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/runs">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('totalRuns')}</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalRuns || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.completedRuns || 0} {t('completedRuns').toLowerCase()}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/stats/success-rate">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('successRate')}</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalRuns
                  ? Math.round((stats.completedRuns / stats.totalRuns) * 100)
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.failedRuns || 0} {t('failedRuns').toLowerCase()}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/findings">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('totalFindings')}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalFindings || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.criticalFindings || 0} {t('criticalFindings').toLowerCase()}, {stats?.highFindings || 0} {t('highFindings').toLowerCase()}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/stats/security-score">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('securityScore')}</CardTitle>
              <Shield className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {calculateSecurityScore(stats?.findingsBySeverity)}/100
              </div>
              <p className="text-xs text-muted-foreground">{t('basedOnFindings')}</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Runs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t('recentRuns')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.recentRuns?.length ? (
              <div className="space-y-4">
                {stats.recentRuns.slice(0, 5).map((run) => (
                  <Link
                    key={run.id}
                    href={`/runs/${run.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{run.tool?.name || '-'}</p>
                      <p className="text-sm text-muted-foreground">{run.target}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={run.status} />
                      <span className="text-xs text-muted-foreground">
                        {formatDate(run.createdAt)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground">{t('noActivity')}</p>
            )}
          </CardContent>
        </Card>

        {/* Findings by Severity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t('findingsBySeverity')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.findingsBySeverity?.length ? (
              <div className="space-y-2">
                {stats.findingsBySeverity.map((item) => (
                  <Link
                    key={item.severity}
                    href={`/findings?severity=${item.severity}`}
                    className="flex items-center gap-4 rounded-lg p-2 transition-colors hover:bg-muted/50"
                  >
                    <Badge
                      variant={item.severity.toLowerCase() as 'critical' | 'high' | 'medium' | 'low' | 'info'}
                      className="w-20 justify-center"
                    >
                      {tFindings(`severity.${item.severity.toLowerCase()}`)}
                    </Badge>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className={`h-2 rounded-full ${getSeverityColor(item.severity)}`}
                          style={{
                            width: `${(item.count / (stats.totalFindings || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="w-12 text-right text-sm font-medium">
                      {item.count}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground">{t('noActivity')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function calculateSecurityScore(
  findingsBySeverity: Array<{ severity: string; count: number }> | undefined
): number {
  if (!findingsBySeverity || findingsBySeverity.length === 0) return 100;

  // Get counts by severity
  const counts: Record<string, number> = {};
  for (const item of findingsBySeverity) {
    counts[item.severity] = item.count;
  }

  const critical = counts['CRITICAL'] || 0;
  const high = counts['HIGH'] || 0;
  const medium = counts['MEDIUM'] || 0;
  const low = counts['LOW'] || 0;
  // INFO findings don't affect security score

  // Calculate score with diminishing returns for each severity level
  // Each critical finding has significant impact, but capped
  // Formula: 100 - (critical impact) - (high impact) - (medium impact) - (low impact)
  const criticalImpact = Math.min(40, critical * 15); // Max 40 points from criticals
  const highImpact = Math.min(30, high * 8);          // Max 30 points from highs
  const mediumImpact = Math.min(20, medium * 2);      // Max 20 points from mediums
  const lowImpact = Math.min(10, low * 0.5);          // Max 10 points from lows

  const score = 100 - criticalImpact - highImpact - mediumImpact - lowImpact;

  return Math.max(0, Math.min(100, Math.round(score)));
}
