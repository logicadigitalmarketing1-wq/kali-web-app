'use client';

import { memo, useEffect, useRef } from 'react';

interface TerminalOutputProps {
  content: string;
  variant?: 'default' | 'error';
  maxHeight?: string;
  isStreaming?: boolean;
  autoScroll?: boolean;
}

/**
 * Terminal output display component with streaming support
 * Loaded dynamically to reduce initial bundle size
 */
function TerminalOutputComponent({
  content,
  variant = 'default',
  maxHeight = '600px',
  isStreaming = false,
  autoScroll = true,
}: TerminalOutputProps) {
  const containerRef = useRef<HTMLPreElement>(null);

  // Auto-scroll to bottom when content changes (if enabled)
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content, autoScroll]);

  const colorClasses = variant === 'error'
    ? 'bg-red-950 text-red-400'
    : 'bg-black text-green-400';

  return (
    <div className="relative">
      {/* Live indicator */}
      {isStreaming && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full bg-black/80 px-3 py-1">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          <span className="text-xs font-medium text-green-500">Live</span>
        </div>
      )}

      <pre
        ref={containerRef}
        className={`terminal-output overflow-auto rounded-lg p-4 font-mono text-sm ${colorClasses}`}
        style={{ maxHeight }}
      >
        {content}
        {/* Blinking cursor when streaming */}
        {isStreaming && (
          <span className="animate-pulse text-green-400">▋</span>
        )}
      </pre>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export const TerminalOutput = memo(TerminalOutputComponent);

// Default export for dynamic imports
export default TerminalOutput;
