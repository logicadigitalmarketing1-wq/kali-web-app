'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface SmartScanStep {
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

export interface SmartScanFinding {
  id: string;
  title: string;
  description: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence?: number;
  category: string;
  tool?: string;
  target?: string;
  evidence?: string;
  remediation?: string;
  references?: string[];
  status: string;
}

export interface SmartScanStatus {
  id: string;
  status: string;
  progress: number;
  currentPhase?: string;
  target: string;
  name?: string;
  steps: SmartScanStep[];
  findings: SmartScanFinding[];
  report?: {
    summary?: {
      totalVulnerabilities: number;
      highVulnerabilities: number;
      criticalVulnerabilities: number;
      riskScore: number;
    };
    recommendations?: string[];
  };
}

export interface LogEntry {
  timestamp: string;
  message: string;
}

interface UseSmartScanStreamResult {
  status: SmartScanStatus | null;
  logs: LogEntry[];
  isConnected: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSmartScanStream(sessionId: string | null): UseSmartScanStreamResult {
  const [status, setStatus] = useState<SmartScanStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousStepsRef = useRef<SmartScanStep[]>([]);
  const previousStatusRef = useRef<SmartScanStatus | null>(null);
  const isFirstLoadRef = useRef(true);
  const sessionIdRef = useRef(sessionId);

  // Keep sessionId ref in sync
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const addLog = useCallback((message: string) => {
    console.log('[SmartScan]', message);
    setLogs((prev) => [
      ...prev,
      { timestamp: new Date().toISOString(), message },
    ]);
  }, []);

  // Main fetch function - stable reference
  const fetchStatus = useCallback(async () => {
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) return;

    console.log('[SmartScan] Fetching status for:', currentSessionId);

    try {
      const response = await fetch(`/api/smart-scan/${currentSessionId}/status`, {
        credentials: 'include',
      });

      console.log('[SmartScan] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SmartScan] Error response:', errorText);
        throw new Error(`Failed to fetch scan status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[SmartScan] Result:', result);

      if (result.success) {
        const newStatus: SmartScanStatus = result.data;
        const prevStatus = previousStatusRef.current;

        // First load
        if (isFirstLoadRef.current && newStatus.steps && newStatus.steps.length > 0) {
          isFirstLoadRef.current = false;
          addLog(`Connected to scan: ${newStatus.target}`);
          addLog(`Status: ${newStatus.status}`);
          const runningStep = newStatus.steps.find((s) => s.status === 'RUNNING');
          if (runningStep) {
            addLog(`Currently running: ${runningStep.name}`);
          }
        }

        // Detect step changes and log them
        if (previousStepsRef.current.length > 0 && newStatus.steps) {
          newStatus.steps.forEach((step) => {
            const prevStep = previousStepsRef.current.find(
              (s) => s.stepNumber === step.stepNumber
            );
            if (prevStep && prevStep.status !== step.status) {
              if (step.status === 'RUNNING') {
                addLog(`Starting: ${step.name}`);
              } else if (step.status === 'COMPLETED') {
                addLog(`Completed: ${step.name}`);
              } else if (step.status === 'FAILED') {
                addLog(`Failed: ${step.name} - ${step.error || 'Unknown error'}`);
              }
            }
          });
        }

        // Store steps for next comparison
        if (newStatus.steps) {
          previousStepsRef.current = [...newStatus.steps];
        }

        // Log progress milestones
        if (prevStatus && newStatus.progress !== prevStatus.progress) {
          const progressDiff = newStatus.progress - prevStatus.progress;
          if (progressDiff >= 15) {
            addLog(`Progress: ${Math.round(newStatus.progress)}%`);
          }
        }

        // Log status changes (e.g., CREATED -> RUNNING)
        if (prevStatus && newStatus.status !== prevStatus.status) {
          if (prevStatus.status === 'CREATED' && newStatus.status === 'RUNNING') {
            addLog('Scan started! Processing...');
          }
        }

        // Log phase changes
        if (
          prevStatus &&
          newStatus.currentPhase !== prevStatus.currentPhase &&
          newStatus.currentPhase
        ) {
          addLog(`Phase: ${newStatus.currentPhase.replace(/_/g, ' ')}`);
        }

        // Log new findings
        if (prevStatus && newStatus.findings && newStatus.findings.length > (prevStatus.findings?.length || 0)) {
          const newFindings = newStatus.findings.slice(prevStatus.findings?.length || 0);
          newFindings.forEach((finding) => {
            addLog(`Found: ${finding.title} (${finding.severity})`);
          });
        }

        // Store for next comparison
        previousStatusRef.current = newStatus;

        setStatus(newStatus);
        setIsConnected(true);
        setError(null);

        // Check if scan is done
        if (
          newStatus.status === 'COMPLETED' ||
          newStatus.status === 'FAILED' ||
          newStatus.status === 'CANCELLED'
        ) {
          console.log('[SmartScan] Scan finished with status:', newStatus.status);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsConnected(false);

          if (newStatus.status === 'COMPLETED') {
            addLog('Scan completed successfully!');
          } else if (newStatus.status === 'FAILED') {
            addLog('Scan failed.');
          } else if (newStatus.status === 'CANCELLED') {
            addLog('Scan cancelled.');
          }
        }
      } else {
        console.error('[SmartScan] API returned success:false', result);
        setError(result.error?.message || 'Unknown error');
      }
    } catch (err) {
      console.error('[SmartScan] Failed to fetch status:', err);
      setError(err instanceof Error ? err.message : 'Connection error');
      setIsConnected(false);
    }
  }, [addLog]);

  // Start polling when sessionId changes
  useEffect(() => {
    console.log('[SmartScan] sessionId changed:', sessionId);

    // Cleanup previous interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!sessionId) {
      setStatus(null);
      setLogs([]);
      setIsConnected(false);
      previousStepsRef.current = [];
      previousStatusRef.current = null;
      isFirstLoadRef.current = true;
      return;
    }

    // Reset for new session
    setLogs([]);
    setError(null);
    previousStepsRef.current = [];
    previousStatusRef.current = null;
    isFirstLoadRef.current = true;

    // Initial fetch
    console.log('[SmartScan] Starting polling for:', sessionId);
    fetchStatus();

    // Poll every 1.5 seconds for real-time feel
    intervalRef.current = setInterval(() => {
      fetchStatus();
    }, 1500);

    return () => {
      console.log('[SmartScan] Cleanup for:', sessionId);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sessionId, fetchStatus]);

  return {
    status,
    logs,
    isConnected,
    error,
    refetch: fetchStatus,
  };
}
