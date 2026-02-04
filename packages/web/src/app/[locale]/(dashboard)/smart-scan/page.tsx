'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Loader2,
  Plus,
  Target,
  Trash2,
  Square,
  MoreHorizontal,
  ExternalLink,
  X,
  Ban,
  Zap,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
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
import { api, SmartScanSummary, SmartScanStatusCounts } from '@/lib/api';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { formatDate } from '@/lib/utils';

const statusConfig = {
  all: { labelKey: 'all', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  CREATED: { labelKey: 'queued', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  RUNNING: { labelKey: 'running', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  COMPLETED: { labelKey: 'completed', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  FAILED: { labelKey: 'failed', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  CANCELLED: { labelKey: 'cancelled', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
};

const ITEMS_PER_PAGE = 10;

export default function SmartScanPage() {
  const t = useTranslations('smartScan');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scanToDelete, setScanToDelete] = useState<{ id: string; name: string; target: string } | null>(null);

  // Fetch status counts for filter chips
  const { data: statusCounts } = useQuery({
    queryKey: ['smart-scan-counts'],
    queryFn: () => api.getSmartScanCounts(),
    refetchInterval: 5000,
  });

  // Fetch paginated scans
  const { data: scansData, isLoading } = useQuery({
    queryKey: ['smart-scans', statusFilter, currentPage],
    queryFn: () => api.getSmartScans({
      limit: ITEMS_PER_PAGE,
      offset: (currentPage - 1) * ITEMS_PER_PAGE,
      status: statusFilter,
    }),
    refetchInterval: 5000,
  });

  const scans = scansData?.data;
  const pagination = scansData?.pagination;
  const totalPages = pagination ? Math.ceil(pagination.total / ITEMS_PER_PAGE) : 1;

  // Reset to page 1 when filter changes
  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  // Check if any scan is currently running
  const hasRunningScan = (statusCounts?.RUNNING ?? 0) > 0;

  const handleStartScan = async (id: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    // Check if there's already a running scan
    if (hasRunningScan) {
      toast({
        title: t('cannotStartScan'),
        description: t('anotherScanRunning'),
        variant: 'destructive',
      });
      return;
    }

    setStartingId(id);
    try {
      await api.startSmartScan(id);
      toast({
        title: t('scanStarted'),
        description: t('scanStartedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['smart-scans'] });
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      // Navigate to scan detail page
      router.push(`/smart-scan/${id}`);
    } catch {
      toast({
        title: tCommon('error'),
        description: t('startError'),
        variant: 'destructive',
      });
    } finally {
      setStartingId(null);
    }
  };

  const handleStopScan = async (id: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setStoppingId(id);
    try {
      await api.cancelSmartScan(id);
      toast({
        title: t('scanStopped'),
        description: t('scanStoppedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['smart-scans'] });
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

  const handleDeleteScan = async () => {
    if (!scanToDelete) return;
    setDeletingId(scanToDelete.id);
    try {
      await api.deleteSmartScan(scanToDelete.id);
      toast({
        title: t('scanDeleted'),
        description: t('scanDeletedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['smart-scans'] });
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
      setScanToDelete(null);
    }
  };

  const openDeleteDialog = (id: string, name: string, target: string) => {
    setScanToDelete({ id, name, target });
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
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-purple-500" />
            <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground sm:text-base">
            {t('description')}
          </p>
        </div>
        <Link href="/smart-scan/new">
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            {t('newScan')}
          </Button>
        </Link>
      </div>

      {/* Status Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(statusConfig) as Array<keyof typeof statusConfig>).map((status) => {
          const config = statusConfig[status];
          const count = statusCounts?.[status] ?? 0;
          const isActive = statusFilter === status;
          const statusLabel = status === 'all' ? tCommon('all') : t(`status.${config.labelKey}`);

          return (
            <button
              key={status}
              onClick={() => handleStatusFilterChange(status)}
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
            onClick={() => handleStatusFilterChange('all')}
            className="h-8 gap-1 text-muted-foreground"
          >
            {t('clear')}
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {scans?.length ? (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>{t('nameTarget')}</TableHead>
                    <TableHead>{tCommon('status')}</TableHead>
                    <TableHead>{t('progress')}</TableHead>
                    <TableHead>{t('findings')}</TableHead>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead className="w-[100px] text-right">{tCommon('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scans.map((scan) => (
                    <TableRow
                      key={scan.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/smart-scan/${scan.id}`)}
                    >
                      <TableCell>
                        <ScanStatusIcon status={scan.status} size="sm" />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{scan.name || t('unnamedScan')}</p>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Target className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate max-w-[200px]" title={scan.target}>
                              {scan.target}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={scan.status === 'CREATED' ? 'PENDING' : scan.status} />
                      </TableCell>
                      <TableCell>
                        {scan.status === 'RUNNING' ? (
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${scan.progress}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {Math.round(scan.progress)}%
                            </span>
                          </div>
                        ) : scan.status === 'COMPLETED' ? (
                          <span className="text-sm text-green-600">100%</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {scan.status === 'COMPLETED' ? (
                          <div className="flex items-center gap-2">
                            {scan.criticalVulnerabilities > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {scan.criticalVulnerabilities} Crit
                              </Badge>
                            )}
                            {scan.highVulnerabilities > 0 && (
                              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs">
                                {scan.highVulnerabilities} High
                              </Badge>
                            )}
                            <span className="text-sm text-muted-foreground">
                              {scan.findingsCount} {t('total')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(scan.createdAt)}
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
                              router.push(`/smart-scan/${scan.id}`);
                            }}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              {t('viewDetails')}
                            </DropdownMenuItem>
                            {scan.status === 'CREATED' && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartScan(scan.id);
                                }}
                                disabled={startingId === scan.id || hasRunningScan}
                                className="text-green-600"
                              >
                                <Play className="mr-2 h-4 w-4" />
                                {hasRunningScan ? t('scanInProgress') : t('startScan')}
                              </DropdownMenuItem>
                            )}
                            {(scan.status === 'CREATED' || scan.status === 'RUNNING') && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStopScan(scan.id);
                                }}
                                disabled={stoppingId === scan.id}
                                className="text-orange-600"
                              >
                                <Square className="mr-2 h-4 w-4" />
                                {t('stopScan')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteDialog(scan.id, scan.name || t('unnamedScan'), scan.target);
                              }}
                              disabled={deletingId === scan.id}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t('deleteScan')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Mobile Card View */}
          <div className="grid gap-3 md:hidden">
            {scans.map((scan) => (
              <Card key={scan.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <Link href={`/smart-scan/${scan.id}`} className="block p-4">
                    <div className="flex items-start gap-3">
                      <ScanStatusIcon status={scan.status} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {scan.name || t('unnamedScan')}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {scan.target}
                            </p>
                          </div>
                          <StatusBadge status={scan.status === 'CREATED' ? 'PENDING' : scan.status} size="sm" />
                        </div>
                        {scan.status === 'RUNNING' && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${scan.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(scan.progress)}%
                            </span>
                          </div>
                        )}
                        {scan.status === 'COMPLETED' && (
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            {scan.criticalVulnerabilities > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {scan.criticalVulnerabilities} Crit
                              </Badge>
                            )}
                            {scan.highVulnerabilities > 0 && (
                              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs">
                                {scan.highVulnerabilities} High
                              </Badge>
                            )}
                            <span className="text-muted-foreground">
                              {scan.findingsCount} {t('findings')}
                            </span>
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{formatDate(scan.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="flex border-t">
                    <Link
                      href={`/smart-scan/${scan.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t('view')}
                    </Link>
                    {scan.status === 'CREATED' && (
                      <button
                        onClick={(e) => handleStartScan(scan.id, e)}
                        disabled={startingId === scan.id || hasRunningScan}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-950 transition-colors border-l disabled:opacity-50"
                        title={hasRunningScan ? t('anotherScanRunning') : t('startThisScan')}
                      >
                        <Play className="h-4 w-4" />
                        {t('start')}
                      </button>
                    )}
                    {scan.status === 'RUNNING' && (
                      <button
                        onClick={(e) => handleStopScan(scan.id, e)}
                        disabled={stoppingId === scan.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950 transition-colors border-l disabled:opacity-50"
                      >
                        <Square className="h-4 w-4" />
                        {t('stop')}
                      </button>
                    )}
                    <button
                      onClick={() => openDeleteDialog(scan.id, scan.name || t('unnamedScan'), scan.target)}
                      disabled={deletingId === scan.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-destructive hover:bg-red-50 dark:hover:bg-red-950 transition-colors border-l disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {tCommon('delete')}
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t('showing', { start: ((currentPage - 1) * ITEMS_PER_PAGE) + 1, end: Math.min(currentPage * ITEMS_PER_PAGE, pagination?.total || 0), total: pagination?.total || 0 })}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setCurrentPage(pageNum)}
                          isActive={currentPage === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">{t('noScans')}</p>
            <p className="text-muted-foreground text-center">
              {statusFilter !== 'all'
                ? t('noFilteredScans', { status: statusFilter === 'all' ? tCommon('all') : t(`status.${statusConfig[statusFilter as keyof typeof statusConfig]?.labelKey}`) })
                : t('noScansDescription')}
            </p>
            <Link href="/smart-scan/new">
              <Button className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                {t('createFirstScan')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteScan')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmDelete', { name: scanToDelete?.name || '', target: scanToDelete?.target || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteScan}
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

function ScanStatusIcon({ status, size = 'md' }: { status: SmartScanSummary['status']; size?: 'sm' | 'md' }) {
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
    case 'PAUSED':
      return <AlertTriangle className={`${sizeClass} text-yellow-500`} />;
    default:
      return <Clock className={`${sizeClass} text-muted-foreground`} />;
  }
}
