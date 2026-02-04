'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  Globe,
  Server,
  Users,
  Check,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { api, type Scope } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

interface ScopeUser {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
}

interface ScopeWithUsers extends Scope {
  users?: ScopeUser[];
}

interface ScopeForm {
  name: string;
  description: string;
  cidrs: string;
  hosts: string;
}

const defaultForm: ScopeForm = {
  name: '',
  description: '',
  cidrs: '',
  hosts: '',
};

export default function AdminScopesPage() {
  const t = useTranslations('scopes');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingScope, setEditingScope] = useState<Scope | null>(null);
  const [form, setForm] = useState<ScopeForm>(defaultForm);

  const { data: scopes, isLoading } = useQuery({
    queryKey: ['admin-scopes'],
    queryFn: api.getScopes,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; cidrs: string[]; hosts: string[] }) =>
      api.createScope(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-scopes'] });
      toast({ title: tCommon('success'), description: t('scopeCreated') });
      handleCloseDialog();
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('scopeCreated'),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateScope>[1] }) =>
      api.updateScope(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-scopes'] });
      toast({ title: tCommon('success'), description: t('scopeUpdated') });
      handleCloseDialog();
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('scopeUpdated'),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteScope(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-scopes'] });
      toast({ title: tCommon('success'), description: t('scopeDeleted') });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('scopeDeleted'),
      });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingScope(null);
    setForm(defaultForm);
  };

  const handleOpenCreate = () => {
    setEditingScope(null);
    setForm(defaultForm);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (scope: Scope) => {
    setEditingScope(scope);
    setForm({
      name: scope.name,
      description: scope.description || '',
      cidrs: scope.cidrs.join('\n'),
      hosts: scope.hosts.join('\n'),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cidrs = form.cidrs
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const hosts = form.hosts
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingScope) {
      updateMutation.mutate({
        id: editingScope.id,
        data: {
          name: form.name,
          description: form.description || undefined,
          cidrs,
          hosts,
        },
      });
    } else {
      createMutation.mutate({
        name: form.name,
        description: form.description || undefined,
        cidrs,
        hosts,
      });
    }
  };

  const handleToggleActive = (scope: Scope) => {
    updateMutation.mutate({
      id: scope.id,
      data: { isActive: !scope.isActive },
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('description')}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t('createScope')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingScope ? t('editScope') : t('createScope')}</DialogTitle>
              <DialogDescription>
                {editingScope
                  ? t('description')
                  : t('description')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('name')}</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t('namePlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t('scopeDescription')}</Label>
                <Input
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder={t('descriptionPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cidrs">
                  {t('cidrs')}
                  <span className="text-xs text-muted-foreground ml-2">({t('cidrsHelp')})</span>
                </Label>
                <Textarea
                  id="cidrs"
                  value={form.cidrs}
                  onChange={(e) => setForm((f) => ({ ...f, cidrs: e.target.value }))}
                  placeholder={t('cidrsPlaceholder')}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hosts">
                  {t('hosts')}
                  <span className="text-xs text-muted-foreground ml-2">({t('hostsHelp')})</span>
                </Label>
                <Textarea
                  id="hosts"
                  value={form.hosts}
                  onChange={(e) => setForm((f) => ({ ...f, hosts: e.target.value }))}
                  placeholder={t('hostsPlaceholder')}
                  rows={4}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingScope ? t('editScope') : t('createScope')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {scopes?.map((scope) => (
          <Card key={scope.id} className={!scope.isActive ? 'opacity-60' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">{scope.name}</CardTitle>
                  <Badge variant={scope.isActive ? 'default' : 'secondary'}>
                    {scope.isActive ? t('active') : t('inactive')}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={scope.isActive}
                    onCheckedChange={() => handleToggleActive(scope)}
                  />
                  <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(scope)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteScope')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('confirmDelete')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(scope.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {tCommon('delete')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              {scope.description && (
                <CardDescription>{scope.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Globe className="h-4 w-4" />
                    {t('cidrs')} ({scope.cidrs.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {scope.cidrs.length > 0 ? (
                      scope.cidrs.map((cidr) => (
                        <Badge key={cidr} variant="outline" className="font-mono text-xs">
                          {cidr}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('cidrsHelp')}</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Server className="h-4 w-4" />
                    {t('hosts')} ({scope.hosts.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {scope.hosts.length > 0 ? (
                      scope.hosts.map((host) => (
                        <Badge key={host} variant="outline" className="font-mono text-xs">
                          {host}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('hostsHelp')}</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Assigned Users Section */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Users className="h-4 w-4" />
                  {t('assignedUsers')} ({(scope as ScopeWithUsers).users?.length || 0})
                </div>
                <div className="flex flex-wrap gap-1">
                  {(scope as ScopeWithUsers).users && (scope as ScopeWithUsers).users!.length > 0 ? (
                    (scope as ScopeWithUsers).users!.map((us) => (
                      <Badge key={us.user.id} variant="secondary" className="text-xs">
                        {us.user.name || us.user.email}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('noUsers')}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {scopes?.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-lg font-medium">{t('noScopes')}</p>
              <p className="text-muted-foreground">{t('noScopesDescription')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
