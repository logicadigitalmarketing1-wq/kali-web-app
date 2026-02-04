'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  message: string;
}

interface SmartScanLogsProps {
  logs: LogEntry[];
  isConnected: boolean;
}

export function SmartScanLogs({ logs, isConnected }: SmartScanLogsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getLogColor = (message: string) => {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('error') || lowerMessage.includes('failed')) {
      return 'text-red-400';
    }
    if (lowerMessage.includes('warning')) {
      return 'text-yellow-400';
    }
    if (lowerMessage.includes('completed') || lowerMessage.includes('success')) {
      return 'text-green-400';
    }
    if (lowerMessage.includes('found:') || lowerMessage.includes('critical') || lowerMessage.includes('high')) {
      return 'text-orange-400';
    }
    if (lowerMessage.includes('phase') || lowerMessage.includes('starting')) {
      return 'text-blue-400';
    }
    return 'text-gray-300';
  };

  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            <span>Live Output</span>
          </div>
          <Badge
            variant="outline"
            className={isConnected ? 'border-green-500 text-green-500' : 'border-gray-500 text-gray-500'}
          >
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </Badge>
        </CardTitle>
        <CardDescription className="text-gray-400">
          Real-time scan output and logs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] w-full rounded border border-gray-700 bg-black p-4">
          <div ref={scrollRef} className="font-mono text-sm space-y-1">
            {logs.length === 0 ? (
              <div className="text-gray-500 italic">Waiting for scan output...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="flex">
                  <span className="text-gray-500 mr-3 shrink-0">
                    [{formatTime(log.timestamp)}]
                  </span>
                  <span className={getLogColor(log.message)}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
            {isConnected && (
              <div className="flex items-center mt-2">
                <span className="text-gray-500 mr-3">&gt;</span>
                <span className="animate-pulse text-green-400">_</span>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
