'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Square,
  Trash2,
  Ban,
  Target,
  ExternalLink,
  MoreHorizontal,
  X,
  Zap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, Run } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

const statusConfig = {
  all: { labelKey: 'all', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  PENDING: { labelKey: 'pending', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  RUNNING: { labelKey: 'running', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  COMPLETED: { labelKey: 'completed', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  FAILED: { labelKey: 'failed', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  TIMEOUT: { labelKey: 'timeout', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  CANCELLED: { labelKey: 'cancelled', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
};

export default function RunsPage() {
  const t = useTranslations('runs');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [runToDelete, setRunToDelete] = useState<{ id: string; toolName: string; target: string } | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const statusFilter = searchParams.get('status') || 'all';

  const setStatusFilter = (value: string) => {
    setPage(0); // Reset to first page when filter changes
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('status');
    } else {
      params.set('status', value);
    }
    router.push(`/runs?${params.toString()}`);
  };

  // Fetch all runs to calculate counts (max limit is 100 from API validation)
  const { data: allRunsResponse } = useQuery({
    queryKey: ['runs', 'all-counts'],
    queryFn: () => api.getRuns({ limit: 100 }),
  });

  const { data: runsResponse, isLoading } = useQuery({
    queryKey: ['runs', statusFilter, page],
    queryFn: () =>
      api.getRuns({
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        limit: pageSize,
        offset: page * pageSize,
      }),
  });

  const runs = runsResponse?.data || [];
  const pagination = runsResponse?.pagination;
  const allRuns = allRunsResponse?.data || [];

  // Calculate status counts from all runs
  const statusCounts = {
    all: allRunsResponse?.pagination.total || 0,
    PENDING: allRuns.filter((r: Run) => r.status === 'PENDING').length,
    RUNNING: allRuns.filter((r: Run) => r.status === 'RUNNING').length,
    COMPLETED: allRuns.filter((r: Run) => r.status === 'COMPLETED').length,
    FAILED: allRuns.filter((r: Run) => r.status === 'FAILED').length,
    TIMEOUT: allRuns.filter((r: Run) => r.status === 'TIMEOUT').length,
    CANCELLED: allRuns.filter((r: Run) => r.status === 'CANCELLED').length,
  };

  const handleStopRun = async (id: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setStoppingId(id);
    try {
      await api.stopRun(id);
      toast({
        title: t('runStopped'),
        description: t('runStoppedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch {
      toast({
        title: tCommon('error'),
        description: t('stopError'),
        variant: 'destructive',
      });
    } finally {
      setStoppingId(null);
    }
  };

  const handleDeleteRun = async () => {
    if (!runToDelete) return;
    setDeletingId(runToDelete.id);
    try {
      await api.deleteRun(runToDelete.id);
      toast({
        title: t('runDeleted'),
        description: t('runDeletedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['findings'] });
    } catch {
      toast({
        title: tCommon('error'),
        description: t('deleteError'),
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
      setDeleteDialogOpen(false);
      setRunToDelete(null);
    }
  };

  const openDeleteDialog = (id: string, toolName: string, target: string) => {
    setRunToDelete({ id, toolName, target });
    setDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            {t('description')}
          </p>
        </div>
        <Link href="/tools">
          <Button className="w-full sm:w-auto">
            <Play className="mr-2 h-4 w-4" />
            {t('newRun')}
          </Button>
        </Link>
      </div>

      {/* Status Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(statusConfig) as Array<keyof typeof statusConfig>).map((status) => {
          const config = statusConfig[status];
          const count = statusCounts[status];
          const isActive = statusFilter === status;
          const statusLabel = status === 'all' ? tCommon('all') : t(`status.${config.labelKey}`);

          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              disabled={count === 0 && status !== 'all'}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                isActive
                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                  : ''
              } ${config.color} ${
                count === 0 && status !== 'all'
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:opacity-80 cursor-pointer'
              }`}
            >
              {statusLabel}
              <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs">
                {count}
              </Badge>
            </button>
          );
        })}
        {statusFilter !== 'all' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStatusFilter('all')}
            className="h-8 gap-1 text-muted-foreground"
          >
            {t('clear')}
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {runs.length ? (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>{t('tool')}</TableHead>
                    <TableHead>{t('target')}</TableHead>
                    <TableHead>{tCommon('status')}</TableHead>
                    <TableHead>{t('findings')}</TableHead>
                    <TableHead>{t('duration')}</TableHead>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead className="w-[100px] text-right">{tCommon('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => {
                    const smartScanSessionId = (run.params as Record<string, unknown>)?.smartScanSessionId as string | undefined;
                    const isSmartScan = !!smartScanSessionId;
                    const detailUrl = isSmartScan ? `/smart-scan/${smartScanSessionId}` : `/runs/${run.id}`;

                    return (
                    <TableRow
                      key={run.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(detailUrl)}
                    >
                      <TableCell>
                        <StatusIcon status={run.status} size="sm" />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {isSmartScan && (
                            <Badge variant="outline" className="gap-1 text-xs text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-950 dark:border-purple-700">
                              <Zap className="h-3 w-3" />
                              Smart
                            </Badge>
                          )}
                          <span>{run.tool?.name || t('unknownTool')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Target className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate max-w-[200px]" title={run.target}>
                            {run.target}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={run.status} />
                      </TableCell>
                      <TableCell>
                        {run._count?.findings ? (
                          <Badge variant="secondary" className="font-mono">
                            {run._count.findings}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {run.duration ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDuration(run.duration)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(run.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/runs/${run.id}`);
                            }}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              {t('viewDetails')}
                            </DropdownMenuItem>
                            {(run.status === 'PENDING' || run.status === 'RUNNING') && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStopRun(run.id);
                                }}
                                disabled={stoppingId === run.id}
                                className="text-orange-600"
                              >
                                <Square className="mr-2 h-4 w-4" />
                                {t('stopRun')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteDialog(run.id, run.tool?.name || t('unknownTool'), run.target);
                              }}
                              disabled={deletingId === run.id}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t('deleteRun')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Mobile Card View */}
          <div className="grid gap-3 md:hidden">
            {runs.map((run) => {
              const smartScanSessionId = (run.params as Record<string, unknown>)?.smartScanSessionId as string | undefined;
              const isSmartScan = !!smartScanSessionId;
              const detailUrl = isSmartScan ? `/smart-scan/${smartScanSessionId}` : `/runs/${run.id}`;

              return (
              <Card key={run.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <Link href={detailUrl} className="block p-4">
                    <div className="flex items-start gap-3">
                      <StatusIcon status={run.status} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {isSmartScan && (
                                <Badge variant="outline" className="gap-1 text-xs text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-950 dark:border-purple-700">
                                  <Zap className="h-3 w-3" />
                                  Smart
                                </Badge>
                              )}
                              <p className="font-medium truncate">
                                {run.tool?.name || t('unknownTool')}
                              </p>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {run.target}
                            </p>
                          </div>
                          <StatusBadge status={run.status} size="sm" />
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          {run._count?.findings ? (
                            <span className="flex items-center gap-1">
                              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                                {run._count.findings} findings
                              </Badge>
                            </span>
                          ) : null}
                          {run.duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(run.duration)}
                            </span>
                          )}
                          <span>{formatDate(run.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="flex border-t">
                    <Link
                      href={detailUrl}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t('view')}
                    </Link>
                    {(run.status === 'PENDING' || run.status === 'RUNNING') && (
                      <button
                        onClick={(e) => handleStopRun(run.id, e)}
                        disabled={stoppingId === run.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950 transition-colors border-l disabled:opacity-50"
                      >
                        <Square className="h-4 w-4" />
                        {t('stop')}
                      </button>
                    )}
                    <button
                      onClick={() => openDeleteDialog(run.id, run.tool?.name || t('unknownTool'), run.target)}
                      disabled={deletingId === run.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-destructive hover:bg-red-50 dark:hover:bg-red-950 transition-colors border-l disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {tCommon('delete')}
                    </button>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {pagination && pagination.total > pageSize && (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                {t('showing', { start: page * pageSize + 1, end: Math.min((page + 1) * pageSize, pagination.total), total: pagination.total })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t('previous')}
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {t('page', { current: page + 1, total: Math.ceil(pagination.total / pageSize) })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!pagination.hasMore}
                >
                  {tCommon('next')}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Play className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">{t('noRuns')}</p>
            <p className="text-muted-foreground text-center">
              {statusFilter !== 'all'
                ? t('noFilteredRuns', { status: statusFilter === 'all' ? tCommon('all') : t(`status.${statusConfig[statusFilter as keyof typeof statusConfig]?.labelKey}`) })
                : t('noRunsDescription')}
            </p>
            <Link href="/tools">
              <Button className="mt-4">{t('browseTools')}</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteRun')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmDelete', { toolName: runToDelete?.toolName || '', target: runToDelete?.target || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRun}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusIcon({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-5 w-5' : 'h-8 w-8';
  const spinnerSize = size === 'sm' ? 'h-5 w-5 border-2' : 'h-8 w-8 border-4';

  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className={`${sizeClass} text-green-500`} />;
    case 'FAILED':
    case 'TIMEOUT':
      return <XCircle className={`${sizeClass} text-red-500`} />;
    case 'CANCELLED':
      return <Ban className={`${sizeClass} text-orange-500`} />;
    case 'RUNNING':
      return (
        <div className={`${spinnerSize} animate-spin rounded-full border-blue-500 border-t-transparent`} />
      );
    default:
      return <Clock className={`${sizeClass} text-muted-foreground`} />;
  }
}
