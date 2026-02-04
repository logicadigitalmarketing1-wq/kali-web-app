import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    CRITICAL: 'bg-red-600',
    HIGH: 'bg-orange-600',
    MEDIUM: 'bg-yellow-600',
    LOW: 'bg-blue-600',
    INFO: 'bg-gray-500',
  };
  return colors[severity] || colors.INFO;
}

export function getSeverityBadgeClass(severity: string): string {
  const classes: Record<string, string> = {
    CRITICAL: 'severity-critical',
    HIGH: 'severity-high',
    MEDIUM: 'severity-medium',
    LOW: 'severity-low',
    INFO: 'severity-info',
  };
  return classes[severity] || classes.INFO;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

// Status color utilities for run states
export type RunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT' | 'CANCELLED';

export function getStatusColor(status: RunStatus | string): string {
  const colors: Record<string, string> = {
    PENDING: 'bg-gray-500',
    RUNNING: 'bg-blue-500 animate-pulse',
    COMPLETED: 'bg-green-500',
    FAILED: 'bg-red-500',
    TIMEOUT: 'bg-orange-500',
    CANCELLED: 'bg-orange-500',
  };
  return colors[status] || colors.PENDING;
}

// Health status utilities
export function getHealthStatusColor(isHealthy: boolean): string {
  return isHealthy ? 'bg-green-500' : 'bg-red-500';
}
