interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates if a target is allowed based on scope CIDRs and hosts
 */
export function validateTarget(
  target: string,
  scopeCidrs: string[],
  scopeHosts: string[],
): ValidationResult {
  // Normalize target
  const normalizedTarget = target.toLowerCase().trim();

  // Check if target matches any allowed host pattern
  for (const host of scopeHosts) {
    if (matchHostPattern(normalizedTarget, host.toLowerCase())) {
      return { valid: true };
    }
  }

  // Check if target is an IP and matches any CIDR
  const ip = parseIP(normalizedTarget);
  if (ip) {
    for (const cidr of scopeCidrs) {
      if (ipInCidr(ip, cidr)) {
        return { valid: true };
      }
    }
  }

  return {
    valid: false,
    reason: `Target "${target}" is not in the allowed scope`,
  };
}

/**
 * Matches a target against a host pattern that may contain wildcards
 * Example: *.example.com matches sub.example.com
 */
function matchHostPattern(target: string, pattern: string): boolean {
  // Exact match
  if (target === pattern) {
    return true;
  }

  // Wildcard match
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1); // ".example.com"
    return target.endsWith(suffix) || target === pattern.slice(2);
  }

  return false;
}

/**
 * Parses an IP address string into a number array
 */
function parseIP(str: string): number[] | null {
  // IPv4 only for now
  const parts = str.split('.');
  if (parts.length !== 4) {
    return null;
  }

  const nums = parts.map((p) => parseInt(p, 10));
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) {
    return null;
  }

  return nums;
}

/**
 * Checks if an IP is within a CIDR range
 */
function ipInCidr(ip: number[], cidr: string): boolean {
  const [cidrIp, maskStr] = cidr.split('/');
  const cidrParts = parseIP(cidrIp);
  if (!cidrParts) {
    return false;
  }

  const mask = parseInt(maskStr, 10);
  if (isNaN(mask) || mask < 0 || mask > 32) {
    return false;
  }

  // Convert to 32-bit integers
  const ipNum =
    (ip[0] << 24) | (ip[1] << 16) | (ip[2] << 8) | ip[3];
  const cidrNum =
    (cidrParts[0] << 24) | (cidrParts[1] << 16) | (cidrParts[2] << 8) | cidrParts[3];

  // Create mask
  const maskBits = mask === 0 ? 0 : ~((1 << (32 - mask)) - 1);

  return (ipNum & maskBits) === (cidrNum & maskBits);
}

/**
 * Validates that a target doesn't contain injection characters
 */
export function sanitizeTarget(target: string): ValidationResult {
  // Disallow shell metacharacters
  const dangerousChars = /[;&|`$(){}[\]<>\\'"]/;
  if (dangerousChars.test(target)) {
    return {
      valid: false,
      reason: 'Target contains potentially dangerous characters',
    };
  }

  // Disallow newlines
  if (/[\r\n]/.test(target)) {
    return {
      valid: false,
      reason: 'Target contains newline characters',
    };
  }

  // Disallow very long targets
  if (target.length > 255) {
    return {
      valid: false,
      reason: 'Target exceeds maximum length',
    };
  }

  return { valid: true };
}

/**
 * Validates tool parameters against a schema
 */
export function validateParams(
  params: Record<string, unknown>,
  schema: Record<string, ParameterSchema>,
): ValidationResult {
  for (const [key, value] of Object.entries(params)) {
    const paramSchema = schema[key];

    if (!paramSchema) {
      return {
        valid: false,
        reason: `Unknown parameter: ${key}`,
      };
    }

    // Type validation
    if (value !== undefined && value !== null) {
      const valueType = typeof value;

      switch (paramSchema.type) {
        case 'string':
          if (valueType !== 'string') {
            return { valid: false, reason: `Parameter ${key} must be a string` };
          }
          break;
        case 'number':
          if (valueType !== 'number') {
            return { valid: false, reason: `Parameter ${key} must be a number` };
          }
          break;
        case 'boolean':
          if (valueType !== 'boolean') {
            return { valid: false, reason: `Parameter ${key} must be a boolean` };
          }
          break;
      }

      // Enum validation
      if (paramSchema.enum && !paramSchema.enum.includes(String(value))) {
        return {
          valid: false,
          reason: `Parameter ${key} must be one of: ${paramSchema.enum.join(', ')}`,
        };
      }

      // Pattern validation for strings
      if (paramSchema.pattern && typeof value === 'string') {
        const regex = new RegExp(paramSchema.pattern);
        if (!regex.test(value)) {
          return {
            valid: false,
            reason: `Parameter ${key} does not match required pattern`,
          };
        }
      }
    }
  }

  // Check required parameters
  for (const [key, paramSchema] of Object.entries(schema)) {
    if (paramSchema.required && (params[key] === undefined || params[key] === null)) {
      return {
        valid: false,
        reason: `Required parameter missing: ${key}`,
      };
    }
  }

  return { valid: true };
}

interface ParameterSchema {
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  enum?: string[];
  pattern?: string;
  default?: unknown;
}
