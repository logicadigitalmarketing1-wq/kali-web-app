'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Shield,
  ShieldCheck,
  Eye,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  UserPlus,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { api, type User, type Scope } from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/lib/store';

interface UserScope {
  scope: {
    id: string;
    name: string;
    isActive: boolean;
  };
}

interface UserWithCounts extends User {
  totpSecret?: {
    verified: boolean;
  } | null;
  scopes?: UserScope[];
  _count?: {
    scopes: number;
    runs: number;
  };
}

export default function AdminUsersPage() {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<UserWithCounts | null>(null);
  const [editForm, setEditForm] = useState<{ role: string; isActive: boolean }>({
    role: 'VIEWER',
    isActive: true,
  });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'VIEWER',
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: api.getUsers,
  });

  const { data: scopes } = useQuery({
    queryKey: ['admin-scopes'],
    queryFn: api.getScopes,
  });

  const createMutation = useMutation({
    mutationFn: (data: { email: string; password: string; name?: string; role?: string }) =>
      api.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: tCommon('success'), description: t('userCreated') });
      setIsAddDialogOpen(false);
      setAddForm({ email: '', password: '', name: '', role: 'VIEWER' });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('userCreated'),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: string; isActive?: boolean } }) =>
      api.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: tCommon('success'), description: t('userUpdated') });
      setEditingUser(null);
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('userUpdated'),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: tCommon('success'), description: t('userDeleted') });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('userDeleted'),
      });
    },
  });

  const assignScopeMutation = useMutation({
    mutationFn: ({ scopeId, userId }: { scopeId: string; userId: string }) =>
      api.assignScopeToUser(scopeId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: t('scopeAssigned') });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error instanceof Error ? error.message : 'Failed to assign scope',
      });
    },
  });

  const removeScopeMutation = useMutation({
    mutationFn: ({ scopeId, userId }: { scopeId: string; userId: string }) =>
      api.removeScopeFromUser(scopeId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: t('scopeRemoved') });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error instanceof Error ? error.message : 'Failed to remove scope',
      });
    },
  });

  const handleAddUser = () => {
    const data: { email: string; password: string; name?: string; role?: string } = {
      email: addForm.email,
      password: addForm.password,
      role: addForm.role,
    };
    if (addForm.name.trim()) {
      data.name = addForm.name.trim();
    }
    createMutation.mutate(data);
  };

  const handleOpenEdit = (user: UserWithCounts) => {
    setEditingUser(user);
    setEditForm({
      role: user.role,
      isActive: user.isActive,
    });
  };

  const handleSaveEdit = () => {
    if (!editingUser) return;
    updateMutation.mutate({
      id: editingUser.id,
      data: editForm,
    });
  };

  const handleToggleActive = (user: UserWithCounts) => {
    if (user.id === currentUser?.id) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: tCommon('error'),
      });
      return;
    }
    updateMutation.mutate({
      id: user.id,
      data: { isActive: !user.isActive },
    });
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'critical';
      case 'ENGINEER':
        return 'high';
      default:
        return 'default';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <ShieldCheck className="h-4 w-4" />;
      case 'ENGINEER':
        return <Shield className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
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
            <Users className="h-8 w-8" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('description')}
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          {t('addUser')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>
            {users?.length || 0} {t('title').toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('role')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('assignedScopes')}</TableHead>
                <TableHead>Runs</TableHead>
                <TableHead>{t('createdAt')}</TableHead>
                <TableHead className="text-right">{tCommon('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user: UserWithCounts) => (
                <TableRow key={user.id} className={!user.isActive ? 'opacity-60' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">
                        {(user.name || user.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{user.name || user.email}</p>
                        {user.name && (
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        )}
                        {user.id === currentUser?.id && (
                          <span className="text-xs text-muted-foreground">({tCommon('you') || 'You'})</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getRoleBadgeVariant(user.role) as 'critical' | 'high' | 'default'}
                      className="flex items-center gap-1 w-fit"
                    >
                      {getRoleIcon(user.role)}
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {user.isActive ? (
                        <Badge variant="default" className="bg-green-600">
                          <UserCheck className="h-3 w-3 mr-1" />
                          {t('active')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <UserX className="h-3 w-3 mr-1" />
                          {t('inactive')}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {user.scopes && user.scopes.length > 0 ? (
                        user.scopes.slice(0, 3).map((us) => (
                          <Badge key={us.scope.id} variant="outline" className="text-xs">
                            {us.scope.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">{t('noScopes')}</span>
                      )}
                      {user.scopes && user.scopes.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{user.scopes.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">
                      {user._count?.runs ?? 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Switch
                        checked={user.isActive}
                        onCheckedChange={() => handleToggleActive(user)}
                        disabled={user.id === currentUser?.id}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            disabled={user.id === currentUser?.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('deleteUser')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('confirmDelete')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {tCommon('delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editUser')}</DialogTitle>
            <DialogDescription>
              {t('description')} - {editingUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('role')}</Label>
              <Select
                value={editForm.role}
                onValueChange={(value) => setEditForm((f) => ({ ...f, role: value }))}
                disabled={editingUser?.id === currentUser?.id}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      {t('roles.admin')} - {t('roles.adminDescription')}
                    </div>
                  </SelectItem>
                  <SelectItem value="ENGINEER">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {t('roles.engineer')} - {t('roles.engineerDescription')}
                    </div>
                  </SelectItem>
                  <SelectItem value="VIEWER">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      {t('roles.viewer')} - {t('roles.viewerDescription')}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('status')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('inactive')}
                </p>
              </div>
              <Switch
                checked={editForm.isActive}
                onCheckedChange={(checked) => setEditForm((f) => ({ ...f, isActive: checked }))}
                disabled={editingUser?.id === currentUser?.id}
              />
            </div>

            {/* Scope Assignment */}
            <div className="pt-4 border-t">
              <Label className="text-base">{t('assignScopes')}</Label>
              <p className="text-xs text-muted-foreground mb-3">
                {t('selectScopes')}
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {scopes?.map((scope: Scope) => {
                  const isAssigned = editingUser?.scopes?.some(
                    (us) => us.scope.id === scope.id
                  );
                  return (
                    <div
                      key={scope.id}
                      className="flex items-center gap-3 p-2 border rounded-lg"
                    >
                      <Checkbox
                        id={`scope-${scope.id}`}
                        checked={isAssigned}
                        onCheckedChange={(checked) => {
                          if (!editingUser) return;
                          if (checked) {
                            assignScopeMutation.mutate({
                              scopeId: scope.id,
                              userId: editingUser.id,
                            });
                          } else {
                            removeScopeMutation.mutate({
                              scopeId: scope.id,
                              userId: editingUser.id,
                            });
                          }
                        }}
                        disabled={assignScopeMutation.isPending || removeScopeMutation.isPending}
                      />
                      <label htmlFor={`scope-${scope.id}`} className="flex-1 cursor-pointer">
                        <p className="font-medium text-sm">{scope.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {scope.cidrs.length} CIDRs, {scope.hosts.length} hosts
                        </p>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addUser')}</DialogTitle>
            <DialogDescription>
              {t('description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')}</Label>
              <Input
                id="name"
                placeholder={t('namePlaceholder')}
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('emailPlaceholder')}
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('passwordPlaceholder')}
                value={addForm.password}
                onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('role')}</Label>
              <Select
                value={addForm.role}
                onValueChange={(value) => setAddForm((f) => ({ ...f, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      {t('roles.admin')} - {t('roles.adminDescription')}
                    </div>
                  </SelectItem>
                  <SelectItem value="ENGINEER">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {t('roles.engineer')} - {t('roles.engineerDescription')}
                    </div>
                  </SelectItem>
                  <SelectItem value="VIEWER">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      {t('roles.viewer')} - {t('roles.viewerDescription')}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={createMutation.isPending || !addForm.email || !addForm.password}
            >
              {t('addUser')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
