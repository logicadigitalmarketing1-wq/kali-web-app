'use client';

import { useQuery } from '@tanstack/react-query';
import { Shield, AlertTriangle, ArrowLeft, TrendingUp, Activity, Target } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

// Calculate security score with diminishing returns and caps per severity
// INFO findings don't affect security score (they're informational)
function calculateSecurityScore(critical: number, high: number, medium: number, low: number): number {
  const criticalImpact = Math.min(40, critical * 15); // Max 40 points from criticals
  const highImpact = Math.min(30, high * 8);          // Max 30 points from highs
  const mediumImpact = Math.min(20, medium * 2);      // Max 20 points from mediums
  const lowImpact = Math.min(10, low * 0.5);          // Max 10 points from lows

  const score = 100 - criticalImpact - highImpact - mediumImpact - lowImpact;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Calculate individual impacts for display
function calculateImpacts(critical: number, high: number, medium: number, low: number) {
  return {
    critical: Math.min(40, critical * 15),
    high: Math.min(30, high * 8),
    medium: Math.min(20, medium * 2),
    low: Math.min(10, low * 0.5),
    info: 0, // INFO doesn't impact score
  };
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Bon';
  if (score >= 60) return 'Modéré';
  if (score >= 40) return 'Faible';
  return 'Critique';
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

export default function SecurityScorePage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: api.getDashboardStats,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const criticalCount = stats?.criticalFindings || 0;
  const highCount = stats?.highFindings || 0;
  const mediumCount = stats?.findingsBySeverity?.find(f => f.severity === 'MEDIUM')?.count || 0;
  const lowCount = stats?.findingsBySeverity?.find(f => f.severity === 'LOW')?.count || 0;
  const infoCount = stats?.findingsBySeverity?.find(f => f.severity === 'INFO')?.count || 0;
  const totalFindings = stats?.totalFindings || 0;

  const securityScore = calculateSecurityScore(criticalCount, highCount, mediumCount, lowCount);
  const impacts = calculateImpacts(criticalCount, highCount, mediumCount, lowCount);
  const totalDeductions = impacts.critical + impacts.high + impacts.medium + impacts.low;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Score de Sécurité</h1>
          <p className="text-muted-foreground">
            Analyse détaillée de votre posture de sécurité
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Main Score Card */}
        <Card className="lg:row-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Score Global
            </CardTitle>
            <CardDescription>
              Basé sur toutes les vulnérabilités détectées
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className={`text-7xl font-bold ${getScoreColor(securityScore)}`}>
              {securityScore}
            </div>
            <div className="text-2xl text-muted-foreground">/100</div>
            <Badge
              className={`mt-4 ${getScoreBgColor(securityScore)} text-white`}
            >
              {getScoreLabel(securityScore)}
            </Badge>
            <Progress
              value={securityScore}
              className="mt-6 w-full max-w-xs h-3"
            />

            {/* Deductions Display */}
            <div className="mt-6 p-4 bg-muted/30 rounded-lg w-full max-w-xs">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Déductions</span>
                <span className="font-bold text-red-500">
                  -{Math.round(totalDeductions)} points
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Calcul du Score
            </CardTitle>
            <CardDescription>
              Impact de chaque niveau de sévérité
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">CRITICAL</Badge>
                  <span className="text-sm text-muted-foreground">-15 pts (max 40)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{criticalCount}</span>
                  <span className="text-red-500 font-medium w-16 text-right">
                    {impacts.critical > 0 ? `-${Math.round(impacts.critical)}` : '0'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-500">HIGH</Badge>
                  <span className="text-sm text-muted-foreground">-8 pts (max 30)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{highCount}</span>
                  <span className="text-orange-500 font-medium w-16 text-right">
                    {impacts.high > 0 ? `-${Math.round(impacts.high)}` : '0'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-500">MEDIUM</Badge>
                  <span className="text-sm text-muted-foreground">-2 pts (max 20)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{mediumCount}</span>
                  <span className="text-yellow-500 font-medium w-16 text-right">
                    {impacts.medium > 0 ? `-${Math.round(impacts.medium)}` : '0'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500">LOW</Badge>
                  <span className="text-sm text-muted-foreground">-0.5 pts (max 10)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{lowCount}</span>
                  <span className="text-blue-500 font-medium w-16 text-right">
                    {impacts.low > 0 ? `-${Math.round(impacts.low)}` : '0'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">INFO</Badge>
                  <span className="text-sm text-muted-foreground">0 pts (informatif)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{infoCount}</span>
                  <span className="text-gray-500 font-medium w-16 text-right">
                    0
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Score de départ</span>
                <span className="font-mono">100</span>
              </div>
              <div className="flex items-center justify-between text-red-500">
                <span>Total déductions</span>
                <span className="font-mono">-{Math.round(totalDeductions)}</span>
              </div>
              <div className="flex items-center justify-between text-lg font-bold pt-2 border-t">
                <span>Score Final</span>
                <span className={getScoreColor(securityScore)}>{securityScore}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Statistiques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/30 rounded-lg text-center">
                <div className="text-3xl font-bold">{totalFindings}</div>
                <div className="text-sm text-muted-foreground">Total Vulnérabilités</div>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg text-center">
                <div className="text-3xl font-bold">{stats?.totalRuns || 0}</div>
                <div className="text-sm text-muted-foreground">Scans Exécutés</div>
              </div>
              <div className="p-4 bg-red-500/10 rounded-lg text-center">
                <div className="text-3xl font-bold text-red-500">{criticalCount + highCount}</div>
                <div className="text-sm text-muted-foreground">Vulns Critiques/Hautes</div>
              </div>
              <div className="p-4 bg-green-500/10 rounded-lg text-center">
                <div className="text-3xl font-bold text-green-500">{stats?.completedRuns || 0}</div>
                <div className="text-sm text-muted-foreground">Scans Complétés</div>
              </div>
            </div>

            {/* Severity Distribution Bar */}
            {totalFindings > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-2">Répartition par Sévérité</h4>
                <div className="h-4 rounded-full overflow-hidden flex">
                  {criticalCount > 0 && (
                    <div
                      className="bg-red-500 h-full"
                      style={{ width: `${(criticalCount / totalFindings) * 100}%` }}
                      title={`Critical: ${criticalCount}`}
                    />
                  )}
                  {highCount > 0 && (
                    <div
                      className="bg-orange-500 h-full"
                      style={{ width: `${(highCount / totalFindings) * 100}%` }}
                      title={`High: ${highCount}`}
                    />
                  )}
                  {mediumCount > 0 && (
                    <div
                      className="bg-yellow-500 h-full"
                      style={{ width: `${(mediumCount / totalFindings) * 100}%` }}
                      title={`Medium: ${mediumCount}`}
                    />
                  )}
                  {lowCount > 0 && (
                    <div
                      className="bg-blue-500 h-full"
                      style={{ width: `${(lowCount / totalFindings) * 100}%` }}
                      title={`Low: ${lowCount}`}
                    />
                  )}
                  {infoCount > 0 && (
                    <div
                      className="bg-gray-400 h-full"
                      style={{ width: `${(infoCount / totalFindings) * 100}%` }}
                      title={`Info: ${infoCount}`}
                    />
                  )}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Critique</span>
                  <span>Info</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Comment Améliorer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {criticalCount > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-500">Priorité Urgente</p>
                  <p className="text-sm">
                    Corriger {criticalCount} vulnérabilité{criticalCount > 1 ? 's' : ''} critique{criticalCount > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gain potentiel: +{Math.round(impacts.critical)} points
                  </p>
                  <Link href="/findings?severity=CRITICAL">
                    <Button variant="link" className="h-auto p-0 text-red-500 text-sm">
                      Voir les vulnérabilités critiques →
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {highCount > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-orange-500">Haute Priorité</p>
                  <p className="text-sm">
                    Traiter {highCount} vulnérabilité{highCount > 1 ? 's' : ''} de sévérité haute
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gain potentiel: +{Math.round(impacts.high)} points
                  </p>
                  <Link href="/findings?severity=HIGH">
                    <Button variant="link" className="h-auto p-0 text-orange-500 text-sm">
                      Voir les vulnérabilités hautes →
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {criticalCount === 0 && highCount === 0 && mediumCount > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <Activity className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-yellow-500">Priorité Moyenne</p>
                  <p className="text-sm">
                    Examiner {mediumCount} vulnérabilité{mediumCount > 1 ? 's' : ''} de sévérité moyenne
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gain potentiel: +{Math.round(impacts.medium)} points
                  </p>
                  <Link href="/findings?severity=MEDIUM">
                    <Button variant="link" className="h-auto p-0 text-yellow-500 text-sm">
                      Voir les vulnérabilités moyennes →
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {totalFindings === 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <Shield className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-500">Score Parfait!</p>
                  <p className="text-sm">
                    Aucune vulnérabilité détectée. Continuez à effectuer des scans réguliers.
                  </p>
                  <Link href="/tools">
                    <Button variant="link" className="h-auto p-0 text-green-500 text-sm">
                      Lancer un nouveau scan →
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {securityScore >= 80 && totalFindings > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <TrendingUp className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-500">Bonne Posture de Sécurité</p>
                  <p className="text-sm">
                    Votre score est excellent. Continuez à surveiller et corriger les vulnérabilités restantes.
                  </p>
                  <Link href="/findings">
                    <Button variant="link" className="h-auto p-0 text-green-500 text-sm">
                      Voir toutes les vulnérabilités →
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
