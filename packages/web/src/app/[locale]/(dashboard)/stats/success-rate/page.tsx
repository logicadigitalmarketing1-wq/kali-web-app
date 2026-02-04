'use client';

import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  Clock,
  Play,
  ArrowLeft,
  Activity,
  AlertCircle,
  Timer,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/status-badge';

function getRateColor(rate: number): string {
  if (rate >= 90) return 'text-green-500';
  if (rate >= 70) return 'text-yellow-500';
  if (rate >= 50) return 'text-orange-500';
  return 'text-red-500';
}

function getRateLabel(rate: number): string {
  if (rate >= 90) return 'Excellent';
  if (rate >= 70) return 'Good';
  if (rate >= 50) return 'Needs Improvement';
  return 'Poor';
}

function getRateBgColor(rate: number): string {
  if (rate >= 90) return 'bg-green-500';
  if (rate >= 70) return 'bg-yellow-500';
  if (rate >= 50) return 'bg-orange-500';
  return 'bg-red-500';
}

export default function SuccessRatePage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: api.getDashboardStats,
  });

  const { data: failedRunsResponse, isLoading: failedLoading } = useQuery({
    queryKey: ['runs', 'FAILED'],
    queryFn: () => api.getRuns({ status: 'FAILED', limit: 5 }),
  });

  const { data: timeoutRunsResponse, isLoading: timeoutLoading } = useQuery({
    queryKey: ['runs', 'TIMEOUT'],
    queryFn: () => api.getRuns({ status: 'TIMEOUT', limit: 5 }),
  });

  const failedRuns = failedRunsResponse?.data || [];
  const timeoutRuns = timeoutRunsResponse?.data || [];

  const isLoading = statsLoading || failedLoading || timeoutLoading;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const totalRuns = stats?.totalRuns || 0;
  const completedRuns = stats?.completedRuns || 0;
  const failedCount = stats?.failedRuns || 0;
  const pendingRuns = totalRuns - completedRuns - failedCount;
  const successRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;
  const failureRate = totalRuns > 0 ? Math.round((failedCount / totalRuns) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Success Rate</h1>
          <p className="text-muted-foreground">
            Execution statistics for all tool runs
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Main Rate Card */}
        <Card className="lg:row-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Overall Success Rate
            </CardTitle>
            <CardDescription>
              Percentage of runs that completed successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className={`text-7xl font-bold ${getRateColor(successRate)}`}>
              {successRate}%
            </div>
            <Badge
              className={`mt-4 ${getRateBgColor(successRate)} text-white`}
            >
              {getRateLabel(successRate)}
            </Badge>
            <Progress
              value={successRate}
              className="mt-6 w-full max-w-xs h-3"
            />
            <p className="mt-4 text-sm text-muted-foreground">
              {completedRuns} of {totalRuns} runs completed successfully
            </p>
          </CardContent>
        </Card>

        {/* Stats Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Run Statistics
            </CardTitle>
            <CardDescription>
              Breakdown by status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Link
                href="/runs?status=COMPLETED"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold">{completedRuns}</span>
                  <Badge variant="outline" className="text-green-500 border-green-500">
                    {successRate}%
                  </Badge>
                </div>
              </Link>

              <Link
                href="/runs?status=FAILED"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span>Failed</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold">{failedCount}</span>
                  <Badge variant="outline" className="text-red-500 border-red-500">
                    {failureRate}%
                  </Badge>
                </div>
              </Link>

              <Link
                href="/runs?status=PENDING"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <span>Pending/Running</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold">{pendingRuns > 0 ? pendingRuns : 0}</span>
                </div>
              </Link>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total Runs</span>
                <span>{totalRuns}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Failed Runs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Recent Failed Runs
            </CardTitle>
            <CardDescription>
              Last 5 failed executions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {failedRuns && failedRuns.length > 0 ? (
              <div className="space-y-3">
                {failedRuns.slice(0, 5).map((run) => (
                  <Link
                    key={run.id}
                    href={`/runs/${run.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{run.tool?.name || 'Unknown Tool'}</p>
                      <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {run.target}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={run.status} />
                      <span className="text-xs text-muted-foreground">
                        {formatDate(run.createdAt)}
                      </span>
                    </div>
                  </Link>
                ))}
                {failedCount > 5 && (
                  <Link href="/runs?status=FAILED">
                    <Button variant="outline" className="w-full">
                      View all {failedCount} failed runs
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <p className="mt-4 font-medium">No failed runs</p>
                <p className="text-sm text-muted-foreground">
                  All executions completed successfully
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeout Runs */}
        {timeoutRuns && timeoutRuns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-yellow-500" />
                Timeout Runs
              </CardTitle>
              <CardDescription>
                Runs that exceeded time limit
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {timeoutRuns.slice(0, 5).map((run) => (
                  <Link
                    key={run.id}
                    href={`/runs/${run.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{run.tool?.name || 'Unknown Tool'}</p>
                      <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {run.target}
                      </p>
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
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <Link href="/runs">
            <Button variant="outline">
              <Play className="mr-2 h-4 w-4" />
              View All Runs
            </Button>
          </Link>
          <Link href="/runs?status=FAILED">
            <Button variant="outline" className="text-red-500 border-red-500 hover:bg-red-500/10">
              <XCircle className="mr-2 h-4 w-4" />
              View Failed Runs
            </Button>
          </Link>
          <Link href="/tools">
            <Button>
              <Play className="mr-2 h-4 w-4" />
              Start New Run
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
