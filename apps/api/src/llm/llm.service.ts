import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { LLMInterpretationSchema, validateInterpretation, LLMInterpretation } from '@securescope/tool-schemas';
import { PinoLoggerService } from '../common/logger.service';

const INTERPRETATION_SYSTEM_PROMPT = `You are a security analysis assistant for SecureScope, a security assessment platform.

Your role is to interpret the output of security tools and provide:
1. A clear summary of what the tool found
2. Key observations from the output
3. Potential security issues (if any) with conservative severity ratings
4. Remediation recommendations
5. References to relevant security standards (OWASP, CWE) when applicable

IMPORTANT RULES:
- Focus on interpretation and remediation guidance only
- Be conservative with severity ratings (prefer lower severities unless clearly critical)
- Do not provide exploit code or attack instructions
- Do not help bypass security controls
- Redact any sensitive data you notice (passwords, API keys, tokens)
- Always recommend secure configurations

Severity levels:
- info: Informational finding, no security impact
- low: Minor issue, limited security impact
- medium: Moderate issue, potential security impact
- high: Significant issue, likely security impact
- critical: Severe issue, immediate security impact

You must respond with valid JSON matching this schema:
{
  "summary": "string - brief summary of the tool output",
  "keyObservations": ["array of key observations"],
  "potentialIssues": [
    {
      "title": "string",
      "severity": "info|low|medium|high|critical",
      "description": "string",
      "affectedComponent": "string (optional)",
      "remediation": "string",
      "references": ["array of URLs (optional)"],
      "cweId": "string like CWE-79 (optional)",
      "owaspId": "string like A03:2021 (optional)"
    }
  ],
  "recommendations": ["array of general recommendations"],
  "overallRisk": "info|low|medium|high|critical (optional)",
  "additionalContext": "string (optional)"
}`;

const CHAT_SYSTEM_PROMPT = `You are a security analysis assistant for SecureScope.

You help users understand their security assessment results, findings, and recommendations.
You have access to context about specific runs and findings that the user has selected.

IMPORTANT RULES:
- Only discuss the security data provided in the context
- Provide helpful analysis and remediation guidance
- Do not provide exploit code or attack instructions
- Do not help bypass security controls
- Be conservative with security advice
- Reference OWASP, CWE, and other standards when relevant

If the user asks about data not in the provided context, politely explain that you can only discuss the selected runs and findings.`;

@Injectable()
export class LlmService {
  private client: Anthropic | null = null;
  private useMock: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLoggerService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.useMock = false;
    } else {
      this.useMock = true;
      this.logger.warn('ANTHROPIC_API_KEY not set, using mock LLM responses', 'LlmService');
    }
  }

  async interpretOutput(
    toolName: string,
    toolDisplayName: string,
    stdout: string,
    stderr: string,
  ): Promise<LLMInterpretation> {
    // Redact secrets before sending to LLM
    const redactedStdout = this.redactSecrets(stdout);
    const redactedStderr = this.redactSecrets(stderr);

    const prompt = `Analyze the following output from the security tool "${toolDisplayName}" (${toolName}):

STDOUT:
\`\`\`
${redactedStdout.slice(0, 10000)}
\`\`\`

${redactedStderr ? `STDERR:
\`\`\`
${redactedStderr.slice(0, 2000)}
\`\`\`` : ''}

Provide your analysis as JSON.`;

    if (this.useMock) {
      return this.getMockInterpretation(toolName);
    }

    try {
      const response = await this.client!.messages.create({
        model: this.configService.get<string>('LLM_MODEL') || 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        system: INTERPRETATION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      // Extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return validateInterpretation(parsed);
    } catch (error) {
      this.logger.error('LLM interpretation failed', String(error), 'LlmService');
      return this.getMockInterpretation(toolName);
    }
  }

  async chat(
    userMessage: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    context: string,
  ): Promise<{ content: string; inputTokens?: number; outputTokens?: number }> {
    const prompt = context
      ? `Context from selected runs/findings:\n${context}\n\n---\n\nUser question: ${userMessage}`
      : userMessage;

    if (this.useMock) {
      return {
        content: `I'd be happy to help you analyze the security findings. Based on the context provided, here are my observations:\n\n1. The security assessment identified several areas that need attention.\n2. I recommend prioritizing the high-severity findings first.\n3. For each finding, follow the remediation steps provided.\n\nWould you like me to go into more detail about any specific finding?`,
      };
    }

    try {
      const messages: Anthropic.MessageParam[] = [
        ...history.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user', content: prompt },
      ];

      const response = await this.client!.messages.create({
        model: this.configService.get<string>('LLM_MODEL') || 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        system: CHAT_SYSTEM_PROMPT,
        messages,
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      return {
        content: content.text,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    } catch (error) {
      this.logger.error('LLM chat failed', String(error), 'LlmService');
      return {
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
      };
    }
  }

  redactSecrets(text: string): string {
    if (!text) return '';

    let result = text;

    // Redact common secret patterns
    const patterns = [
      // Passwords
      { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]?([^'"\s]+)['"]?/gi, replacement: '$1: [REDACTED]' },
      // API keys
      { pattern: /(?:api[_-]?key|apikey|api_secret)\s*[:=]\s*['"]?([^'"\s]+)['"]?/gi, replacement: '$1: [REDACTED]' },
      // Tokens
      { pattern: /(?:token|bearer|auth)\s*[:=]\s*['"]?([^'"\s]+)['"]?/gi, replacement: '$1: [REDACTED]' },
      // AWS keys
      { pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[AWS_ACCESS_KEY_REDACTED]' },
      // Private keys
      { pattern: /-----BEGIN.*?PRIVATE KEY-----[\s\S]*?-----END.*?PRIVATE KEY-----/g, replacement: '[PRIVATE_KEY_REDACTED]' },
      // JWTs
      { pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g, replacement: '[JWT_REDACTED]' },
      // Generic secrets
      { pattern: /(?:secret|credential)\s*[:=]\s*['"]?([^'"\s]+)['"]?/gi, replacement: '$1: [REDACTED]' },
      // Cookies
      { pattern: /(?:cookie|session_id)\s*[:=]\s*['"]?([^'"\s]+)['"]?/gi, replacement: '$1: [REDACTED]' },
    ];

    for (const { pattern, replacement } of patterns) {
      result = result.replace(pattern, replacement);
    }

    return result;
  }

  private getMockInterpretation(toolName: string): LLMInterpretation {
    return {
      summary: `Analysis of ${toolName} output completed. This is a mock interpretation as no API key is configured.`,
      keyObservations: [
        'Tool executed successfully',
        'Output captured for review',
        'Manual analysis recommended',
      ],
      potentialIssues: [],
      recommendations: [
        'Review the raw output for any security concerns',
        'Configure ANTHROPIC_API_KEY for automated interpretation',
        'Consult security documentation for tool-specific guidance',
      ],
    };
  }
}
