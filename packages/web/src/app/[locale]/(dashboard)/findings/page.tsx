'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Search,
  Trash2,
  ExternalLink,
  MoreHorizontal,
  X,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Target,
  Link2,
} from 'lucide-react';
import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const severityConfig = {
  all: { label: 'All', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  CRITICAL: { label: 'Critical', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  HIGH: { label: 'High', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  MEDIUM: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  LOW: { label: 'Low', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  INFO: { label: 'Info', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

export default function FindingsPage() {
  const t = useTranslations('findings');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [findingToDelete, setFindingToDelete] = useState<{ id: string; title: string } | null>(null);
  const severityFilter = searchParams.get('severity') || 'all';

  const setSeverityFilter = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('severity');
    } else {
      params.set('severity', value);
    }
    router.push(`/findings?${params.toString()}`);
  };

  // Fetch all findings for counts
  const { data: allFindings } = useQuery({
    queryKey: ['findings', 'all'],
    queryFn: () => api.getFindings(),
  });

  const { data: findings, isLoading } = useQuery({
    queryKey: ['findings', severityFilter],
    queryFn: () =>
      api.getFindings(severityFilter !== 'all' ? { severity: severityFilter } : undefined),
  });

  // Calculate severity counts
  const severityCounts = {
    all: allFindings?.length || 0,
    CRITICAL: allFindings?.filter(f => f.severity === 'CRITICAL').length || 0,
    HIGH: allFindings?.filter(f => f.severity === 'HIGH').length || 0,
    MEDIUM: allFindings?.filter(f => f.severity === 'MEDIUM').length || 0,
    LOW: allFindings?.filter(f => f.severity === 'LOW').length || 0,
    INFO: allFindings?.filter(f => f.severity === 'INFO').length || 0,
  };

  const filteredFindings = findings?.filter(
    (finding) =>
      finding.title.toLowerCase().includes(search.toLowerCase()) ||
      finding.description.toLowerCase().includes(search.toLowerCase()) ||
      finding.cweId?.toLowerCase().includes(search.toLowerCase()) ||
      finding.owaspId?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDeleteFinding = async () => {
    if (!findingToDelete) return;
    setDeletingId(findingToDelete.id);
    try {
      await api.deleteFinding(findingToDelete.id);
      toast({
        title: tCommon('success'),
        description: t('findingDeleted'),
      });
      queryClient.invalidateQueries({ queryKey: ['findings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch {
      toast({
        title: tCommon('error'),
        description: tCommon('error'),
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
      setDeleteDialogOpen(false);
      setFindingToDelete(null);
    }
  };

  const openDeleteDialog = (id: string, title: string) => {
    setFindingToDelete({ id, title });
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
      </div>

      {/* Severity Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(severityConfig) as Array<keyof typeof severityConfig>).map((severity) => {
          const config = severityConfig[severity];
          const count = severityCounts[severity];
          const isActive = severityFilter === severity;

          return (
            <button
              key={severity}
              onClick={() => setSeverityFilter(severity)}
              disabled={count === 0 && severity !== 'all'}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                isActive
                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                  : ''
              } ${config.color} ${
                count === 0 && severity !== 'all'
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:opacity-80 cursor-pointer'
              }`}
            >
              {config.label}
              <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs">
                {count}
              </Badge>
            </button>
          );
        })}
        {severityFilter !== 'all' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSeverityFilter('all')}
            className="h-8 gap-1 text-muted-foreground"
          >
            {tCommon('reset')}
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredFindings?.length ? (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>{t('title')}</TableHead>
                    <TableHead>{t('severity.critical').split(' ')[0]}</TableHead>
                    <TableHead>{t('cwe')} / {t('owasp')}</TableHead>
                    <TableHead>{t('affectedAsset')}</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[100px] text-right">{tCommon('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFindings.map((finding) => (
                    <TableRow
                      key={finding.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/runs/${finding.runId}`)}
                    >
                      <TableCell>
                        <SeverityIcon severity={finding.severity} size="sm" />
                      </TableCell>
                      <TableCell className="font-medium max-w-[300px]">
                        <span className="line-clamp-2">{finding.title}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={finding.severity.toLowerCase() as 'critical' | 'high' | 'medium' | 'low' | 'info'}
                        >
                          {finding.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {finding.cweId && (
                            <a
                              href={`https://cwe.mitre.org/data/definitions/${finding.cweId.replace('CWE-', '')}.html`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {finding.cweId}
                              <Link2 className="h-3 w-3" />
                            </a>
                          )}
                          {finding.owaspId && (
                            <span className="text-sm text-muted-foreground">{finding.owaspId}</span>
                          )}
                          {!finding.cweId && !finding.owaspId && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {finding.run ? (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Target className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate max-w-[150px]" title={finding.run.target}>
                              {finding.run.target}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(finding.createdAt)}
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
                              router.push(`/runs/${finding.runId}`);
                            }}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              {t('viewRun')}
                            </DropdownMenuItem>
                            {finding.cweId && (
                              <DropdownMenuItem asChild>
                                <a
                                  href={`https://cwe.mitre.org/data/definitions/${finding.cweId.replace('CWE-', '')}.html`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Link2 className="mr-2 h-4 w-4" />
                                  {t('cwe')}
                                </a>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteDialog(finding.id, finding.title);
                              }}
                              disabled={deletingId === finding.id}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {tCommon('delete')}
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
            {filteredFindings.map((finding) => (
              <Card key={finding.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <Link href={`/runs/${finding.runId}`} className="block p-4">
                    <div className="flex items-start gap-3">
                      <SeverityIcon severity={finding.severity} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium line-clamp-2 flex-1">
                            {finding.title}
                          </p>
                          <Badge
                            variant={finding.severity.toLowerCase() as 'critical' | 'high' | 'medium' | 'low' | 'info'}
                            className="shrink-0"
                          >
                            {finding.severity}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {finding.cweId && (
                            <span className="text-primary">{finding.cweId}</span>
                          )}
                          {finding.owaspId && (
                            <span>{finding.owaspId}</span>
                          )}
                          {finding.run && (
                            <span className="flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              <span className="truncate max-w-[120px]">{finding.run.target}</span>
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(finding.createdAt)}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <div className="flex border-t">
                    <Link
                      href={`/runs/${finding.runId}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t('viewRun')}
                    </Link>
                    {finding.cweId && (
                      <a
                        href={`https://cwe.mitre.org/data/definitions/${finding.cweId.replace('CWE-', '')}.html`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-primary hover:bg-muted/50 transition-colors border-l"
                      >
                        <Link2 className="h-4 w-4" />
                        {t('cwe')}
                      </a>
                    )}
                    <button
                      onClick={() => openDeleteDialog(finding.id, finding.title)}
                      disabled={deletingId === finding.id}
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
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">{t('noFindings')}</p>
            <p className="text-muted-foreground text-center">
              {search || severityFilter !== 'all'
                ? tCommon('noResults')
                : t('noFindingsDescription')}
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
            <AlertDialogTitle>{t('deleteFinding')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmDelete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFinding}
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

function SeverityIcon({ severity, size = 'md' }: { severity: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-5 w-5' : 'h-8 w-8';

  switch (severity) {
    case 'CRITICAL':
    case 'HIGH':
      return <ShieldAlert className={`${sizeClass} text-red-500`} />;
    case 'MEDIUM':
      return <ShieldQuestion className={`${sizeClass} text-yellow-500`} />;
    case 'LOW':
      return <ShieldCheck className={`${sizeClass} text-blue-500`} />;
    default:
      return <ShieldCheck className={`${sizeClass} text-gray-400`} />;
  }
}
