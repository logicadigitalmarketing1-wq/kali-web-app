'use client';

import { memo, useState } from 'react';
import { MessageSquare, Trash2, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
}

interface ConversationsListProps {
  conversations: Conversation[] | undefined;
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
}

/**
 * Conversations list component
 * Loaded dynamically to reduce initial bundle size
 */
function ConversationsListComponent({
  conversations,
  currentId,
  onSelect,
  onDelete,
}: ConversationsListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!onDelete) return;

    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (!conversations?.length) {
    return (
      <p className="px-3 py-2 text-sm text-muted-foreground">
        No conversations yet
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          className={cn(
            'group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted cursor-pointer',
            currentId === conv.id && 'bg-muted',
          )}
          onClick={() => onSelect(conv.id)}
        >
          <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">
            {conv.title || `Chat ${formatDate(conv.createdAt)}`}
          </span>
          {onDelete && (
            <button
              onClick={(e) => handleDelete(e, conv.id)}
              disabled={deletingId === conv.id}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all disabled:opacity-50"
              title="Delete conversation"
            >
              {deletingId === conv.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export const ConversationsList = memo(ConversationsListComponent);
