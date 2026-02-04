'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Wifi, WifiOff, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { SmartScanProgress } from '@/components/smart-scan/smart-scan-progress';
import { SmartScanReport } from '@/components/smart-scan/smart-scan-report';
import { SmartScanLogs } from '@/components/smart-scan/smart-scan-logs';
import { useSmartScanStream } from '@/hooks/use-smart-scan-stream';

export default function SmartScanDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const [refreshKey, setRefreshKey] = useState(0);

  const { status: currentScan, logs, isConnected, error, refetch } = useSmartScanStream(sessionId);

  // Handle finding deletion - refresh the data
  const handleFindingDeleted = useCallback((findingId: string) => {
    // Trigger a refetch of the scan data
    refetch?.();
    setRefreshKey(prev => prev + 1);
  }, [refetch]);

  // Handle tool deletion - refresh the data
  const handleToolDeleted = useCallback((tool: string) => {
    // Trigger a refetch of the scan data
    refetch?.();
    setRefreshKey(prev => prev + 1);
  }, [refetch]);

  if (!currentScan) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'RUNNING':
        return 'default';
      case 'COMPLETED':
        return 'secondary';
      case 'FAILED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/smart-scan">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{currentScan.name || 'Smart Scan'}</h1>
            <Badge variant={getStatusVariant(currentScan.status)}>
              {currentScan.status}
            </Badge>
            {isConnected ? (
              <Badge variant="outline" className="flex items-center gap-1 text-green-600">
                <Wifi className="h-3 w-3" />
                Live
              </Badge>
            ) : currentScan.status === 'RUNNING' ? (
              <Badge variant="outline" className="flex items-center gap-1 text-gray-400">
                <WifiOff className="h-3 w-3" />
                Reconnecting...
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground">{currentScan.target}</p>
        </div>
        <Link href={`/smart-scan?target=${encodeURIComponent(currentScan.target)}`}>
          <Button variant="outline">
            <RotateCw className="mr-2 h-4 w-4" />
            New Scan
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(currentScan.progress)}%</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${currentScan.progress}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current Phase</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {currentScan.status === 'COMPLETED'
                ? 'Completed'
                : currentScan.status === 'FAILED'
                  ? 'Failed'
                  : currentScan.status === 'CANCELLED'
                    ? 'Cancelled'
                    : currentScan.currentPhase?.replace(/_/g, ' ') || 'Initializing...'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentScan.findings?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentScan.report?.summary?.riskScore !== undefined
                ? `${Math.round(currentScan.report.summary.riskScore)}/100`
                : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queued Status Display */}
      {currentScan.status === 'CREATED' && (
        <Card className="border-yellow-500 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-yellow-800">
              <div className="h-5 w-5 animate-pulse rounded-full bg-yellow-500" />
              <div>
                <p className="font-medium">Scan Queued</p>
                <p className="text-sm">
                  Waiting for current scan to complete. Your scan will start automatically.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
              Error: {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress and Logs */}
      <div className="grid gap-6 md:grid-cols-2">
        <SmartScanProgress
          steps={currentScan.steps || []}
          progress={currentScan.progress || 0}
          currentPhase={currentScan.currentPhase}
          target={currentScan.target}
        />

        <SmartScanLogs logs={logs} isConnected={isConnected} />
      </div>

      {/* Report (when completed) */}
      {currentScan.status === 'COMPLETED' && currentScan.report && (
        <SmartScanReport
          key={refreshKey}
          report={currentScan.report}
          findings={currentScan.findings}
          steps={currentScan.steps}
          sessionId={sessionId}
          onFindingDeleted={handleFindingDeleted}
          onToolDeleted={handleToolDeleted}
        />
      )}
    </div>
  );
}
