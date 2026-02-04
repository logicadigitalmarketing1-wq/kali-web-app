'use client';

import { CheckCircle, XCircle, Clock, AlertTriangle, AlertCircle, MinusCircle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface ToolStep {
  id: string;
  name: string;
  tool?: string | null;
  status: string;
  error?: string | null;
  errorImpact?: string | null;
  errorSolution?: string | null;
  executionTime?: number | null;
}

interface ToolErrorsTableProps {
  steps: ToolStep[];
  singleToolRun?: {
    toolName: string;
    status: string;
    error?: string | null;
    exitCode?: number | null;
    duration?: number | null;
  } | null;
}

type DisplayStatus = 'SUCCESS' | 'TIMEOUT' | 'FAILED' | 'WARNING' | 'PARTIAL' | 'PENDING' | 'RUNNING';

const mapStatusToDisplay = (status: string): DisplayStatus => {
  switch (status) {
    case 'COMPLETED':
      return 'SUCCESS';
    case 'TIMEOUT':
      return 'TIMEOUT';
    case 'FAILED':
      return 'FAILED';
    case 'SKIPPED':
      return 'WARNING';
    case 'PENDING':
      return 'PENDING';
    case 'RUNNING':
      return 'RUNNING';
    default:
      return 'PARTIAL';
  }
};

const getStatusIcon = (status: DisplayStatus) => {
  switch (status) {
    case 'SUCCESS':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'TIMEOUT':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'FAILED':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'WARNING':
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case 'PARTIAL':
      return <AlertCircle className="h-4 w-4 text-blue-500" />;
    case 'PENDING':
      return <MinusCircle className="h-4 w-4 text-gray-400" />;
    case 'RUNNING':
      return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
    default:
      return <MinusCircle className="h-4 w-4 text-gray-400" />;
  }
};

const getStatusBadgeClass = (status: DisplayStatus) => {
  switch (status) {
    case 'SUCCESS':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'TIMEOUT':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'FAILED':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'WARNING':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'PARTIAL':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'PENDING':
    case 'RUNNING':
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const getImpactBadgeClass = (impact: string | null | undefined) => {
  switch (impact) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'HIGH':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'LOW':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const computeImpactFromStatus = (status: string, stepName: string): string => {
  if (status === 'FAILED') {
    if (stepName.toLowerCase().includes('vulnerability') || stepName.toLowerCase().includes('exploitation')) {
      return 'CRITICAL';
    }
    return 'HIGH';
  }
  if (status === 'TIMEOUT') {
    return 'MEDIUM';
  }
  if (status === 'SKIPPED') {
    return 'LOW';
  }
  return 'LOW';
};

const computeSolutionFromStatus = (status: string, error: string | null | undefined): string => {
  if (status === 'TIMEOUT') {
    return 'Augmenter le timeout ou réduire la portée du scan';
  }
  if (status === 'FAILED') {
    if (error?.toLowerCase().includes('connection')) {
      return 'Vérifier la connectivité réseau';
    }
    return "Vérifier la configuration de l'outil";
  }
  if (status === 'SKIPPED') {
    return 'Étape ignorée par le workflow';
  }
  return "Réessayer l'exécution";
};

export function ToolErrorsTable({ steps, singleToolRun }: ToolErrorsTableProps) {
  // Filter to only show steps with errors (not SUCCESS/COMPLETED)
  const errorSteps = steps.filter(step =>
    step.status !== 'COMPLETED' && step.status !== 'PENDING' && step.status !== 'RUNNING'
  );

  // For single tool runs, show a card instead of a table
  if (singleToolRun) {
    const status = mapStatusToDisplay(singleToolRun.status);
    const hasError = status === 'FAILED' || status === 'TIMEOUT' || status === 'WARNING';

    if (!hasError && singleToolRun.exitCode === 0) {
      return null; // Don't show anything if the tool ran successfully
    }

    const impact = computeImpactFromStatus(singleToolRun.status, singleToolRun.toolName);
    const solution = computeSolutionFromStatus(singleToolRun.status, singleToolRun.error);

    return (
      <Card className="border-orange-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {getStatusIcon(status)}
            Statut d&apos;exécution
          </CardTitle>
          <CardDescription>
            Informations sur l&apos;exécution de l&apos;outil
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Outil</div>
              <div className="font-medium">{singleToolRun.toolName}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Statut</div>
              <Badge className={getStatusBadgeClass(status)}>{status}</Badge>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Impact</div>
              <Badge className={getImpactBadgeClass(impact)}>{impact}</Badge>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Code de sortie</div>
              <span className={singleToolRun.exitCode === 0 ? 'text-green-600' : 'text-red-600'}>
                {singleToolRun.exitCode ?? 'N/A'}
              </span>
            </div>
          </div>
          {singleToolRun.error && (
            <div className="mt-4">
              <div className="text-sm text-muted-foreground mb-1">Erreur</div>
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                {singleToolRun.error}
              </div>
            </div>
          )}
          <div className="mt-4">
            <div className="text-sm text-muted-foreground mb-1">Solution</div>
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
              {solution}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No errors to display
  if (errorSteps.length === 0) {
    // Check if all steps completed successfully
    const allSuccess = steps.every(s => s.status === 'COMPLETED');
    if (allSuccess && steps.length > 0) {
      return (
        <div className="flex items-center justify-center py-8 text-green-600">
          <CheckCircle className="mr-2 h-5 w-5" />
          Tous les outils ont été exécutés avec succès
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        Aucun problème d&apos;exécution détecté
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Outil</TableHead>
            <TableHead className="w-[120px]">Statut</TableHead>
            <TableHead>Erreur</TableHead>
            <TableHead className="w-[100px]">Impact</TableHead>
            <TableHead>Solution</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {errorSteps.map((step) => {
            const displayStatus = mapStatusToDisplay(step.status);
            const impact = step.errorImpact || computeImpactFromStatus(step.status, step.name);
            const solution = step.errorSolution || computeSolutionFromStatus(step.status, step.error);

            return (
              <TableRow key={step.id}>
                <TableCell>
                  <div className="font-medium">{step.tool || step.name}</div>
                  {step.tool && step.name !== step.tool && (
                    <div className="text-xs text-muted-foreground">{step.name}</div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(displayStatus)}
                    <Badge className={getStatusBadgeClass(displayStatus)}>
                      {displayStatus}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  {step.error ? (
                    <p className="text-sm text-red-600 line-clamp-2">{step.error}</p>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={getImpactBadgeClass(impact)}>
                    {impact}
                  </Badge>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-muted-foreground">{solution}</p>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
