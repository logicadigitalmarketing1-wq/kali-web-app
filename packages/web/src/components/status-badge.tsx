'use client';

import { CheckCircle, XCircle, Clock, Ban } from 'lucide-react';
import { type RunStatus, getStatusColor } from '@/lib/utils';

interface StatusBadgeProps {
  status: RunStatus | string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

const statusIcons: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-3 w-3" />,
  RUNNING: null,
  COMPLETED: <CheckCircle className="h-3 w-3" />,
  FAILED: <XCircle className="h-3 w-3" />,
  TIMEOUT: <Clock className="h-3 w-3" />,
  CANCELLED: <Ban className="h-3 w-3" />,
};

export function StatusBadge({ status, size = 'sm', showIcon = true }: StatusBadgeProps) {
  const sizeClasses = size === 'sm'
    ? 'px-2 py-1 text-xs'
    : 'px-3 py-1 text-sm';

  const icon = showIcon ? statusIcons[status] : null;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-white ${getStatusColor(status)} ${sizeClasses}`}>
      {icon}
      {status}
    </span>
  );
}
