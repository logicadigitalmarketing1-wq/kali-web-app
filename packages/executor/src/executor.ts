import type { Logger } from 'pino';
import type { JobData, JobResult } from './index.js';

interface HexStrikeResponse {
  stdout: string;
  stderr: string;
  exit_code: number;
  duration: number;
}

export async function executeJob(
  data: JobData,
  hexstrikeUrl: string,
  logger: Logger,
): Promise<JobResult> {
  const startTime = Date.now();

  try {
    // Build command from template
    const command = buildCommand(data.commandTemplate, data.params, data.target);
    logger.info({ runId: data.runId, command }, 'Executing command');

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), data.timeout * 1000);

    try {
      const response = await fetch(`${hexstrikeUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: data.toolName,
          command,
          timeout: data.timeout,
          memory_limit: data.memoryLimit,
          cpu_limit: data.cpuLimit,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HexStrike returned ${response.status}: ${errorText}`);
      }

      const result = await response.json() as HexStrikeResponse;
      const duration = Math.round((Date.now() - startTime) / 1000);

      return {
        runId: data.runId,
        status: result.exit_code === 0 ? 'completed' : 'failed',
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exit_code,
        duration,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        const duration = Math.round((Date.now() - startTime) / 1000);
        return {
          runId: data.runId,
          status: 'timeout',
          stdout: '',
          stderr: `Tool execution timed out after ${data.timeout} seconds`,
          exitCode: null,
          duration,
          error: `Timeout after ${data.timeout}s`,
        };
      }

      throw error;
    }
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      runId: data.runId,
      status: 'failed',
      stdout: '',
      stderr: errorMessage,
      exitCode: null,
      duration,
      error: errorMessage,
    };
  }
}

function buildCommand(
  template: string[],
  params: Record<string, unknown>,
  target: string,
): string[] {
  const command: string[] = [];

  for (const part of template) {
    // Replace {{target}} placeholder
    if (part === '{{target}}') {
      command.push(target);
      continue;
    }

    // Replace {{param}} placeholders
    const paramMatch = part.match(/^\{\{(\w+)\}\}$/);
    if (paramMatch) {
      const paramName = paramMatch[1];
      const value = params[paramName];

      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'boolean') {
          // Boolean params only add the flag if true
          if (value) {
            command.push(part.replace(`{{${paramName}}}`, ''));
          }
        } else {
          command.push(String(value));
        }
      }
      continue;
    }

    // Check for embedded placeholders like "-p {{ports}}"
    const embeddedMatch = part.match(/\{\{(\w+)\}\}/g);
    if (embeddedMatch) {
      let processedPart = part;
      let hasValue = false;

      for (const match of embeddedMatch) {
        const paramName = match.slice(2, -2);
        const value = params[paramName];

        if (value !== undefined && value !== null && value !== '') {
          processedPart = processedPart.replace(match, String(value));
          hasValue = true;
        } else {
          // Remove the placeholder if no value
          processedPart = processedPart.replace(match, '');
        }
      }

      if (hasValue && processedPart.trim()) {
        command.push(processedPart);
      }
      continue;
    }

    // Static part
    command.push(part);
  }

  return command;
}
