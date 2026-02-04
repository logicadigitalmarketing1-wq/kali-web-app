'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface SmartScanStep {
  id: string;
  phase: string;
  stepNumber: number;
  name: string;
  description: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'TIMEOUT';
  tool?: string;
  target?: string;
  executionTime?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface SmartScanProgressProps {
  steps: SmartScanStep[];
  progress: number;
  currentPhase?: string;
  target?: string;
}

export function SmartScanProgress({ steps, progress, currentPhase, target }: SmartScanProgressProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'RUNNING':
        return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'TIMEOUT':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'COMPLETED': 'default',
      'RUNNING': 'secondary',
      'FAILED': 'destructive',
      'TIMEOUT': 'outline',
      'SKIPPED': 'outline',
      'PENDING': 'outline',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status}
      </Badge>
    );
  };

  const formatDuration = (milliseconds?: number) => {
    if (!milliseconds) return '-';
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Scan Progress</span>
          <Badge variant="outline">{Math.round(progress)}%</Badge>
        </CardTitle>
        <CardDescription>
          {target && (
            <div className="font-mono text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded mb-2">
              Target: {target}
            </div>
          )}
          {currentPhase ? `Current phase: ${currentPhase.replace(/_/g, ' ')}` : 'Initializing scan...'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="space-y-4">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`border rounded-lg p-4 space-y-3 transition-all duration-300 ${
                step.status === 'RUNNING' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(step.status)}
                  <div>
                    <h4 className="font-medium">{step.name}</h4>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
                {getStatusBadge(step.status)}
              </div>

              {step.tool && (
                <div className="text-sm">
                  <span className="font-medium">Tool:</span> {step.tool}
                </div>
              )}

              {step.target && (
                <div className="text-sm">
                  <span className="font-medium">Target:</span> {step.target}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                {step.startedAt && (
                  <div>
                    <span className="font-medium">Started:</span> {formatTime(step.startedAt)}
                  </div>
                )}
                {step.completedAt && (
                  <div>
                    <span className="font-medium">Completed:</span> {formatTime(step.completedAt)}
                  </div>
                )}
                {step.executionTime && (
                  <div>
                    <span className="font-medium">Duration:</span> {formatDuration(step.executionTime)}
                  </div>
                )}
              </div>

              {step.error && (
                <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                  <span className="font-medium">Error:</span> {step.error}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
