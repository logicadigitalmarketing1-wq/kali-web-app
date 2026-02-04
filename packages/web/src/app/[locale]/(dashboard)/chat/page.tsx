'use client';

import dynamic from 'next/dynamic';
import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Send,
  Bot,
  User,
  Plus,
  Loader2,
  Copy,
  Check,
  Sparkles,
  Shield,
  Terminal,
  Search,
  MessageSquare,
  Wrench,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

const ConversationsList = dynamic(
  () => import('@/components/conversations-list').then((mod) => mod.ConversationsList),
  {
    loading: () => (
      <div className="flex h-16 items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
    ssr: false,
  }
);

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ToolExecution {
  name: string;
  params?: Record<string, unknown>;
  output?: string;
  status: 'running' | 'completed';
  duration?: number;
}

const SUGGESTION_KEYS = [
  { icon: Terminal, titleKey: 'portScan', promptKey: 'portScanPrompt' },
  { icon: Search, titleKey: 'findSubdomains', promptKey: 'findSubdomainsPrompt' },
  { icon: Shield, titleKey: 'vulnerabilityScan', promptKey: 'vulnerabilityScanPrompt' },
  { icon: Sparkles, titleKey: 'directoryDiscovery', promptKey: 'directoryDiscoveryPrompt' },
];

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-2 rounded-lg bg-zinc-900 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-2">
        <span className="text-xs text-zinc-400">{language || 'code'}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-zinc-400 hover:text-zinc-200"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="text-sm text-zinc-100">{code}</code>
      </pre>
    </div>
  );
}

function formatMessageContent(content: string | undefined | null) {
  if (!content) return null;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={lastIndex} className="whitespace-pre-wrap">
          {content.slice(lastIndex, match.index)}
        </span>
      );
    }

    parts.push(
      <CodeBlock key={match.index} language={match[1]} code={match[2].trim()} />
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(
      <span key={lastIndex} className="whitespace-pre-wrap">
        {content.slice(lastIndex)}
      </span>
    );
  }

  return parts;
}

const MessageBubble = memo(function MessageBubble({
  message,
  isLast,
}: {
  message: Message;
  isLast: boolean;
}) {
  const t = useTranslations('chat');
  const tCommon = useTranslations('common');
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const content = message.content || '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        'group flex gap-4 px-4 py-6',
        isUser ? 'bg-transparent' : 'bg-muted/30'
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isUser ? tCommon('you') : t('title')}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
        </div>
        <div className="text-sm leading-relaxed text-foreground/90">
          {formatMessageContent(content)}
        </div>
      </div>
    </div>
  );
});

function EmptyState({
  onSuggestionClick,
}: {
  onSuggestionClick: (prompt: string) => void;
}) {
  const t = useTranslations('chat');

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="relative mb-6">
        <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-violet-500/20 to-purple-500/20 blur-xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
          <Shield className="h-8 w-8" />
        </div>
      </div>
      <h2 className="mb-2 text-2xl font-semibold">{t('emptyTitle')}</h2>
      <p className="mb-8 max-w-md text-center text-muted-foreground">
        {t('emptyDescription')}
      </p>
      <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
        {SUGGESTION_KEYS.map((suggestion, index) => {
          const Icon = suggestion.icon;
          const title = t(`suggestions.${suggestion.titleKey}`);
          const prompt = t(`suggestions.${suggestion.promptKey}`);
          return (
            <button
              key={index}
              onClick={() => onSuggestionClick(prompt)}
              className="group flex items-start gap-3 rounded-xl border border-border/50 bg-card/50 p-4 text-left transition-all hover:border-primary/50 hover:bg-card"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {prompt}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  const t = useTranslations('chat');

  return (
    <div className="flex gap-4 bg-muted/30 px-4 py-6">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-violet-500 [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-violet-500 [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-violet-500" />
        </div>
        <span className="text-sm text-muted-foreground">{t('analyzing')}</span>
      </div>
    </div>
  );
}

function ToolExecutionCard({ tool }: { tool: ToolExecution }) {
  const t = useTranslations('chat');
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-3 rounded-lg border bg-zinc-950 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 transition-colors"
      >
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg",
          tool.status === 'running'
            ? "bg-blue-500/20 text-blue-400"
            : "bg-green-500/20 text-green-400"
        )}>
          {tool.status === 'running' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-sm">{tool.name}</span>
            {tool.status === 'running' && (
              <span className="text-xs text-blue-400 animate-pulse">{t('running')}</span>
            )}
          </div>
          {tool.params?.target != null && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('target')}: {String(tool.params.target as string)}
            </p>
          )}
        </div>
        {tool.duration !== undefined && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {(tool.duration / 1000).toFixed(1)}s
          </div>
        )}
      </button>
      {expanded && tool.output && (
        <div className="border-t border-zinc-800">
          <pre className="p-4 text-xs text-zinc-300 overflow-x-auto max-h-64 overflow-y-auto">
            {tool.output}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const t = useTranslations('chat');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { data: conversations, refetch: refetchConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: api.getConversations,
  });

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsStreaming(true);
    setStreamingContent('');
    setToolExecutions([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      let newConversationId = conversationId;
      let fullContent = '';
      const tools: ToolExecution[] = [];

      const stream = api.sendMessageStream(
        conversationId,
        userMessage,
        (id) => {
          if (!conversationId) {
            newConversationId = id;
            setConversationId(id);
            refetchConversations();
          }
        }
      );

      for await (const event of stream) {
        if (event.type === 'text' && event.content) {
          fullContent += event.content;
          setStreamingContent(fullContent);
        } else if (event.type === 'tool_start' && event.toolName) {
          const newTool: ToolExecution = {
            name: event.toolName,
            params: event.toolParams,
            status: 'running',
          };
          tools.push(newTool);
          setToolExecutions([...tools]);
        } else if (event.type === 'tool_output' && event.toolName) {
          const toolIndex = tools.findIndex(t => t.name === event.toolName && t.status === 'running');
          if (toolIndex >= 0) {
            tools[toolIndex].output = (tools[toolIndex].output || '') + (event.content || '');
            setToolExecutions([...tools]);
          }
        } else if (event.type === 'tool_complete' && event.toolName) {
          const toolIndex = tools.findIndex(t => t.name === event.toolName && t.status === 'running');
          if (toolIndex >= 0) {
            tools[toolIndex].status = 'completed';
            tools[toolIndex].duration = event.duration;
            setToolExecutions([...tools]);
          }
        }
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: fullContent }]);
      setStreamingContent('');
      setToolExecutions([]);
    } catch (err) {
      toast({
        title: tCommon('error'),
        description: err instanceof Error ? err.message : t('sendError'),
        variant: 'destructive',
      });
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
      setToolExecutions([]);
    }
  }, [input, isStreaming, conversationId, refetchConversations, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isPending = isStreaming;

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const loadConversation = async (id: string) => {
    const conversation = await api.getConversation(id);
    setConversationId(id);
    setMessages(
      conversation.messages
        .filter((m) => m.content)
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
    );
  };

  const deleteConversation = async (id: string) => {
    try {
      await api.deleteConversation(id);
      toast({
        title: t('conversationDeleted'),
        description: t('conversationDeletedDescription'),
      });
      refetchConversations();
      // If we deleted the current conversation, start a new one
      if (conversationId === id) {
        setConversationId(null);
        setMessages([]);
      }
    } catch {
      toast({
        title: tCommon('error'),
        description: t('deleteConversationError'),
        variant: 'destructive',
      });
    }
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    textareaRef.current?.focus();
  };

  const handleSuggestionClick = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar */}
      <div className="hidden w-64 shrink-0 flex-col rounded-xl border bg-card md:flex">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('history')}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={startNewConversation}
            className="h-8 px-2"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          <ConversationsList
            conversations={conversations}
            currentId={conversationId}
            onSelect={loadConversation}
            onDelete={deleteConversation}
          />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col rounded-xl border bg-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-semibold">{t('title')}</h1>
              <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={startNewConversation}
              className="hidden sm:flex"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('newChat')}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={startNewConversation}
              className="sm:hidden"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto">
          {messages.length === 0 && !isStreaming ? (
            <EmptyState onSuggestionClick={handleSuggestionClick} />
          ) : (
            <div className="divide-y divide-border/50">
              {messages.map((message, index) => (
                <MessageBubble
                  key={index}
                  message={message}
                  isLast={index === messages.length - 1 && !isStreaming}
                />
              ))}
              {isStreaming && (
                <>
                  {toolExecutions.length > 0 && (
                    <div className="px-4 py-4 bg-muted/20 border-y">
                      <div className="flex items-center gap-2 mb-2">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">
                          {t('toolExecution')}
                        </span>
                      </div>
                      {toolExecutions.map((tool, index) => (
                        <ToolExecutionCard key={`${tool.name}-${index}`} tool={tool} />
                      ))}
                    </div>
                  )}
                  {streamingContent ? (
                    <MessageBubble
                      message={{ role: 'assistant', content: streamingContent }}
                      isLast={true}
                    />
                  ) : toolExecutions.length === 0 ? (
                    <ThinkingIndicator />
                  ) : null}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="relative flex items-end gap-2">
            <div className="relative flex-1">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder={t('placeholder')}
                disabled={isPending}
                className="min-h-[52px] resize-none pr-12 py-3"
                rows={1}
              />
              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Enter</kbd>
                <span className="mx-1">{t('toSend')}</span>
              </div>
            </div>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isPending}
              size="lg"
              className="h-[52px] w-[52px] shrink-0"
            >
              {isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {t('footerDescription')}
          </p>
        </div>
      </div>
    </div>
  );
}
