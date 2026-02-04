'use client';

import dynamic from 'next/dynamic';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  FileText,
  AlertTriangle,
  Brain,
  Radio,
  RotateCw,
} from 'lucide-react';
import { api, Finding } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useRunStream } from '@/hooks/use-run-stream';
import { ToolErrorsTable } from '@/components/scan-analysis/tool-errors-table';

// Dynamic import for terminal output (heavy component)
const TerminalOutput = dynamic(
  () => import('@/components/terminal-output'),
  {
    loading: () => (
      <div className="flex h-32 items-center justify-center rounded-lg bg-black">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-400 border-t-transparent" />
      </div>
    ),
    ssr: false,
  }
);

// Dynamic import for SmartScanReport (used in findings tab)
const SmartScanReport = dynamic(
  () => import('@/components/smart-scan/smart-scan-report').then(mod => ({ default: mod.SmartScanReport })),
  {
    loading: () => (
      <div className="flex h-32 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
    ssr: false,
  }
);

// Calculate risk score based on findings severity
function calculateRiskScore(findings: Finding[]): number {
  let score = 0;
  for (const finding of findings) {
    switch (finding.severity) {
      case 'CRITICAL':
        score += 10;
        break;
      case 'HIGH':
        score += 7;
        break;
      case 'MEDIUM':
        score += 4;
        break;
      case 'LOW':
        score += 2;
        break;
      case 'INFO':
        score += 1;
        break;
    }
  }
  return Math.min(100, score);
}

// Map Finding to SmartScanFinding format for SmartScanReport component
function mapFindingsToSmartScanFormat(findings: Finding[], toolName?: string) {
  return findings.map((finding) => ({
    id: finding.id,
    title: finding.title,
    description: finding.description,
    severity: finding.severity,
    confidence: finding.confidence ?? undefined,
    category: finding.cweId || finding.owaspId || 'Security',
    cveId: finding.cveId ?? null,
    cweId: finding.cweId ?? null,
    tool: toolName || 'Unknown',
    target: finding.run?.target,
    location: finding.location ?? null,
    evidence: finding.evidence ?? undefined,
    remediation: finding.remediation ?? undefined,
    exploitation: finding.exploitation ?? undefined,
    verification: finding.verification ?? undefined,
    references: finding.references || [],
    status: 'open',
  }));
}

export default function RunDetailPage() {
  const params = useParams();
  const runId = params.id as string;
  const queryClient = useQueryClient();

  // Query for run data with polling fallback
  const { data: run, isLoading, refetch } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => api.getRun(runId),
    refetchInterval: (query) => {
      const data = query.state.data;
      // Only poll if not streaming and run is active
      return data?.status === 'RUNNING' || data?.status === 'PENDING' ? 3000 : false;
    },
  });

  // Use streaming for real-time output
  const isRunActive = run?.status === 'RUNNING' || run?.status === 'PENDING';
  const {
    output: streamOutput,
    progress,
    phase,
    currentTool,
    isStreaming,
    isConnected,
    isCompleted: streamCompleted,
  } = useRunStream({
    runId,
    enabled: isRunActive,
  });

  // Mutation for reanalyzing run
  const reanalyzeMutation = useMutation({
    mutationFn: () => api.reanalyzeRun(runId),
    onSuccess: (data) => {
      queryClient.setQueryData(['run', runId], data);
    },
  });

  // Refetch run data when stream completes
  if (streamCompleted && isRunActive) {
    refetch();
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-lg font-medium">Run not found</p>
        <Link href="/runs">
          <Button variant="ghost" className="mt-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to runs
          </Button>
        </Link>
      </div>
    );
  }

  const stdout = run.artifacts?.find((a) => a.type === 'stdout');
  const stderr = run.artifacts?.find((a) => a.type === 'stderr');

  // Use streaming output if available, otherwise use artifact
  const displayOutput = isStreaming && streamOutput ? streamOutput : stdout?.content || '';
  const hasOutput = displayOutput.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/runs">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{run.tool?.name || 'Unknown Tool'}</h1>
            <StatusBadge status={run.status} size="md" />
          </div>
          <p className="text-muted-foreground">{run.target}</p>
        </div>
        {run.tool?.slug && (
          <Link href={`/tools/${run.tool.slug}?target=${encodeURIComponent(run.target)}`}>
            <Button variant="outline">
              <RotateCw className="mr-2 h-4 w-4" />
              New Scan
            </Button>
          </Link>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={run.status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {run.duration ? formatDuration(run.duration) : '-'}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Exit Code</CardTitle>
          </CardHeader>
          <CardContent>
            {run.exitCode !== null ? (
              <span className={run.exitCode === 0 ? 'text-green-500' : 'text-red-500'}>
                {run.exitCode}
              </span>
            ) : (
              '-'
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Findings</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            {run.findings?.length || 0}
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="output" className="space-y-4">
        <TabsList>
          <TabsTrigger value="output" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Output
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI Analysis
          </TabsTrigger>
          <TabsTrigger value="findings" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Findings ({run.findings?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="output">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Tool Output
                    {isStreaming && (
                      <Badge variant="outline" className="ml-2 gap-1 border-green-500 text-green-500">
                        <Radio className="h-3 w-3 animate-pulse" />
                        Live
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Started: {run.startedAt ? formatDate(run.startedAt) : '-'} |
                    Completed: {run.completedAt ? formatDate(run.completedAt) : '-'}
                  </CardDescription>
                </div>
                {currentTool && (
                  <Badge variant="secondary" className="text-xs">
                    Running: {currentTool}
                  </Badge>
                )}
              </div>

              {/* Progress bar when streaming */}
              {isStreaming && progress > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{phase || 'Executing...'}</span>
                    <span className="font-medium">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </CardHeader>
            <CardContent>
              {hasOutput ? (
                <TerminalOutput
                  content={displayOutput}
                  maxHeight="600px"
                  isStreaming={isStreaming}
                  autoScroll={isStreaming}
                />
              ) : run.status === 'RUNNING' || run.status === 'PENDING' ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <span className="mt-4 text-muted-foreground">
                    {isConnected ? 'Waiting for output...' : 'Connecting...'}
                  </span>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">No output available</p>
              )}

              {stderr && stderr.content && (
                <div className="mt-4">
                  <h4 className="mb-2 font-medium text-red-500">Errors</h4>
                  <TerminalOutput content={stderr.content} variant="error" maxHeight="200px" />
                </div>
              )}

              {run.error && (
                <div className="mt-4 rounded-lg border border-red-500 bg-red-950 p-4">
                  <h4 className="font-medium text-red-500">Error</h4>
                  <p className="text-red-400">{run.error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Claude AI Analysis
                  </CardTitle>
                  {run.analysis && (
                    <CardDescription>
                      Model: {run.analysis.modelUsed} | Tokens: {run.analysis.tokensUsed}
                    </CardDescription>
                  )}
                </div>
                {run.status === 'COMPLETED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reanalyzeMutation.mutate()}
                    disabled={reanalyzeMutation.isPending}
                  >
                    {reanalyzeMutation.isPending ? (
                      <>
                        <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <RotateCw className="mr-2 h-4 w-4" />
                        Reanalyze
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {run.analysis ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="mb-2 font-semibold">Summary</h4>
                    <p className="text-muted-foreground">{run.analysis.summary}</p>
                  </div>

                  {run.analysis.observations?.length > 0 && (
                    <div>
                      <h4 className="mb-2 font-semibold">Observations</h4>
                      <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                        {run.analysis.observations.map((obs: string, i: number) => (
                          <li key={i}>{obs}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {run.analysis.recommendations?.length > 0 && (
                    <div>
                      <h4 className="mb-2 font-semibold">Recommendations</h4>
                      <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                        {run.analysis.recommendations.map((rec: string | { id?: string; title?: string; description?: string }, i: number) => (
                          <li key={i}>
                            {typeof rec === 'string' ? rec : (rec.title || rec.description || 'Recommendation')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : run.status === 'COMPLETED' ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Brain className="h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-lg font-medium">No analysis available</p>
                  <p className="text-muted-foreground text-sm">
                    Click &quot;Reanalyze&quot; to generate AI analysis for this run
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => reanalyzeMutation.mutate()}
                    disabled={reanalyzeMutation.isPending}
                  >
                    {reanalyzeMutation.isPending ? (
                      <>
                        <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                        Generating Analysis...
                      </>
                    ) : (
                      <>
                        <Brain className="mr-2 h-4 w-4" />
                        Generate Analysis
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">
                  Analysis will be available after the run completes
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="findings" className="space-y-6">
          {/* Tool execution status for single-tool runs */}
          {(run.status === 'FAILED' || run.status === 'TIMEOUT' || run.error) && (
            <ToolErrorsTable
              steps={[]}
              singleToolRun={{
                toolName: run.tool?.name || 'Unknown Tool',
                status: run.status,
                error: run.error,
                exitCode: run.exitCode,
                duration: run.duration,
              }}
            />
          )}

          {/* Vulnerability findings */}
          <SmartScanReport
            report={{
              summary: {
                target: run.target,
                totalVulnerabilities: run.findings?.length || 0,
                criticalVulnerabilities: run.findings?.filter(f => f.severity === 'CRITICAL').length || 0,
                highVulnerabilities: run.findings?.filter(f => f.severity === 'HIGH').length || 0,
                riskScore: calculateRiskScore(run.findings || []),
                scanDuration: (run.duration || 0) * 1000, // Convert seconds to ms
              },
              // Don't pass recommendations here - SmartScanReport fetches AI recommendations via API
              // run.analysis.recommendations are complex objects, not strings
            }}
            findings={mapFindingsToSmartScanFormat(run.findings || [], run.tool?.name)}
            runId={runId}
            onFindingDeleted={() => refetch()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

