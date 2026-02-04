'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Shield, CheckCircle, Sparkles, RefreshCw, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { VulnerabilityTable, type VulnerabilityFinding } from '@/components/scan-analysis/vulnerability-table';
import { ToolErrorsTable, type ToolStep } from '@/components/scan-analysis/tool-errors-table';

interface AIRecommendation {
  id: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  affectedFindings: string[];
  steps: string[];
  technicalDetails?: {
    commands?: string[];
    configFiles?: string[];
    tools?: string[];
    references?: string[];
  };
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface SmartScanFinding {
  id: string;
  title: string;
  description: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence?: number;
  category: string;
  cveId?: string | null;
  cweId?: string | null;
  tool?: string;
  target?: string;
  location?: string | null;
  evidence?: string;
  remediation?: string;
  exploitation?: string;
  verification?: string;
  references?: string[];
  status: string;
}

interface SmartScanStep {
  id: string;
  name: string;
  tool?: string | null;
  status: string;
  error?: string | null;
  errorImpact?: string | null;
  errorSolution?: string | null;
  executionTime?: number | null;
}

interface SmartScanReportProps {
  report: {
    summary?: {
      target?: string;
      totalVulnerabilities?: number;
      highVulnerabilities?: number;
      criticalVulnerabilities?: number;
      riskScore?: number;
      scanDuration?: number;
    };
    findings?: SmartScanFinding[];
    recommendations?: string[];
  };
  findings?: SmartScanFinding[];
  steps?: SmartScanStep[];
  sessionId?: string;
  runId?: string;
  onFindingDeleted?: (findingId: string) => void;
  onToolDeleted?: (tool: string) => void;
}

export function SmartScanReport({
  report,
  findings: externalFindings,
  steps = [],
  sessionId,
  runId,
  onFindingDeleted,
}: SmartScanReportProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('vulnerabilities');
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[] | null>(null);
  const [aiExecutiveSummary, setAiExecutiveSummary] = useState<string | null>(null);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [expandedRecommendations, setExpandedRecommendations] = useState<Set<string>>(new Set());

  const fetchAIRecommendations = useCallback(async () => {
    // Support both sessionId (smart-scan) and runId (runs)
    if ((!sessionId && !runId) || aiRecommendations) return;

    setLoadingRecommendations(true);
    setRecommendationsError(null);

    try {
      // Use appropriate endpoint based on what ID is available
      const endpoint = sessionId
        ? `/api/smart-scan/${sessionId}/recommendations`
        : `/api/runs/${runId}/recommendations`;

      const response = await fetch(endpoint, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to generate recommendations');
      }

      const data = await response.json();
      const result = data.data || data;
      setAiRecommendations(result.recommendations || []);
      setAiExecutiveSummary(result.executiveSummary || null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setRecommendationsError(errorMessage);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer les recommandations IA. Veuillez réessayer.',
        variant: 'destructive',
      });
    } finally {
      setLoadingRecommendations(false);
    }
  }, [sessionId, runId, aiRecommendations, toast]);

  useEffect(() => {
    if (activeTab === 'recommendations' && (sessionId || runId) && !aiRecommendations && !loadingRecommendations) {
      fetchAIRecommendations();
    }
  }, [activeTab, sessionId, runId, aiRecommendations, loadingRecommendations, fetchAIRecommendations]);

  const toggleRecommendation = (id: string) => {
    setExpandedRecommendations(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
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

  const getEffortIcon = (effort: string) => {
    switch (effort) {
      case 'LOW':
        return '⚡';
      case 'MEDIUM':
        return '⏱️';
      case 'HIGH':
        return '🔧';
      default:
        return '📋';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'REMEDIATION':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'TOOL_OPTIMIZATION':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'DEEP_ANALYSIS':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'REMEDIATION':
        return '🛡️ Remédiation';
      case 'TOOL_OPTIMIZATION':
        return '⚙️ Optimisation';
      case 'DEEP_ANALYSIS':
        return '🔍 Approfondissement';
      default:
        return category;
    }
  };

  // Use external findings if provided, otherwise fall back to report findings
  const allFindings = externalFindings || report.findings || [];

  // Map findings to VulnerabilityFinding format
  const vulnerabilityFindings: VulnerabilityFinding[] = allFindings.map(f => ({
    id: f.id,
    title: f.title,
    description: f.description,
    severity: f.severity,
    cveId: f.cveId,
    cweId: f.cweId,
    target: f.target,
    location: f.location,
    evidence: f.evidence,
    remediation: f.remediation,
    exploitation: f.exploitation,
    verification: f.verification,
    tool: f.tool,
    references: f.references,
  }));

  // Map steps to ToolStep format
  const toolSteps: ToolStep[] = steps.map(s => ({
    id: s.id,
    name: s.name,
    tool: s.tool,
    status: s.status,
    error: s.error,
    errorImpact: s.errorImpact,
    errorSolution: s.errorSolution,
    executionTime: s.executionTime,
  }));

  // Calculate counts for severity summary
  const severityCounts = {
    CRITICAL: allFindings.filter(f => f.severity === 'CRITICAL').length,
    HIGH: allFindings.filter(f => f.severity === 'HIGH').length,
    MEDIUM: allFindings.filter(f => f.severity === 'MEDIUM').length,
    LOW: allFindings.filter(f => f.severity === 'LOW').length,
    INFO: allFindings.filter(f => f.severity === 'INFO').length,
  };

  const summary = report.summary || {
    target: 'Unknown',
    totalVulnerabilities: allFindings.length,
    highVulnerabilities: severityCounts.HIGH,
    criticalVulnerabilities: severityCounts.CRITICAL,
    riskScore: 0,
    scanDuration: 0,
  };

  const recommendations = report.recommendations || [
    'Traiter immédiatement les vulnérabilités critiques et élevées',
    'Implémenter une validation des entrées pour prévenir les injections',
    'Mettre à jour régulièrement les systèmes et applications',
    'Effectuer des audits de sécurité réguliers',
  ];

  const getRiskLevel = (score: number) => {
    if (score >= 80) return { level: 'Critique', color: 'text-red-600' };
    if (score >= 60) return { level: 'Élevé', color: 'text-orange-600' };
    if (score >= 40) return { level: 'Moyen', color: 'text-yellow-600' };
    if (score >= 20) return { level: 'Faible', color: 'text-blue-600' };
    return { level: 'Minimal', color: 'text-green-600' };
  };

  const riskLevel = getRiskLevel(summary.riskScore || 0);

  const formatDuration = (milliseconds: number) => {
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

  const handleDeleteFinding = async (findingId: string) => {
    if (!sessionId && !runId) return;

    try {
      const endpoint = sessionId
        ? `/api/smart-scan/${sessionId}/findings/${findingId}`
        : `/api/findings/${findingId}`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete finding');
      }

      toast({
        title: 'Vulnérabilité supprimée',
        description: 'La vulnérabilité a été retirée du rapport.',
      });

      onFindingDeleted?.(findingId);
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer la vulnérabilité. Veuillez réessayer.',
        variant: 'destructive',
      });
    }
  };

  // Count error steps
  const errorStepsCount = steps.filter(s =>
    s.status !== 'COMPLETED' && s.status !== 'PENDING' && s.status !== 'RUNNING'
  ).length;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Rapport d&apos;Analyse de Sécurité</span>
            <Badge variant="outline" className={riskLevel.color}>
              Score de Risque: {summary.riskScore}/100 ({riskLevel.level})
            </Badge>
          </CardTitle>
          <CardDescription>
            Analyse de sécurité complète pour {summary.target}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Severity summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className={`text-center p-3 rounded-lg ${severityCounts.CRITICAL > 0 ? 'bg-red-50 dark:bg-red-950' : 'opacity-50'}`}>
              <div className="text-2xl font-bold text-red-600">{severityCounts.CRITICAL}</div>
              <div className="text-sm text-muted-foreground">Critique</div>
            </div>
            <div className={`text-center p-3 rounded-lg ${severityCounts.HIGH > 0 ? 'bg-orange-50 dark:bg-orange-950' : 'opacity-50'}`}>
              <div className="text-2xl font-bold text-orange-500">{severityCounts.HIGH}</div>
              <div className="text-sm text-muted-foreground">Élevé</div>
            </div>
            <div className={`text-center p-3 rounded-lg ${severityCounts.MEDIUM > 0 ? 'bg-yellow-50 dark:bg-yellow-950' : 'opacity-50'}`}>
              <div className="text-2xl font-bold text-yellow-600">{severityCounts.MEDIUM}</div>
              <div className="text-sm text-muted-foreground">Moyen</div>
            </div>
            <div className={`text-center p-3 rounded-lg ${severityCounts.LOW > 0 ? 'bg-blue-50 dark:bg-blue-950' : 'opacity-50'}`}>
              <div className="text-2xl font-bold text-blue-500">{severityCounts.LOW}</div>
              <div className="text-sm text-muted-foreground">Faible</div>
            </div>
            <div className={`text-center p-3 rounded-lg ${severityCounts.INFO > 0 ? 'bg-gray-50 dark:bg-gray-950' : 'opacity-50'}`}>
              <div className="text-2xl font-bold text-gray-500">{severityCounts.INFO}</div>
              <div className="text-sm text-muted-foreground">Info</div>
            </div>
          </div>

          {/* Duration */}
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Durée du scan: {formatDuration(summary.scanDuration || 0)}
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="vulnerabilities" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Vulnérabilités ({allFindings.length})
          </TabsTrigger>
          <TabsTrigger value="execution" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Problèmes d&apos;Exécution {errorStepsCount > 0 && `(${errorStepsCount})`}
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Recommandations IA
          </TabsTrigger>
          <TabsTrigger value="executive">Résumé Exécutif</TabsTrigger>
        </TabsList>

        {/* Section 1: Vulnerability Analysis */}
        <TabsContent value="vulnerabilities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Analyse des Vulnérabilités</CardTitle>
              <CardDescription>
                Cliquez sur une vulnérabilité pour voir les détails
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VulnerabilityTable
                findings={vulnerabilityFindings}
                onFindingDelete={(sessionId || runId) ? handleDeleteFinding : undefined}
                showDeleteButton={!!(sessionId || runId)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Section 2: Tool Errors & Problems */}
        <TabsContent value="execution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Erreurs & Problèmes d&apos;Outils</CardTitle>
              <CardDescription>
                Statut d&apos;exécution des outils de scan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ToolErrorsTable steps={toolSteps} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          {/* AI Executive Summary */}
          {aiExecutiveSummary && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  Résumé Exécutif IA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  {aiExecutiveSummary}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {loadingRecommendations && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center space-y-4 py-8">
                  <div className="relative">
                    <Sparkles className="h-8 w-8 text-blue-500 animate-pulse" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-900">Génération des recommandations IA...</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Analyse de {allFindings.length} vulnérabilités pour fournir des recommandations de sécurité actionables
                    </p>
                  </div>
                  <div className="h-1 w-48 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error State */}
          {recommendationsError && !loadingRecommendations && (
            <Card className="border-red-200">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center space-y-4 py-4">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                  <div className="text-center">
                    <p className="font-medium text-red-800">Échec de la génération des recommandations</p>
                    <p className="text-sm text-muted-foreground mt-1">{recommendationsError}</p>
                  </div>
                  <Button variant="outline" onClick={() => {
                    setAiRecommendations(null);
                    fetchAIRecommendations();
                  }}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Réessayer
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Recommendations */}
          {aiRecommendations && aiRecommendations.length > 0 && !loadingRecommendations && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold">Recommandations Prioritisées</h3>
                  <Badge variant="secondary">{aiRecommendations.length} actions</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAiRecommendations(null);
                    setAiExecutiveSummary(null);
                    fetchAIRecommendations();
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Regénérer
                </Button>
              </div>

              {aiRecommendations.map((rec) => {
                const isExpanded = expandedRecommendations.has(rec.id);
                return (
                  <Card key={rec.id} className="overflow-hidden">
                    <button
                      className="w-full text-left"
                      onClick={() => toggleRecommendation(rec.id)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge className={getPriorityColor(rec.priority)}>
                                {rec.priority}
                              </Badge>
                              <Badge className={getCategoryColor(rec.category)}>
                                {getCategoryLabel(rec.category)}
                              </Badge>
                              {rec.subcategory && (
                                <Badge variant="outline" className="text-xs">
                                  {rec.subcategory}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {getEffortIcon(rec.effort)} Effort {rec.effort}
                              </span>
                            </div>
                            <CardTitle className="text-base">{rec.title}</CardTitle>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                      </CardHeader>
                    </button>

                    {isExpanded && (
                      <CardContent className="pt-0 space-y-4">
                        <p className="text-sm text-muted-foreground">{rec.description}</p>

                        {rec.steps && rec.steps.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Étapes Techniques:
                            </h4>
                            <ol className="list-decimal list-inside space-y-2 bg-muted/30 rounded-lg p-3">
                              {rec.steps.map((step, i) => (
                                <li key={i} className="text-sm text-muted-foreground">
                                  {step.includes('`') ? (
                                    <span dangerouslySetInnerHTML={{
                                      __html: step.replace(/`([^`]+)`/g, '<code class="bg-gray-800 text-green-400 px-1 py-0.5 rounded text-xs font-mono">$1</code>')
                                    }} />
                                  ) : step}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {rec.technicalDetails?.commands && rec.technicalDetails.commands.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <Shield className="h-4 w-4 text-cyan-500" />
                              Commandes à Exécuter:
                            </h4>
                            <pre className="bg-gray-900 text-green-400 rounded-lg p-3 text-xs overflow-x-auto font-mono">
                              {rec.technicalDetails.commands.join('\n')}
                            </pre>
                          </div>
                        )}

                        {rec.technicalDetails?.configFiles && rec.technicalDetails.configFiles.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-yellow-500" />
                              Configurations à Modifier:
                            </h4>
                            <pre className="bg-gray-900 text-yellow-400 rounded-lg p-3 text-xs overflow-x-auto font-mono">
                              {rec.technicalDetails.configFiles.join('\n')}
                            </pre>
                          </div>
                        )}

                        {rec.technicalDetails?.tools && rec.technicalDetails.tools.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-purple-500" />
                              Outils Recommandés:
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {rec.technicalDetails.tools.map((tool, i) => (
                                <Badge key={i} className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                                  {tool}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {rec.technicalDetails?.references && rec.technicalDetails.references.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2">Références:</h4>
                            <div className="flex flex-wrap gap-2">
                              {rec.technicalDetails.references.map((ref, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {ref.startsWith('http') ? (
                                    <a href={ref} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                      {ref.length > 50 ? ref.substring(0, 50) + '...' : ref}
                                    </a>
                                  ) : ref}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {rec.affectedFindings && rec.affectedFindings.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2">Vulnérabilités Concernées:</h4>
                            <div className="flex flex-wrap gap-1">
                              {rec.affectedFindings.map((finding, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {finding}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-4 pt-2 border-t text-xs text-muted-foreground">
                          <span>Impact: <strong className={rec.impact === 'HIGH' ? 'text-green-500' : rec.impact === 'MEDIUM' ? 'text-yellow-500' : 'text-gray-500'}>{rec.impact}</strong></span>
                          <span>Effort: <strong className={rec.effort === 'LOW' ? 'text-green-500' : rec.effort === 'MEDIUM' ? 'text-yellow-500' : 'text-red-500'}>{rec.effort}</strong></span>
                          {rec.subcategory && <span>Type: <strong>{rec.subcategory}</strong></span>}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Fallback to static recommendations if AI not available */}
          {!aiRecommendations && !loadingRecommendations && !recommendationsError && (
            <Card>
              <CardHeader>
                <CardTitle>Recommandations de Sécurité</CardTitle>
                <CardDescription>
                  Actions prioritaires pour améliorer votre posture de sécurité
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {recommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <Shield className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Executive Summary Tab */}
        <TabsContent value="executive" className="space-y-4">
          {/* AI Executive Summary (when available) */}
          {aiExecutiveSummary && (
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  Analyse IA du Scan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  {aiExecutiveSummary}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Scan Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Statistiques Détaillées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Target and Duration */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted/30 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Cible</div>
                  <div className="font-mono text-sm mt-1 truncate">{summary.target}</div>
                </div>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Durée du Scan</div>
                  <div className="text-lg font-semibold mt-1">{formatDuration(summary.scanDuration || 0)}</div>
                </div>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Score de Risque</div>
                  <div className={`text-lg font-semibold mt-1 ${riskLevel.color}`}>
                    {summary.riskScore}/100 ({riskLevel.level})
                  </div>
                </div>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Vulnérabilités</div>
                  <div className="text-lg font-semibold mt-1">{summary.totalVulnerabilities}</div>
                </div>
              </div>

              {/* Severity Breakdown */}
              <div>
                <h4 className="font-medium mb-3">Répartition par Sévérité</h4>
                <div className="space-y-2">
                  {severityCounts.CRITICAL > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-24 text-sm font-medium text-red-600">Critique</div>
                      <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-600 rounded-full"
                          style={{ width: `${(severityCounts.CRITICAL / allFindings.length) * 100}%` }}
                        />
                      </div>
                      <div className="w-12 text-sm font-semibold text-right">{severityCounts.CRITICAL}</div>
                    </div>
                  )}
                  {severityCounts.HIGH > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-24 text-sm font-medium text-orange-500">Élevé</div>
                      <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded-full"
                          style={{ width: `${(severityCounts.HIGH / allFindings.length) * 100}%` }}
                        />
                      </div>
                      <div className="w-12 text-sm font-semibold text-right">{severityCounts.HIGH}</div>
                    </div>
                  )}
                  {severityCounts.MEDIUM > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-24 text-sm font-medium text-yellow-600">Moyen</div>
                      <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-500 rounded-full"
                          style={{ width: `${(severityCounts.MEDIUM / allFindings.length) * 100}%` }}
                        />
                      </div>
                      <div className="w-12 text-sm font-semibold text-right">{severityCounts.MEDIUM}</div>
                    </div>
                  )}
                  {severityCounts.LOW > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-24 text-sm font-medium text-blue-500">Faible</div>
                      <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(severityCounts.LOW / allFindings.length) * 100}%` }}
                        />
                      </div>
                      <div className="w-12 text-sm font-semibold text-right">{severityCounts.LOW}</div>
                    </div>
                  )}
                  {severityCounts.INFO > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-24 text-sm font-medium text-gray-500">Info</div>
                      <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gray-400 rounded-full"
                          style={{ width: `${(severityCounts.INFO / allFindings.length) * 100}%` }}
                        />
                      </div>
                      <div className="w-12 text-sm font-semibold text-right">{severityCounts.INFO}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tools Used */}
              {(() => {
                const toolsUsed = Array.from(new Set(allFindings.map(f => f.tool).filter((t): t is string => Boolean(t))));
                if (toolsUsed.length === 0) return null;
                return (
                  <div>
                    <h4 className="font-medium mb-3">Outils Utilisés</h4>
                    <div className="flex flex-wrap gap-2">
                      {toolsUsed.map((tool, i) => (
                        <Badge key={i} variant="secondary" className="text-sm">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Top Vulnerabilities */}
              {allFindings.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Vulnérabilités Prioritaires</h4>
                  <div className="space-y-2">
                    {allFindings
                      .filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH')
                      .slice(0, 5)
                      .map((f, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                          <Badge className={f.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}>
                            {f.severity}
                          </Badge>
                          <div>
                            <div className="font-medium text-sm">{f.title}</div>
                            {f.tool && <div className="text-xs text-muted-foreground">Outil: {f.tool}</div>}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Alert for Critical Issues */}
              {(summary.criticalVulnerabilities || 0) > 0 && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">Action Immédiate Requise</p>
                      <p className="text-sm text-red-700 mt-1">
                        {summary.criticalVulnerabilities} vulnérabilité(s) critique(s) ont été découvertes.
                        Ces problèmes présentent des risques de sécurité significatifs et doivent être traités en priorité.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* No Vulnerabilities Message */}
              {allFindings.length === 0 && (
                <div className="flex items-center justify-center py-8 text-green-600 bg-green-50 rounded-lg">
                  <CheckCircle className="mr-2 h-5 w-5" />
                  <span className="font-medium">Aucune vulnérabilité de sécurité détectée</span>
                </div>
              )}

              {/* Load AI Summary Prompt */}
              {!aiExecutiveSummary && !loadingRecommendations && allFindings.length > 0 && (
                <div className="text-center py-4 border-t">
                  <p className="text-sm text-muted-foreground mb-3">
                    Pour une analyse IA détaillée, consultez l&apos;onglet Recommandations IA
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveTab('recommendations');
                    }}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Générer l&apos;Analyse IA
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
