'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Send,
  User,
  Plus,
  Loader2,
  MessageCircle,
  Search,
} from 'lucide-react';
import { api, type DMConversation, type MessageableUser } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/lib/store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function MessagesPage() {
  const t = useTranslations('directMessages');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ['dm-conversations'],
    queryFn: api.getDMConversations,
    refetchInterval: 10000,
  });

  // Fetch selected conversation
  const { data: activeConversation, isLoading: loadingMessages } = useQuery({
    queryKey: ['dm-conversation', selectedConversation],
    queryFn: () => api.getDMConversation(selectedConversation!),
    enabled: !!selectedConversation,
    refetchInterval: 5000,
  });

  // Fetch messageable users
  const { data: users } = useQuery({
    queryKey: ['messageable-users'],
    queryFn: api.getMessageableUsers,
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      api.sendDirectMessage(selectedConversation!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dm-conversation', selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      setInput('');
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error instanceof Error ? error.message : 'Failed to send message',
      });
    },
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: (userId: string) => api.createDMConversation([userId]),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      setSelectedConversation(data.id);
      setIsNewConversationOpen(false);
      setSearchQuery('');
    },
  });

  const handleSend = useCallback(() => {
    if (!input.trim() || !selectedConversation) return;
    sendMutation.mutate(input.trim());
  }, [input, selectedConversation, sendMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getOtherParticipant = (conversation: DMConversation) => {
    return conversation.participants.find(p => p.userId !== currentUser?.id)?.user;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  const filteredUsers = users?.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'destructive';
      case 'ENGINEER':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Conversations List */}
      <div className="w-80 shrink-0 flex flex-col rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('title')}</span>
          </div>
          <Dialog open={isNewConversationOpen} onOpenChange={setIsNewConversationOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('newConversation')}</DialogTitle>
                <DialogDescription>{t('selectUser')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('searchUsers')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {filteredUsers?.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => createConversationMutation.mutate(user.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
                      disabled={createConversationMutation.isPending}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-medium">{user.name || user.email}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                        {user.role}
                      </Badge>
                    </button>
                  ))}
                  {filteredUsers?.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      {tCommon('noResults')}
                    </p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {loadingConversations ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : conversations?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{t('noConversations')}</p>
              <p className="text-xs mt-1">{t('startConversation')}</p>
            </div>
          ) : (
            conversations?.map((conv) => {
              const other = getOtherParticipant(conv);
              const lastMessage = conv.messages?.[0];
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                    selectedConversation === conv.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  <div className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                    selectedConversation === conv.id
                      ? 'bg-primary-foreground/20'
                      : 'bg-primary text-primary-foreground'
                  )}>
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{other?.name || other?.email}</p>
                      {other?.role && (
                        <Badge
                          variant={selectedConversation === conv.id ? 'outline' : getRoleBadgeVariant(other.role)}
                          className="text-[10px] px-1 py-0"
                        >
                          {other.role}
                        </Badge>
                      )}
                    </div>
                    {lastMessage && (
                      <p className={cn(
                        'text-xs truncate',
                        selectedConversation === conv.id
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                      )}>
                        {lastMessage.senderId === currentUser?.id ? `${t('you')}: ` : ''}
                        {lastMessage.content}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex flex-1 flex-col rounded-xl border bg-card">
        {selectedConversation && activeConversation ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b px-6 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">
                  {getOtherParticipant(activeConversation)?.name ||
                    getOtherParticipant(activeConversation)?.email}
                </p>
                <Badge variant={getRoleBadgeVariant(getOtherParticipant(activeConversation)?.role || '')} className="text-xs">
                  {getOtherParticipant(activeConversation)?.role}
                </Badge>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {loadingMessages ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                activeConversation.messages.map((message) => {
                  const isOwn = message.senderId === currentUser?.id;
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        'flex',
                        isOwn ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[70%] rounded-2xl px-4 py-2',
                          isOwn
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p className={cn(
                          'text-xs mt-1',
                          isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        )}>
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('typeMessage')}
                  className="min-h-[52px] resize-none"
                  rows={1}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || sendMutation.isPending}
                  size="lg"
                  className="h-[52px] w-[52px] shrink-0"
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">{t('noMessages')}</p>
              <p className="text-sm mt-1">{t('noMessagesDescription')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
