import Docker from 'dockerode';
import { z } from 'zod';
import { Logger } from 'pino';
import { config } from './config';
import {
  ToolManifestSchema,
  renderCommandTemplate,
  isValidHost,
  isIPInCIDR,
  hostMatchesPattern,
} from '@securescope/tool-schemas';

// ============================================================================
// Types
// ============================================================================

export const JobDataSchema = z.object({
  runId: z.string(),
  toolId: z.string(),
  toolName: z.string(),
  manifest: ToolManifestSchema,
  parameters: z.record(z.union([z.string(), z.number(), z.boolean()])),
  scope: z.object({
    id: z.string(),
    name: z.string(),
    allowedHosts: z.array(z.string()),
    allowedCidrs: z.array(z.string()),
  }),
  userId: z.string(),
  callbackUrl: z.string().optional(),
});

export type JobData = z.infer<typeof JobDataSchema>;

export interface ExecutionResult {
  runId: string;
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  containerId?: string;
  error?: string;
}

// ============================================================================
// Executor Service
// ============================================================================

export class ExecutorService {
  private docker: Docker;
  private logger: Logger;

  constructor(logger: Logger) {
    this.docker = new Docker({ socketPath: config.dockerSocket });
    this.logger = logger;
  }

  async executeJob(rawData: unknown): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Validate job data
    const parseResult = JobDataSchema.safeParse(rawData);
    if (!parseResult.success) {
      return {
        runId: (rawData as { runId?: string })?.runId || 'unknown',
        success: false,
        exitCode: null,
        stdout: '',
        stderr: '',
        durationMs: Date.now() - startTime,
        error: `Invalid job data: ${parseResult.error.message}`,
      };
    }

    const jobData = parseResult.data;
    const { runId, manifest, parameters, scope } = jobData;

    try {
      // Step 1: Validate parameters against schema
      this.validateParameters(manifest, parameters);

      // Step 2: Validate target is within scope
      this.validateScope(manifest, parameters, scope);

      // Step 3: Render command (no shell!)
      const commandArgv = this.renderCommand(manifest, parameters);

      this.logger.info({ runId, command: commandArgv }, 'Executing command');

      // Step 4: Execute in container
      const result = await this.executeInContainer(runId, manifest, commandArgv);

      return {
        runId,
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: this.redactOutput(result.stdout, manifest),
        stderr: this.redactOutput(result.stderr, manifest),
        durationMs: Date.now() - startTime,
        containerId: result.containerId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({ runId, error: errorMessage }, 'Execution failed');

      return {
        runId,
        success: false,
        exitCode: null,
        stdout: '',
        stderr: '',
        durationMs: Date.now() - startTime,
        error: errorMessage,
      };
    }
  }

  private validateParameters(
    manifest: z.infer<typeof ToolManifestSchema>,
    parameters: Record<string, string | number | boolean>
  ): void {
    for (const argDef of manifest.argsSchema) {
      const value = parameters[argDef.name];

      // Check required
      if (argDef.required && (value === undefined || value === null || value === '')) {
        throw new Error(`Missing required parameter: ${argDef.name}`);
      }

      if (value === undefined || value === null) continue;

      // Type-specific validation
      switch (argDef.type) {
        case 'host':
          if (!isValidHost(String(value))) {
            throw new Error(`Invalid host value for ${argDef.name}: ${value}`);
          }
          break;

        case 'port':
          const portNum = Number(value);
          const minPort = argDef.portRange?.min ?? 1;
          const maxPort = argDef.portRange?.max ?? 65535;
          if (isNaN(portNum) || portNum < minPort || portNum > maxPort) {
            throw new Error(`Invalid port value for ${argDef.name}: ${value}`);
          }
          break;

        case 'number':
          const num = Number(value);
          if (isNaN(num)) {
            throw new Error(`Invalid number for ${argDef.name}: ${value}`);
          }
          if (argDef.min !== undefined && num < argDef.min) {
            throw new Error(`${argDef.name} must be >= ${argDef.min}`);
          }
          if (argDef.max !== undefined && num > argDef.max) {
            throw new Error(`${argDef.name} must be <= ${argDef.max}`);
          }
          break;

        case 'string':
          const strValue = String(value);
          if (argDef.pattern) {
            const regex = new RegExp(argDef.pattern);
            if (!regex.test(strValue)) {
              throw new Error(`${argDef.name} does not match required pattern`);
            }
          }
          if (argDef.minLength !== undefined && strValue.length < argDef.minLength) {
            throw new Error(`${argDef.name} must be at least ${argDef.minLength} characters`);
          }
          if (argDef.maxLength !== undefined && strValue.length > argDef.maxLength) {
            throw new Error(`${argDef.name} must be at most ${argDef.maxLength} characters`);
          }
          break;

        case 'select':
          if (argDef.options) {
            const validValues = argDef.options.map((o) => o.value);
            if (!validValues.includes(String(value))) {
              throw new Error(`Invalid value for ${argDef.name}: ${value}`);
            }
          }
          break;

        case 'boolean':
          // Booleans are fine as-is
          break;
      }

      // Check allowlist
      if (argDef.allowedValues && !argDef.allowedValues.includes(String(value))) {
        throw new Error(`Value not in allowlist for ${argDef.name}`);
      }
    }
  }

  private validateScope(
    manifest: z.infer<typeof ToolManifestSchema>,
    parameters: Record<string, string | number | boolean>,
    scope: JobData['scope']
  ): void {
    if (!manifest.requiresScope) {
      return; // Tool doesn't require scope validation
    }

    // Find target parameters (host, url, target, etc.)
    const targetArgs = manifest.argsSchema.filter(
      (arg) => arg.type === 'host' || arg.type === 'url' || arg.name === 'target'
    );

    for (const targetArg of targetArgs) {
      const value = parameters[targetArg.name];
      if (!value) continue;

      let targetHost: string;

      if (targetArg.type === 'url') {
        try {
          const url = new URL(String(value));
          targetHost = url.hostname;
        } catch {
          throw new Error(`Invalid URL: ${value}`);
        }
      } else {
        targetHost = String(value);
      }

      if (!this.isHostAllowed(targetHost, scope)) {
        throw new Error(`Target ${targetHost} is not within allowed scope ${scope.name}`);
      }
    }
  }

  private isHostAllowed(host: string, scope: JobData['scope']): boolean {
    // Check host patterns
    for (const pattern of scope.allowedHosts) {
      if (hostMatchesPattern(host, pattern)) {
        return true;
      }
    }

    // Check CIDRs (only for IP addresses)
    if (/^[\d.]+$/.test(host)) {
      for (const cidr of scope.allowedCidrs) {
        if (isIPInCIDR(host, cidr)) {
          return true;
        }
      }
    }

    return false;
  }

  private renderCommand(
    manifest: z.infer<typeof ToolManifestSchema>,
    parameters: Record<string, string | number | boolean>
  ): string[] {
    // Process parameters with defaults
    const processedParams: Record<string, string | number | boolean | undefined> = {};

    for (const argDef of manifest.argsSchema) {
      const value = parameters[argDef.name];
      if (value !== undefined && value !== null && value !== '') {
        processedParams[argDef.name] = value;
      } else if (argDef.default !== undefined) {
        processedParams[argDef.name] = argDef.default;
      }
    }

    // Render template
    const argv = renderCommandTemplate(manifest.commandTemplate, processedParams);

    // Security: Ensure no shell metacharacters can cause injection
    // (Since we use execve-style execution, this is defense-in-depth)
    for (const arg of argv) {
      if (arg.includes('\0')) {
        throw new Error('Null bytes not allowed in command arguments');
      }
    }

    return argv;
  }

  private async executeInContainer(
    runId: string,
    manifest: z.infer<typeof ToolManifestSchema>,
    commandArgv: string[]
  ): Promise<{ exitCode: number; stdout: string; stderr: string; containerId: string }> {
    const timeout = Math.min(manifest.timeout ?? config.defaultTimeoutMs, config.maxTimeoutMs);
    const memoryLimit = manifest.resourceLimits?.memory ?? config.defaultMemoryLimit;
    const cpuLimit = manifest.resourceLimits?.cpu ?? config.defaultCpuLimit;
    const pidsLimit = manifest.resourceLimits?.pidsLimit ?? config.defaultPidsLimit;

    // Parse memory limit to bytes
    const memoryBytes = this.parseMemoryLimit(memoryLimit);
    const nanoCpus = this.parseCpuLimit(cpuLimit);

    // Build container config
    const containerConfig: Docker.ContainerCreateOptions = {
      Image: config.executorImage,
      Cmd: commandArgv,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      NetworkDisabled: manifest.networkMode === 'none',
      HostConfig: {
        Memory: memoryBytes,
        NanoCpus: nanoCpus,
        PidsLimit: pidsLimit,
        ReadonlyRootfs: manifest.readOnlyFilesystem ?? config.readOnlyRootFilesystem,
        SecurityOpt: config.noNewPrivileges ? ['no-new-privileges:true'] : [],
        CapDrop: config.dropAllCapabilities ? ['ALL'] : undefined,
        CapAdd: manifest.keepCapabilities,
        AutoRemove: true,
        // Tmpfs for writable temp directory
        Tmpfs: {
          '/tmp': 'rw,noexec,nosuid,size=64m',
        },
      },
      Labels: {
        'securescope.run-id': runId,
        'securescope.tool': manifest.name,
      },
    };

    // Create container
    const container = await this.docker.createContainer(containerConfig);
    const containerId = container.id;

    this.logger.debug({ runId, containerId }, 'Container created');

    try {
      // Start container
      await container.start();

      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Execution timeout')), timeout);
      });

      // Wait for completion
      const waitPromise = container.wait();

      const result = await Promise.race([waitPromise, timeoutPromise]);

      // Get logs
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        follow: false,
      });

      const { stdout, stderr } = this.parseLogs(logs);

      return {
        exitCode: result.StatusCode,
        stdout,
        stderr,
        containerId,
      };
    } catch (error) {
      // Try to kill container on error/timeout
      try {
        await container.kill();
      } catch {
        // Ignore kill errors
      }

      if (error instanceof Error && error.message === 'Execution timeout') {
        throw new Error(`Tool execution timed out after ${timeout}ms`);
      }

      throw error;
    }
  }

  private parseLogs(logs: Buffer | NodeJS.ReadableStream): { stdout: string; stderr: string } {
    // Docker logs are multiplexed with a header
    // See: https://docs.docker.com/engine/api/v1.41/#operation/ContainerLogs
    if (Buffer.isBuffer(logs)) {
      const stdout: string[] = [];
      const stderr: string[] = [];

      let offset = 0;
      while (offset < logs.length) {
        if (offset + 8 > logs.length) break;

        const header = logs.slice(offset, offset + 8);
        const streamType = header[0]; // 1 = stdout, 2 = stderr
        const size = header.readUInt32BE(4);

        if (offset + 8 + size > logs.length) break;

        const content = logs.slice(offset + 8, offset + 8 + size).toString('utf-8');

        if (streamType === 1) {
          stdout.push(content);
        } else if (streamType === 2) {
          stderr.push(content);
        }

        offset += 8 + size;
      }

      return {
        stdout: stdout.join(''),
        stderr: stderr.join(''),
      };
    }

    // Shouldn't happen with follow: false
    return { stdout: '', stderr: '' };
  }

  private parseMemoryLimit(limit: string): number {
    const match = limit.match(/^(\d+(?:\.\d+)?)(Ki?|Mi?|Gi?)?$/i);
    if (!match) {
      return 512 * 1024 * 1024; // Default 512Mi
    }

    const value = parseFloat(match[1]!);
    const unit = (match[2] || '').toLowerCase();

    switch (unit) {
      case 'k':
      case 'ki':
        return value * 1024;
      case 'm':
      case 'mi':
        return value * 1024 * 1024;
      case 'g':
      case 'gi':
        return value * 1024 * 1024 * 1024;
      default:
        return value;
    }
  }

  private parseCpuLimit(limit: string): number {
    const value = parseFloat(limit);
    // Docker uses nanoseconds for CPU
    return Math.floor(value * 1e9);
  }

  private redactOutput(output: string, manifest: z.infer<typeof ToolManifestSchema>): string {
    if (!manifest.redactionRules || manifest.redactionRules.length === 0) {
      return output;
    }

    let result = output;

    for (const rule of manifest.redactionRules) {
      const flags = rule.caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(rule.pattern, flags);
      result = result.replace(regex, rule.replacement);
    }

    // Always redact common secrets
    const commonSecrets = [
      { pattern: /(?:password|passwd|pwd)\s*[:=]\s*\S+/gi, replacement: '[PASSWORD REDACTED]' },
      { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*\S+/gi, replacement: '[API_KEY REDACTED]' },
      { pattern: /(?:secret|token)\s*[:=]\s*\S+/gi, replacement: '[SECRET REDACTED]' },
      { pattern: /-----BEGIN.*?PRIVATE KEY-----[\s\S]*?-----END.*?PRIVATE KEY-----/g, replacement: '[PRIVATE KEY REDACTED]' },
    ];

    for (const secret of commonSecrets) {
      result = result.replace(secret.pattern, secret.replacement);
    }

    return result;
  }
}
