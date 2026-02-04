import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HexStrikeService, ToolManifest } from './hexstrike.service';
import { ClaudeService } from './claude.service';
import * as dns from 'dns/promises';

// Tools that require IP addresses (no DNS resolution built-in)
const IP_ONLY_TOOLS = ['masscan', 'masscan_high_speed'];

export interface McpExecutionResult {
  analysis: string;
  toolsUsed: Array<{
    name: string;
    params: Record<string, unknown>;
    result: string;
    duration: number;
  }>;
  tokensUsed: number;
  stdout: string;
  stderr: string;
}

export interface StreamingCallbacks {
  onOutput?: (chunk: string) => void;
  onToolStart?: (toolName: string, toolIndex: number, totalTools: number) => void;
  onToolComplete?: (toolName: string, duration: number) => void;
  onProgress?: (progress: number, phase: string) => void;
}

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  private readonly hexstrikeBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hexstrike: HexStrikeService,
    private readonly claude: ClaudeService,
  ) {
    this.hexstrikeBaseUrl = process.env.HEXSTRIKE_URL || 'http://localhost:8888';
  }

  /**
   * Execute a tool directly via HexStrike (legacy method for backward compatibility)
   */
  async executeTool(
    tool: string,
    params: Record<string, unknown>,
    target: string,
    timeout?: number,
    manifest?: ToolManifest,
  ) {
    return this.hexstrike.executeTool(tool, params, target, timeout, manifest);
  }

  /**
   * Execute a tool using Claude with MCP tools (like Claude Desktop).
   * Claude decides the approach and executes tools via HexStrike MCP.
   */
  async executeToolWithClaude(
    tool: string,
    params: Record<string, unknown>,
    target: string,
    options?: {
      task?: string;
      maxIterations?: number;
    },
  ): Promise<McpExecutionResult> {
    if (!this.claude.isAvailable()) {
      this.logger.warn('Claude not available, falling back to direct execution');
      const result = await this.hexstrike.executeTool(tool, params, target);
      return {
        analysis: 'Claude analysis not available',
        toolsUsed: [{ name: tool, params, result: result.stdout, duration: result.duration }],
        tokensUsed: 0,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    }

    const task = options?.task || `Execute ${tool} scan on target ${target}`;

    // Execute via Claude with MCP tools
    const result = await this.claude.executeWithMcpTools(
      task,
      target,
      async (toolName: string, toolParams: Record<string, unknown>) => {
        return this.executeHexStrikeMcpTool(toolName, toolParams);
      },
      {
        maxIterations: options?.maxIterations ?? 5,
        specificTool: tool,
      },
    );

    // Combine all tool outputs
    const stdout = result.toolsUsed.map(t => `=== ${t.name} ===\n${t.result}`).join('\n\n');

    return {
      analysis: result.analysis,
      toolsUsed: result.toolsUsed,
      tokensUsed: result.tokensUsed,
      stdout,
      stderr: '',
    };
  }

  /**
   * Execute a tool directly via HexStrike MCP with streaming callbacks.
   * The tool is executed DIRECTLY without Claude deciding which tool to use.
   * Claude is used only for post-execution analysis.
   */
  async executeToolWithClaudeStreaming(
    tool: string,
    params: Record<string, unknown>,
    target: string,
    manifest: {
      commandTemplate?: string[];
      timeout?: number;
    },
    callbacks: StreamingCallbacks,
    _options?: {
      task?: string;
      maxIterations?: number;
    },
  ): Promise<McpExecutionResult> {
    const { onOutput, onToolStart, onToolComplete, onProgress } = callbacks;

    onProgress?.(5, `Preparing ${tool}`);
    onOutput?.(`=== Starting ${tool} ===\n`);
    onToolStart?.(tool, 1, 1);

    // Execute the requested tool DIRECTLY via HexStrike MCP
    // Do NOT let Claude choose which tool to use
    const startTime = Date.now();
    onProgress?.(10, `Executing ${tool}`);

    // Merge target into params if not already present
    const toolParams = { ...params };
    if (!toolParams.target && target) {
      toolParams.target = target;
    }

    // Use manifest timeout or default to 600 seconds (10 min) for security tools
    const toolTimeout = manifest.timeout || 600;

    const result = await this.executeHexStrikeMcpToolDirect(
      tool,
      toolParams,
      manifest.commandTemplate,
      toolTimeout,
      (chunk) => {
        onOutput?.(chunk);
      },
    );

    const duration = Date.now() - startTime;
    onToolComplete?.(tool, duration);

    // Emit any remaining output
    if (result.stdout) {
      onOutput?.(result.stdout);
    }
    if (result.stderr) {
      onOutput?.(`\n[stderr]\n${result.stderr}`);
    }

    onOutput?.(`\n=== ${tool} completed in ${duration}ms ===\n`);

    const toolsUsed = [{
      name: tool,
      params: toolParams,
      result: result.stdout || result.stderr || 'No output',
      duration,
    }];

    // Generate analysis with Claude if available, or provide fallback analysis
    let analysis = '';
    let tokensUsed = 0;

    const hasOutput = result.stdout || result.stderr;
    const hasError = result.exitCode !== 0 || result.stderr;

    if (this.claude.isAvailable() && result.stdout) {
      onProgress?.(80, 'Generating AI analysis');
      try {
        const analysisResult = await this.claude.analyzeToolOutput(
          tool,
          result.stdout,
          target,
        );
        analysis = analysisResult.summary + '\n\n' +
          'Observations:\n' + analysisResult.observations.map(o => `- ${o}`).join('\n') + '\n\n' +
          'Recommendations:\n' + analysisResult.recommendations.map(r => `- ${r}`).join('\n');
        tokensUsed = analysisResult.tokensUsed;
      } catch (error) {
        this.logger.warn(`Claude analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        analysis = `AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease review the tool output manually.`;
      }
    } else if (hasError) {
      // Tool execution failed - provide error analysis
      analysis = `Tool Execution Error\n\n` +
        `The ${tool} tool encountered an error during execution.\n\n` +
        `Exit Code: ${result.exitCode}\n` +
        (result.stderr ? `Error Output:\n${result.stderr}\n\n` : '') +
        `Recommendations:\n` +
        `- Review the error message above for details\n` +
        `- Verify the target is accessible and correctly formatted\n` +
        `- Check tool parameters and try again`;
    } else if (!this.claude.isAvailable()) {
      // Claude not available - provide basic analysis
      analysis = `Manual Review Required\n\n` +
        `Claude AI analysis is not available (ANTHROPIC_API_KEY not configured).\n\n` +
        `Tool: ${tool}\n` +
        `Target: ${target}\n` +
        `Duration: ${duration}ms\n` +
        `Exit Code: ${result.exitCode}\n\n` +
        `Please review the Output tab for detailed results.`;
    } else if (!hasOutput) {
      // No output at all
      analysis = `No Output Generated\n\n` +
        `The ${tool} tool completed but produced no output.\n\n` +
        `This may indicate:\n` +
        `- The target was not reachable\n` +
        `- No results matched the scan criteria\n` +
        `- The tool completed successfully with no findings`;
    }

    onProgress?.(100, 'Completed');

    return {
      analysis,
      toolsUsed,
      tokensUsed,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  /**
   * Execute a tool directly via HexStrike with real-time SSE streaming.
   * This method executes the EXACT tool requested without any AI-based tool selection.
   * Output is streamed line-by-line as it's generated (terminal-like behavior).
   */
  private async executeHexStrikeMcpToolDirect(
    toolName: string,
    params: Record<string, unknown>,
    commandTemplate?: string[],
    timeout: number = 600,
    onChunk?: (chunk: string) => void,
  ): Promise<{ stdout: string; stderr: string; exitCode: number; duration: number }> {
    this.logger.log(`Executing tool directly: ${toolName} with params: ${JSON.stringify(params)}`);

    // For tools that require IP addresses (like masscan), resolve hostnames first
    const resolvedParams = { ...params };
    if (this.toolRequiresIp(toolName) && resolvedParams.target) {
      const target = String(resolvedParams.target);
      if (!this.isIpAddress(target)) {
        onChunk?.(`[info] Resolving hostname ${target} to IP address (masscan requires IP addresses)...\n`);
        try {
          const resolvedIp = await this.resolveHostname(target);
          onChunk?.(`[info] Resolved ${target} → ${resolvedIp}\n`);
          resolvedParams.target = resolvedIp;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'DNS resolution failed';
          onChunk?.(`[error] ${errorMessage}\n`);
          return {
            stdout: '',
            stderr: errorMessage,
            exitCode: 1,
            duration: 0,
          };
        }
      }
    }

    // Build command string - prefer commandTemplate from manifest if available
    let commandString: string;
    if (commandTemplate && commandTemplate.length > 0) {
      commandString = this.buildCommandFromTemplate(commandTemplate, resolvedParams);
      this.logger.log(`Built command from template: ${commandString}`);
    } else {
      commandString = this.buildCommandStringDirect(toolName, resolvedParams);
      this.logger.log(`Built command from direct mapping: ${commandString}`);
    }

    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      // Use the new streaming endpoint for real-time output
      const response = await fetch(`${this.hexstrikeBaseUrl}/api/command/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: commandString,
          timeout,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`HexStrike streaming command failed: ${errorText}`);
        onChunk?.(`Error: ${errorText}\n`);
        return {
          stdout: '',
          stderr: `Error: ${errorText}`,
          exitCode: 1,
          duration: Date.now() - startTime,
        };
      }

      // Process SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (currentEvent) {
                case 'start':
                  this.logger.log(`Stream started, PID: ${data.pid}`);
                  break;

                case 'output':
                  if (data.type === 'stdout') {
                    stdout += data.content;
                    onChunk?.(data.content);
                  } else if (data.type === 'stderr') {
                    stderr += data.content;
                    onChunk?.(`[stderr] ${data.content}`);
                  }
                  break;

                case 'complete':
                  exitCode = data.return_code || 0;
                  this.logger.log(`Stream completed, exit code: ${exitCode}, time: ${data.execution_time}s`);
                  break;

                case 'error':
                  this.logger.error(`Stream error: ${data.error}`);
                  stderr += `Error: ${data.error}\n`;
                  onChunk?.(`Error: ${data.error}\n`);
                  exitCode = 1;
                  break;
              }
            } catch {
              // Ignore JSON parse errors for incomplete data
            }
            currentEvent = '';
          }
        }
      }

      const duration = Date.now() - startTime;
      return { stdout, stderr, exitCode, duration };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`HexStrike streaming execution failed: ${errorMessage}`);
      onChunk?.(`Error: ${errorMessage}\n`);

      // Fallback to non-streaming endpoint if streaming fails
      this.logger.log('Falling back to non-streaming endpoint...');
      return this.executeHexStrikeMcpToolFallback(commandString, timeout, onChunk);
    }
  }

  /**
   * Fallback method for non-streaming execution (used if SSE streaming fails)
   */
  private async executeHexStrikeMcpToolFallback(
    commandString: string,
    timeout: number = 600,
    onChunk?: (chunk: string) => void,
  ): Promise<{ stdout: string; stderr: string; exitCode: number; duration: number }> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.hexstrikeBaseUrl}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: commandString,
          use_cache: false,
        }),
        signal: AbortSignal.timeout(timeout * 1000),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        onChunk?.(`Error: ${errorText}\n`);
        return { stdout: '', stderr: errorText, exitCode: 1, duration };
      }

      const result = await response.json();
      const stdout = result.stdout || result.output || '';
      const stderr = result.stderr || '';

      if (stdout) onChunk?.(stdout);
      if (stderr) onChunk?.(`[stderr] ${stderr}`);

      return {
        stdout,
        stderr,
        exitCode: result.return_code || 0,
        duration: result.execution_time || duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onChunk?.(`Error: ${errorMessage}\n`);
      return { stdout: '', stderr: errorMessage, exitCode: 1, duration };
    }
  }

  /**
   * Execute a HexStrike MCP tool by calling the MCP server
   * Uses /api/command endpoint with a command string
   */
  private async executeHexStrikeMcpTool(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<{ stdout: string; stderr: string; exitCode: number; duration: number }> {
    this.logger.log(`Executing HexStrike tool: ${toolName} with params: ${JSON.stringify(params)}`);

    // Build the command string from tool name and parameters
    const commandString = this.buildCommandString(toolName, params);
    this.logger.log(`Built command: ${commandString}`);

    // Tool-specific timeouts (in ms) - some tools need longer execution time
    const toolTimeouts: Record<string, number> = {
      'amass_scan': 5400000,       // 90 minutes - passive enumeration is slow
      'nuclei_scan': 1800000,      // 30 minutes - comprehensive template scanning
      'nmap_advanced_scan': 1800000, // 30 minutes - with NSE scripts
      'nikto_scan': 1200000,       // 20 minutes - thorough web server scanning
      'sqlmap_scan': 1800000,      // 30 minutes - SQL injection testing
      'wpscan_analyze': 900000,    // 15 minutes - WordPress scanning
      'masscan_high_speed': 900000, // 15 minutes - large port ranges
      'feroxbuster_scan': 1200000, // 20 minutes - recursive directory scanning
    };
    const timeout = toolTimeouts[toolName] || 300000; // Default 5 minutes

    const startTime = Date.now();

    try {
      // Call HexStrike MCP server's command endpoint
      const response = await fetch(`${this.hexstrikeBaseUrl}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: commandString,
          use_cache: true,
        }),
        signal: AbortSignal.timeout(timeout),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorText = `${response.status} ${response.statusText}`;

        if (contentType?.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorText = errorData.error || errorData.message || errorText;
          } catch {
            // Ignore JSON parse errors
          }
        } else {
          errorText = await response.text();
        }

        this.logger.error(`HexStrike command failed: ${errorText}`);
        return {
          stdout: '',
          stderr: `Error: ${errorText}`,
          exitCode: 1,
          duration,
        };
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        const text = await response.text();
        return {
          stdout: text,
          stderr: '',
          exitCode: 0,
          duration,
        };
      }

      const result = await response.json();

      return {
        stdout: result.stdout || result.output || JSON.stringify(result),
        stderr: result.stderr || '',
        exitCode: result.return_code || 0,
        duration: result.execution_time || duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`HexStrike command execution failed: ${errorMessage}`);

      return {
        stdout: '',
        stderr: `Error: ${errorMessage}`,
        exitCode: 1,
        duration,
      };
    }
  }

  /**
   * Build a command string from tool name and parameters
   */
  private buildCommandString(toolName: string, params: Record<string, unknown>): string {
    // Map tool names to their binary names (use full path for httpx to avoid Python httpx conflict)
    const toolBinaryMap: Record<string, string> = {
      'nmap_scan': 'nmap',
      'nmap_advanced_scan': 'nmap',
      'nuclei_scan': 'nuclei',
      'subfinder_scan': 'subfinder',
      'gobuster_scan': 'gobuster',
      'nikto_scan': 'nikto',
      'sqlmap_scan': 'sqlmap',
      'ffuf_scan': 'ffuf',
      'httpx_probe': '/usr/bin/httpx', // Full path to avoid Python httpx conflict
      'wpscan_analyze': 'wpscan',
      'amass_scan': 'amass',
      'dalfox_xss_scan': 'dalfox',
      'feroxbuster_scan': 'feroxbuster',
      'katana_crawl': 'katana',
      'wafw00f_scan': 'wafw00f',
      'intelligent_smart_scan': 'nmap', // Fallback for intelligent scan
      'trivy_scan': 'trivy',
      'masscan_high_speed': 'masscan',
      'rustscan_fast_scan': 'rustscan',
      'hydra_attack': 'hydra',
      'arjun_parameter_discovery': 'arjun',
      'dirsearch_scan': 'dirsearch',
    };

    const binary = toolBinaryMap[toolName] || toolName.replace('_scan', '').replace('_', '-');
    const args: string[] = [binary];

    // Build arguments based on tool type
    switch (toolName) {
      case 'nmap_scan':
      case 'nmap_advanced_scan':
      case 'intelligent_smart_scan':
        if (params.scan_type) args.push(String(params.scan_type));
        if (params.ports) args.push('-p', String(params.ports));
        if (params.timing) args.push(`-${String(params.timing)}`);
        if (params.os_detection) args.push('-O');
        if (params.version_detection) args.push('-sV');
        if (params.aggressive) args.push('-A');
        if (params.nse_scripts) args.push('--script', String(params.nse_scripts));
        if (params.additional_args) args.push(String(params.additional_args));
        // Target must be positional (at end), not --target flag
        if (params.target) args.push(String(params.target));
        break;

      case 'nuclei_scan':
        if (params.target) args.push('-u', String(params.target));
        if (params.severity) args.push('-severity', String(params.severity));
        if (params.tags) args.push('-tags', String(params.tags));
        // Only add template if it's a valid, non-empty path
        // Don't pass template flag if empty - nuclei will use default templates
        if (params.template && String(params.template).trim() !== '' && !String(params.template).includes('nuclei-templates/')) {
          args.push('-t', String(params.template));
        }
        // Add automatic template update check disabled to speed up scans
        args.push('-duc'); // Disable automatic update check
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      case 'subfinder_scan':
        if (params.domain) args.push('-d', String(params.domain));
        if (params.silent) args.push('-silent');
        if (params.all_sources) args.push('-all');
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      case 'gobuster_scan':
        if (params.mode) args.push(String(params.mode));
        if (params.url) args.push('-u', String(params.url));
        if (params.wordlist) args.push('-w', String(params.wordlist));
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      case 'nikto_scan':
        if (params.target) args.push('-h', String(params.target));
        if (params.port) args.push('-p', String(params.port));
        if (params.ssl) args.push('-ssl');
        // Add timeout and limit options to prevent hanging
        args.push('-maxtime', '1200'); // 20 minute max per host
        args.push('-timeout', '15'); // 15 second timeout per request
        args.push('-no404'); // Skip 404 guessing (speeds up scan)
        args.push('-Tuning', '1'); // Only interesting findings to speed up
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      case 'sqlmap_scan':
        if (params.target) args.push('-u', String(params.target));
        if (params.data) args.push('--data', String(params.data));
        if (params.level) args.push('--level', String(params.level));
        if (params.risk) args.push('--risk', String(params.risk));
        if (params.batch) args.push('--batch');
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      case 'ffuf_scan':
        if (params.url) args.push('-u', String(params.url));
        if (params.wordlist) args.push('-w', String(params.wordlist));
        if (params.method) args.push('-X', String(params.method));
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      case 'httpx_probe':
        // ProjectDiscovery httpx: use -u for URL input
        // Note: -u works across all versions of httpx
        if (params.target) args.push('-u', String(params.target));
        if (params.status_code) args.push('-status-code');
        if (params.title) args.push('-title');
        if (params.tech_detect) args.push('-tech-detect');
        // Add reasonable defaults for security scanning
        args.push('-no-color'); // Disable color codes in output
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      case 'wpscan_analyze':
        if (params.url) args.push('--url', String(params.url));
        if (params.enumerate) args.push('-e', String(params.enumerate));
        if (params.api_token) args.push('--api-token', String(params.api_token));
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      case 'amass_scan':
        args.push('enum');
        // Always use passive mode by default to avoid aggressive scanning
        if (params.passive !== false) args.push('-passive');
        if (params.domain) args.push('-d', String(params.domain));
        // Add timeout to prevent indefinite running
        args.push('-timeout', '10'); // 10 minute timeout
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      case 'dalfox_xss_scan':
        args.push('url');
        if (params.target) args.push(String(params.target));
        if (params.blind) args.push('-b', String(params.blind));
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      case 'feroxbuster_scan':
        if (params.url) args.push('-u', String(params.url));
        if (params.wordlist) args.push('-w', String(params.wordlist));
        if (params.depth) args.push('-d', String(params.depth));
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      case 'katana_crawl':
        if (params.url) args.push('-u', String(params.url));
        if (params.depth) args.push('-d', String(params.depth));
        if (params.js_crawl) args.push('-jc');
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      case 'wafw00f_scan':
        if (params.target) args.push(String(params.target));
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      case 'trivy_scan':
        if (params.scan_type) args.push(String(params.scan_type));
        if (params.severity) args.push('--severity', String(params.severity));
        if (params.target) args.push(String(params.target));
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      case 'masscan_high_speed':
        // masscan syntax: masscan -p <ports> --rate <rate> <target>
        // Note: masscan requires IP addresses, hostname resolution is handled in executeHexStrikeMcpToolDirect
        if (params.ports) args.push('-p', String(params.ports));
        if (params.rate) args.push('--rate', String(params.rate));
        if (params.banners) args.push('--banners');
        if (params.target) args.push(String(params.target));
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      case 'rustscan_fast_scan':
        if (params.target) args.push('-a', String(params.target));
        if (params.ports) args.push('-p', String(params.ports));
        // rustscan --scripts requires a value: none, default, or custom
        // If scripts is true, use default scripts; nmap args go after --
        if (params.scripts) {
          args.push('--', '-sC', '-sV'); // Pass nmap script args after --
        }
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      case 'hydra_attack':
        if (params.username) args.push('-l', String(params.username));
        if (params.password_list) args.push('-P', String(params.password_list));
        if (params.target && params.service) {
          args.push(`${String(params.service)}://${String(params.target)}`);
        }
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      case 'arjun_parameter_discovery':
        if (params.url) args.push('-u', String(params.url));
        if (params.method) args.push('-m', String(params.method));
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      case 'dirsearch_scan':
        if (params.url) args.push('-u', String(params.url));
        if (params.extensions) args.push('-e', String(params.extensions));
        if (params.additional_args) args.push(String(params.additional_args));
        break;

      default:
        // Generic fallback: add all params as --key value
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null && value !== '') {
            if (typeof value === 'boolean') {
              if (value) args.push(`--${key}`);
            } else {
              args.push(`--${key}`, String(value));
            }
          }
        }
    }

    return args.join(' ');
  }

  /**
   * Build a command string from the manifest's commandTemplate.
   * Replaces {{placeholders}} with actual parameter values.
   * This is the preferred method as it uses the tool's own definition.
   */
  private buildCommandFromTemplate(
    template: string[],
    params: Record<string, unknown>,
  ): string {
    const result: string[] = [];

    for (const part of template) {
      // Check if this part contains a placeholder like {{target}} or {{ports}}
      const match = part.match(/^\{\{(\w+)\}\}$/);
      if (match) {
        const paramName = match[1];
        const value = params[paramName];

        // Skip this part if the parameter is not provided
        if (value === undefined || value === null || value === '') {
          continue;
        }

        result.push(String(value));
      } else if (part.includes('{{')) {
        // Handle inline placeholders like "-p {{ports}}"
        let processedPart = part;
        const inlineMatches = part.matchAll(/\{\{(\w+)\}\}/g);
        let hasAllValues = true;

        for (const inlineMatch of inlineMatches) {
          const paramName = inlineMatch[1];
          const value = params[paramName];

          if (value === undefined || value === null || value === '') {
            hasAllValues = false;
            break;
          }

          processedPart = processedPart.replace(`{{${paramName}}}`, String(value));
        }

        if (hasAllValues) {
          result.push(processedPart);
        }
      } else {
        // Static part of the command
        result.push(part);
      }
    }

    // Add any additional_args if present and not in template
    if (params.additional_args && !template.some(p => p.includes('additional_args'))) {
      result.push(String(params.additional_args));
    }

    return result.join(' ');
  }

  /**
   * Build a command string for direct tool execution.
   * Uses the tool binary name directly from the database manifest.
   * This method is used when executing the exact tool requested by the user.
   */
  private buildCommandStringDirect(toolBinary: string, params: Record<string, unknown>): string {
    const args: string[] = [toolBinary];

    // Common parameter mappings for known tools
    const toolSpecificHandlers: Record<string, () => void> = {
      'evil-winrm': () => {
        if (params.target || params.ip) args.push('-i', String(params.target || params.ip));
        if (params.user || params.username) args.push('-u', String(params.user || params.username));
        if (params.password) args.push('-p', String(params.password));
        if (params.hash) args.push('-H', String(params.hash));
        if (params.ssl) args.push('-S');
        if (params.port) args.push('-P', String(params.port));
      },
      'crackmapexec': () => {
        if (params.protocol) args.push(String(params.protocol));
        if (params.target) args.push(String(params.target));
        if (params.user || params.username) args.push('-u', String(params.user || params.username));
        if (params.password) args.push('-p', String(params.password));
        if (params.hash) args.push('-H', String(params.hash));
      },
      'netexec': () => {
        if (params.protocol) args.push(String(params.protocol));
        if (params.target) args.push(String(params.target));
        if (params.user || params.username) args.push('-u', String(params.user || params.username));
        if (params.password) args.push('-p', String(params.password));
      },
      'impacket-psexec': () => {
        const user = params.user || params.username || '';
        const password = params.password || '';
        const target = params.target || '';
        if (user && target) {
          args.push(`${user}:${password}@${target}`);
        }
      },
      'impacket-smbexec': () => {
        const user = params.user || params.username || '';
        const password = params.password || '';
        const target = params.target || '';
        if (user && target) {
          args.push(`${user}:${password}@${target}`);
        }
      },
      'impacket-wmiexec': () => {
        const user = params.user || params.username || '';
        const password = params.password || '';
        const target = params.target || '';
        if (user && target) {
          args.push(`${user}:${password}@${target}`);
        }
      },
      'responder': () => {
        if (params.interface) args.push('-I', String(params.interface));
        if (params.analyze) args.push('-A');
        if (params.verbose) args.push('-v');
      },
      'bloodhound-python': () => {
        if (params.domain) args.push('-d', String(params.domain));
        if (params.user || params.username) args.push('-u', String(params.user || params.username));
        if (params.password) args.push('-p', String(params.password));
        if (params.collection) args.push('-c', String(params.collection));
        if (params.dc) args.push('--dc', String(params.dc));
      },
      'kerbrute': () => {
        if (params.mode) args.push(String(params.mode));
        if (params.domain) args.push('-d', String(params.domain));
        if (params.dc) args.push('--dc', String(params.dc));
        if (params.users) args.push(String(params.users));
      },
      'enum4linux-ng': () => {
        if (params.target) args.push('-A', String(params.target));
        if (params.user || params.username) args.push('-u', String(params.user || params.username));
        if (params.password) args.push('-p', String(params.password));
      },
      'smbclient': () => {
        if (params.target) args.push(`//${String(params.target)}/`);
        if (params.share) args[args.length - 1] += String(params.share);
        if (params.user || params.username) args.push('-U', String(params.user || params.username));
        if (params.password) args.push(String(params.password));
        if (params.no_pass) args.push('-N');
      },
      'ldapsearch': () => {
        if (params.host) args.push('-H', `ldap://${String(params.host)}`);
        if (params.base) args.push('-b', String(params.base));
        if (params.user) args.push('-D', String(params.user));
        if (params.password) args.push('-w', String(params.password));
        if (params.filter) args.push(String(params.filter));
      },
    };

    // Check if we have a specific handler for this tool
    const handler = toolSpecificHandlers[toolBinary];
    if (handler) {
      handler();
      // Add any additional_args if present
      if (params.additional_args) {
        args.push(String(params.additional_args));
      }
      return args.join(' ');
    }

    // Generic fallback: intelligent parameter building
    // First add target/url/host as positional if present and not already handled
    const targetParam = params.target || params.url || params.host || params.ip;

    // Add all other params as flags
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      if (key === 'target' || key === 'url' || key === 'host' || key === 'ip') continue; // Handle at end
      if (key === 'additional_args') continue; // Handle separately

      if (typeof value === 'boolean') {
        if (value) {
          // Single letter flags use single dash, others use double dash
          args.push(key.length === 1 ? `-${key}` : `--${key}`);
        }
      } else {
        const stringValue = String(value);
        // Single letter keys use single dash
        if (key.length === 1) {
          args.push(`-${key}`, stringValue);
        } else {
          args.push(`--${key}`, stringValue);
        }
      }
    }

    // Add target at the end (most tools expect it last)
    if (targetParam) {
      args.push(String(targetParam));
    }

    // Add any additional raw arguments
    if (params.additional_args) {
      args.push(String(params.additional_args));
    }

    return args.join(' ');
  }

  async analyzeResults(runId: string) {
    this.logger.log(`Analyzing results for run: ${runId}`);

    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: {
        tool: true,
        artifacts: true,
      },
    });

    if (!run) {
      throw new Error('Run not found');
    }

    // Get stdout artifact
    const stdout = run.artifacts.find((a) => a.type === 'stdout');
    if (!stdout) {
      this.logger.warn('No stdout artifact found for analysis');
      return;
    }

    // Check if Claude is available
    if (!this.claude.isAvailable()) {
      this.logger.warn('Claude AI not configured - skipping analysis');
      return;
    }

    // Analyze with Claude
    const startTime = Date.now();
    try {
      const analysis = await this.claude.analyzeToolOutput(
        run.tool.name,
        stdout.content,
        run.target,
      );
      const processingTime = Date.now() - startTime;

      // Store analysis (upsert to support reanalysis)
      await this.prisma.runAnalysis.upsert({
        where: { runId },
        update: {
          summary: analysis.summary,
          observations: analysis.observations,
          recommendations: analysis.recommendations,
          rawResponse: analysis as any,
          modelUsed: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
          tokensUsed: analysis.tokensUsed,
          processingTime,
        },
        create: {
          runId,
          summary: analysis.summary,
          observations: analysis.observations,
          recommendations: analysis.recommendations,
          rawResponse: analysis as any,
          modelUsed: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
          tokensUsed: analysis.tokensUsed,
          processingTime,
        },
      });

      // Delete existing findings before creating new ones (for reanalysis)
      await this.prisma.finding.deleteMany({
        where: { runId },
      });

      // Create findings
      for (const finding of analysis.findings) {
        await this.prisma.finding.create({
          data: {
            runId,
            title: finding.title,
            description: finding.description,
            severity: finding.severity,
            confidence: finding.confidence,
            cweId: finding.cweId,
            owaspId: finding.owaspId,
            evidence: finding.evidence,
            remediation: finding.remediation,
            references: finding.references || [],
          },
        });
      }

      this.logger.log(`Analysis complete: ${analysis.findings.length} findings created`);
    } catch (error) {
      this.logger.error(`Claude analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Don't throw - analysis failure shouldn't fail the entire run
    }
  }

  async chat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    context?: string,
  ) {
    return this.claude.chat(messages, context);
  }

  chatStream(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    context?: string,
  ) {
    return this.claude.chatStream(messages, context);
  }

  /**
   * Stream chat with tool execution capabilities.
   * Allows Claude to use HexStrike tools during conversation.
   */
  chatWithToolsStream(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    context?: string,
  ) {
    return this.claude.chatWithToolsStream(
      messages,
      context,
      async (toolName: string, toolParams: Record<string, unknown>) => {
        return this.executeHexStrikeMcpTool(toolName, toolParams);
      },
    );
  }

  async getHexStrikeHealth() {
    return this.hexstrike.getHealth();
  }

  async getAvailableTools() {
    return this.hexstrike.getAvailableTools();
  }

  /**
   * Check if a string is an IP address (v4 or v6)
   */
  private isIpAddress(target: string): boolean {
    // IPv4 pattern
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    // IPv6 pattern (simplified)
    const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(\/\d{1,3})?$/;
    // CIDR range pattern
    const cidrPattern = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;

    return ipv4Pattern.test(target) || ipv6Pattern.test(target) || cidrPattern.test(target);
  }

  /**
   * Resolve a hostname to an IP address
   */
  private async resolveHostname(hostname: string): Promise<string> {
    try {
      const addresses = await dns.resolve4(hostname);
      if (addresses.length > 0) {
        this.logger.log(`Resolved ${hostname} to ${addresses[0]}`);
        return addresses[0];
      }
      throw new Error(`No IP addresses found for ${hostname}`);
    } catch (error) {
      this.logger.error(`DNS resolution failed for ${hostname}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Failed to resolve hostname ${hostname} to IP address. Masscan requires IP addresses, not domain names.`);
    }
  }

  /**
   * Check if a tool requires IP addresses (no built-in DNS resolution)
   */
  private toolRequiresIp(toolName: string): boolean {
    return IP_ONLY_TOOLS.includes(toolName) || toolName.includes('masscan');
  }
}
