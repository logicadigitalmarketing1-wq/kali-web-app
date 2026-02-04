'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// SSE must connect directly to API (Next.js rewrites buffer responses and break SSE)
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3254';

export interface RunStreamEvent {
  runId: string;
  type: 'init' | 'output' | 'tool_start' | 'tool_complete' | 'progress' | 'completed' | 'failed' | 'status';
  data: {
    chunk?: string;
    toolName?: string;
    toolIndex?: number;
    totalTools?: number;
    progress?: number;
    phase?: string;
    error?: string;
    duration?: number;
    timestamp: string;
    run?: unknown;
  };
}

interface UseRunStreamOptions {
  runId: string | null;
  enabled?: boolean;
}

interface UseRunStreamResult {
  output: string;
  progress: number;
  phase: string;
  currentTool: string | null;
  isStreaming: boolean;
  isConnected: boolean;
  error: string | null;
  isCompleted: boolean;
  isFailed: boolean;
}

interface RunData {
  id: string;
  status: string;
  artifacts?: Array<{
    type: string;
    content?: string;
  }>;
  error?: string;
}

export function useRunStream({ runId, enabled = true }: UseRunStreamOptions): UseRunStreamResult {
  const [output, setOutput] = useState('');
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isFailed, setIsFailed] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousOutputLengthRef = useRef(0);

  // Fallback polling function (used if SSE fails)
  const fetchRunStatus = useCallback(async () => {
    if (!runId || !enabled) return;

    try {
      const response = await fetch(`/api/runs/${runId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch run status');
      }

      const run: RunData = await response.json();

      setIsConnected(true);
      setError(null);

      // Get stdout artifact
      const stdout = run.artifacts?.find((a) => a.type === 'stdout');
      const newOutput = stdout?.content || '';

      // Check if there's new output
      if (newOutput.length > previousOutputLengthRef.current) {
        setOutput(newOutput);
        previousOutputLengthRef.current = newOutput.length;
        setIsStreaming(true);
      }

      // Update based on status
      if (run.status === 'RUNNING') {
        setIsStreaming(true);
        setPhase('Executing...');
        const estimatedProgress = Math.min((newOutput.length / 5000) * 100, 95);
        setProgress(estimatedProgress);
      } else if (run.status === 'COMPLETED') {
        setIsCompleted(true);
        setIsStreaming(false);
        setProgress(100);
        setPhase('Completed');
        stopFallbackPolling();
      } else if (run.status === 'FAILED') {
        setIsFailed(true);
        setIsStreaming(false);
        setError(run.error || 'Run failed');
        stopFallbackPolling();
      }
    } catch (err) {
      console.error('Failed to fetch run status:', err);
      setError(err instanceof Error ? err.message : 'Connection error');
      setIsConnected(false);
    }
  }, [runId, enabled]);

  const stopFallbackPolling = useCallback(() => {
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
  }, []);

  const startFallbackPolling = useCallback(() => {
    stopFallbackPolling();
    fallbackIntervalRef.current = setInterval(fetchRunStatus, 1000);
  }, [fetchRunStatus, stopFallbackPolling]);

  // Reset state when runId changes
  useEffect(() => {
    setOutput('');
    setProgress(0);
    setPhase('');
    setCurrentTool(null);
    setIsStreaming(false);
    setIsConnected(false);
    setError(null);
    setIsCompleted(false);
    setIsFailed(false);
    previousOutputLengthRef.current = 0;
  }, [runId]);

  // Main effect: Connect to SSE stream
  useEffect(() => {
    if (!runId || !enabled) {
      // Cleanup
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      stopFallbackPolling();
      return;
    }

    // Try to connect via SSE first
    const connectSSE = () => {
      try {
        // Connect DIRECTLY to API for SSE (Next.js rewrites buffer and break SSE)
        const sseUrl = `${API_URL}/api/runs/${runId}/stream`;
        console.log(`[SSE] Connecting to ${sseUrl}`);
        const eventSource = new EventSource(sseUrl, {
          withCredentials: true,
        });
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          console.log(`[SSE] Connected to run ${runId}`);
          setIsConnected(true);
          setIsStreaming(true);
          setError(null);
          // Stop fallback polling if SSE connects
          stopFallbackPolling();
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[SSE] Received event:', data.type, data);

            switch (data.type) {
              case 'connected':
                console.log('[SSE] Stream connected for run:', data.runId);
                setIsConnected(true);
                setIsStreaming(true);
                break;

              case 'init':
                setOutput('');
                setProgress(5);
                setPhase('Initializing...');
                break;

              case 'output':
                if (data.data?.chunk) {
                  setOutput((prev) => prev + data.data.chunk);
                }
                break;

              case 'tool_start':
                setCurrentTool(data.data?.toolName || null);
                setPhase(`Running ${data.data?.toolName || 'tool'}...`);
                break;

              case 'tool_complete':
                setCurrentTool(null);
                break;

              case 'progress':
                setProgress(data.data?.progress || 0);
                setPhase(data.data?.phase || '');
                break;

              case 'completed':
                setIsCompleted(true);
                setIsStreaming(false);
                setProgress(100);
                setPhase('Completed');
                eventSource.close();
                break;

              case 'failed':
                setIsFailed(true);
                setIsStreaming(false);
                setError(data.data?.error || 'Run failed');
                eventSource.close();
                break;

              case 'status':
                // Status update from polling
                if (data.run) {
                  const run = data.run as RunData;
                  if (run.status === 'COMPLETED') {
                    setIsCompleted(true);
                    setIsStreaming(false);
                    setProgress(100);
                    eventSource.close();
                  } else if (run.status === 'FAILED') {
                    setIsFailed(true);
                    setIsStreaming(false);
                    setError(run.error || 'Run failed');
                    eventSource.close();
                  }
                }
                break;
            }
          } catch (e) {
            console.error('[SSE] Failed to parse event:', e);
          }
        };

        eventSource.onerror = (err) => {
          console.warn('[SSE] Connection error, falling back to polling', err);
          setIsConnected(false);
          eventSource.close();
          eventSourceRef.current = null;

          // Only start fallback if not completed/failed
          if (!isCompleted && !isFailed) {
            console.log('[SSE] Starting fallback polling...');
            fetchRunStatus(); // Initial fetch
            startFallbackPolling();
          }
        };
      } catch (err) {
        console.error('[SSE] Failed to create EventSource:', err);
        // Fallback to polling
        fetchRunStatus();
        startFallbackPolling();
      }
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      stopFallbackPolling();
    };
  }, [runId, enabled, fetchRunStatus, startFallbackPolling, stopFallbackPolling, isCompleted, isFailed]);

  return {
    output,
    progress,
    phase,
    currentTool,
    isStreaming,
    isConnected,
    error,
    isCompleted,
    isFailed,
  };
}
