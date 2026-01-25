import { z } from 'zod';

// ============================================================================
// Tool Manifest Schema
// ============================================================================

export const RiskLevelSchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const ArgTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'select',
  'multiselect',
  'host',
  'port',
  'cidr',
  'url',
  'file',
]);
export type ArgType = z.infer<typeof ArgTypeSchema>;

export const ArgDefinitionSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  type: ArgTypeSchema,
  required: z.boolean().default(false),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  placeholder: z.string().optional(),

  // Validation
  pattern: z.string().optional(), // Regex pattern for string validation
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  min: z.number().optional(), // For number type
  max: z.number().optional(), // For number type

  // For select/multiselect types
  options: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),

  // For port type
  portRange: z
    .object({
      min: z.number().default(1),
      max: z.number().default(65535),
    })
    .optional(),

  // Security
  sensitive: z.boolean().default(false), // If true, value is redacted in logs
  allowedValues: z.array(z.string()).optional(), // Allowlist for values
});
export type ArgDefinition = z.infer<typeof ArgDefinitionSchema>;

export const ResourceLimitsSchema = z.object({
  memory: z.string().default('512Mi'), // e.g., "512Mi", "1Gi"
  cpu: z.string().default('0.5'), // e.g., "0.5", "1.0"
  pidsLimit: z.number().default(100),
  networkBandwidth: z.string().optional(), // e.g., "10Mbps"
});
export type ResourceLimits = z.infer<typeof ResourceLimitsSchema>;

export const RedactionRuleSchema = z.object({
  pattern: z.string(), // Regex pattern to match
  replacement: z.string().default('[REDACTED]'),
  caseSensitive: z.boolean().default(false),
});
export type RedactionRule = z.infer<typeof RedactionRuleSchema>;

export const ToolManifestSchema = z.object({
  // Identity
  name: z.string().min(1).regex(/^[a-z0-9-]+$/),
  displayName: z.string().min(1),
  version: z.string().default('1.0.0'),

  // Classification
  category: z.string().min(1),
  description: z.string().min(1),
  longDescription: z.string().optional(),
  riskLevel: RiskLevelSchema,

  // Execution
  binary: z.string().min(1), // Path to binary or command name
  commandTemplate: z.array(z.string()), // Command with placeholders like {{argName}}
  workingDirectory: z.string().optional(),
  environment: z.record(z.string()).optional(),

  // Arguments
  argsSchema: z.array(ArgDefinitionSchema),

  // Scope restrictions
  allowedScopes: z.array(z.string()).optional(), // If set, only these scope types allowed
  requiresScope: z.boolean().default(true),

  // Resource limits
  timeout: z.number().default(300000), // 5 minutes default
  resourceLimits: ResourceLimitsSchema.optional(),

  // Output handling
  outputParser: z.string().optional(), // Module name for parsing output
  outputFormat: z.enum(['text', 'json', 'xml', 'binary']).default('text'),

  // Security
  redactionRules: z.array(RedactionRuleSchema).optional(),
  dropCapabilities: z.array(z.string()).optional(),
  keepCapabilities: z.array(z.string()).optional(), // e.g., ["CAP_NET_RAW"]
  readOnlyFilesystem: z.boolean().default(true),
  noNewPrivileges: z.boolean().default(true),

  // Networking
  networkMode: z.enum(['none', 'host', 'bridge', 'restricted']).default('restricted'),
  allowedEgress: z.array(z.string()).optional(), // CIDRs/hosts allowed for egress

  // Documentation
  prerequisites: z.array(z.string()).optional(),
  safeUsageNotes: z.array(z.string()).optional(),
  exampleCommands: z
    .array(
      z.object({
        description: z.string(),
        parameters: z.record(z.union([z.string(), z.number(), z.boolean()])),
      })
    )
    .optional(),
  references: z.array(z.string()).optional(), // URLs

  // Metadata
  author: z.string().optional(),
  license: z.string().optional(),
  homepage: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
});
export type ToolManifest = z.infer<typeof ToolManifestSchema>;

// ============================================================================
// LLM Response Schemas
// ============================================================================

export const SeveritySchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);
export type Severity = z.infer<typeof SeveritySchema>;

export const PotentialIssueSchema = z.object({
  title: z.string(),
  severity: SeveritySchema,
  description: z.string(),
  affectedComponent: z.string().optional(),
  remediation: z.string(),
  references: z.array(z.string()).optional(),
  cweId: z.string().optional(),
  owaspId: z.string().optional(),
});
export type PotentialIssue = z.infer<typeof PotentialIssueSchema>;

export const LLMInterpretationSchema = z.object({
  summary: z.string(),
  keyObservations: z.array(z.string()),
  potentialIssues: z.array(PotentialIssueSchema),
  recommendations: z.array(z.string()),
  overallRisk: SeveritySchema.optional(),
  additionalContext: z.string().optional(),
});
export type LLMInterpretation = z.infer<typeof LLMInterpretationSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateManifest(manifest: unknown): ToolManifest {
  return ToolManifestSchema.parse(manifest);
}

export function validateInterpretation(response: unknown): LLMInterpretation {
  return LLMInterpretationSchema.parse(response);
}

// ============================================================================
// Template Rendering
// ============================================================================

export function renderCommandTemplate(
  template: string[],
  args: Record<string, string | number | boolean | undefined>
): string[] {
  return template.map((part) => {
    // Replace {{argName}} placeholders with actual values
    return part.replace(/\{\{(\w+)\}\}/g, (match, argName) => {
      const value = args[argName];
      if (value === undefined || value === null) {
        return '';
      }
      return String(value);
    });
  }).filter(part => part !== ''); // Remove empty parts
}

// ============================================================================
// Host/CIDR Validation
// ============================================================================

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const CIDR_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[1-2][0-9]|3[0-2])$/;
const HOSTNAME_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

export function isValidIPv4(ip: string): boolean {
  return IPV4_REGEX.test(ip);
}

export function isValidCIDR(cidr: string): boolean {
  return CIDR_REGEX.test(cidr);
}

export function isValidHostname(hostname: string): boolean {
  return HOSTNAME_REGEX.test(hostname) && hostname.length <= 253;
}

export function isValidHost(host: string): boolean {
  return isValidIPv4(host) || isValidHostname(host);
}

export function isIPInCIDR(ip: string, cidr: string): boolean {
  if (!isValidIPv4(ip) || !isValidCIDR(cidr)) {
    return false;
  }

  const [cidrIp, prefixLengthStr] = cidr.split('/');
  const prefixLength = parseInt(prefixLengthStr!, 10);

  const ipNum = ipToNumber(ip);
  const cidrNum = ipToNumber(cidrIp!);
  const mask = ~((1 << (32 - prefixLength)) - 1) >>> 0;

  return (ipNum & mask) === (cidrNum & mask);
}

function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

export function hostMatchesPattern(host: string, pattern: string): boolean {
  // Handle wildcard patterns like *.example.com
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1); // .example.com
    return host.endsWith(suffix) || host === pattern.slice(2);
  }
  return host === pattern;
}
