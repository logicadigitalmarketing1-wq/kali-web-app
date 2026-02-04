import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface HexStrikeResponse {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface ToolManifest {
  binary: string;
  commandTemplate?: string[];
  timeout?: number;
}

@Injectable()
export class HexStrikeService {
  private readonly logger = new Logger(HexStrikeService.name);
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('HEXSTRIKE_URL', 'http://localhost:8888');
    this.timeout = this.configService.get<number>('HEXSTRIKE_TIMEOUT', 300000);
  }

  async getHealth(): Promise<{ status: string; tools_available: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        this.logger.warn(`HexStrike health check failed: ${response.status} ${response.statusText}`);
        return { status: 'error', tools_available: 0 };
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        this.logger.warn(`HexStrike health check returned non-JSON response`);
        return { status: 'error', tools_available: 0 };
      }

      const data = await response.json();
      return {
        status: data.status || 'unknown',
        tools_available: data.total_tools_available || 0,
      };
    } catch (error) {
      this.logger.error(`HexStrike health check failed:`, error);
      return { status: 'unreachable', tools_available: 0 };
    }
  }

  async getAvailableTools(): Promise<string[]> {
    const health = await this.getHealth();
    return Object.entries((health as any).tools_status || {})
      .filter(([, available]) => available)
      .map(([tool]) => tool);
  }

  /**
   * Clear HexStrike cache and prepare for new scan
   * This helps ensure a fresh state before starting scans
   */
  async clearCacheAndPrepare(): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log('Clearing HexStrike cache and preparing for new scan...');

      // Clear the cache
      const clearResponse = await fetch(`${this.baseUrl}/api/cache/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (!clearResponse.ok) {
        this.logger.warn(`Failed to clear HexStrike cache: ${clearResponse.status}`);
      }

      // Verify health after clearing
      const health = await this.getHealth();

      if (health.status === 'unreachable') {
        return {
          success: false,
          message: 'HexStrike is not reachable. Please ensure the container is running.'
        };
      }

      this.logger.log(`HexStrike ready: ${health.tools_available} tools available`);
      return {
        success: true,
        message: `HexStrike ready with ${health.tools_available} tools available`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to prepare HexStrike: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to prepare HexStrike: ${errorMessage}`
      };
    }
  }

  async executeTool(
    tool: string,
    params: Record<string, unknown>,
    target: string,
    timeout?: number,
    manifest?: ToolManifest,
  ): Promise<HexStrikeResponse> {
    this.logger.log(`Executing tool: ${tool} against ${target}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      timeout ? timeout * 1000 : this.timeout,
    );

    try {
      // Build the command string from tool, params, and target
      const commandArray = manifest?.commandTemplate
        ? this.buildCommandFromTemplate(manifest.commandTemplate, params, target)
        : this.buildCommand(tool, params, target);
      const commandString = commandArray.join(' ');

      this.logger.log(`Command: ${commandString}`);

      const response = await fetch(`${this.baseUrl}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: commandString,
          use_cache: true,
        }),
        signal: controller.signal,
      });

      // Check if response is OK before parsing
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMessage = `HexStrike MCP returned ${response.status} ${response.statusText}`;

        // Try to get error details if response is JSON
        if (contentType?.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            // Failed to parse error JSON, use status message
          }
        }

        this.logger.error(`HexStrike execution failed: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      // Ensure response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        const text = await response.text();
        this.logger.error(`HexStrike returned non-JSON response: ${text.substring(0, 200)}`);
        throw new Error(
          `HexStrike MCP returned invalid response format (expected JSON, got ${contentType || 'unknown'})`,
        );
      }

      const result = await response.json();

      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.return_code || 0,
        duration: result.execution_time || 0,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Tool execution timed out after ${timeout}s`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildCommandFromTemplate(
    template: string[],
    params: Record<string, unknown>,
    target: string,
  ): string[] {
    // Build command from template by replacing {{placeholders}}
    const allParams: Record<string, unknown> = { ...params, target };

    return template.map((part) => {
      // Check if this part contains a placeholder like {{ports}}
      const match = part.match(/^\{\{(\w+)\}\}$/);
      if (match) {
        const paramName = match[1];
        const value = allParams[paramName];

        if (value === undefined || value === null || value === '') {
          return null; // Skip this part
        }

        return String(value);
      }

      // Static part of the command
      return part;
    }).filter((part): part is string => part !== null);
  }

  private buildCommand(
    tool: string,
    params: Record<string, unknown>,
    target: string,
  ): string[] {
    // Fallback for tools without a manifest template
    const args: string[] = [tool];

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'boolean') {
          if (value) args.push(`--${key}`);
        } else {
          const stringValue = String(value);
          args.push(`--${key}`);
          // Quote arguments that contain spaces or special characters
          if (stringValue.includes(' ') || /[;&|<>$`\\"]/.test(stringValue)) {
            args.push(`"${stringValue.replace(/"/g, '\\"')}"`);
          } else {
            args.push(stringValue);
          }
        }
      }
    }

    // Quote target if it contains spaces or special characters
    if (target.includes(' ') || /[;&|<>$`\\"]/.test(target)) {
      args.push(`"${target.replace(/"/g, '\\"')}"`);
    } else {
      args.push(target);
    }

    return args;
  }
}
