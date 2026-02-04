'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Mail,
  Shield,
  Key,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle,
  Smartphone,
  QrCode,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/lib/store';

export default function ProfilePage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [is2faDialogOpen, setIs2faDialogOpen] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  // Fetch user profile with additional details
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await api.getMe();
      return res;
    },
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'New passwords do not match',
      });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Password must be at least 8 characters',
      });
      return;
    }

    // TODO: Implement password change API call
    toast({
      title: 'Password updated',
      description: 'Your password has been changed successfully.',
    });
    setIsChangingPassword(false);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const handleSetup2fa = () => {
    // TODO: Implement 2FA setup
    toast({
      title: '2FA Setup',
      description: 'Two-factor authentication setup initiated.',
    });
    setIs2faDialogOpen(true);
  };

  const handleVerify2fa = () => {
    if (totpCode.length !== 6) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a 6-digit code',
      });
      return;
    }

    // TODO: Implement 2FA verification
    toast({
      title: '2FA Enabled',
      description: 'Two-factor authentication has been enabled.',
    });
    setIs2faDialogOpen(false);
    setTotpCode('');
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <User className="h-8 w-8" />
          Profile
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and security
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your personal account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{user?.email}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={getRoleBadgeVariant(user?.role || '') as any}>
                      {user?.role}
                    </Badge>
                    {profile?.user?.twoFactorEnabled && (
                      <Badge variant="default" className="bg-green-600">
                        <Shield className="h-3 w-3 mr-1" />
                        2FA Enabled
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Input id="email" value={user?.email || ''} disabled />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Account Status</Label>
                  <div className="flex items-center gap-2 h-9 px-3 border rounded-md">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Active</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security
              </CardTitle>
              <CardDescription>
                Manage your password and two-factor authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Password Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Password</h4>
                    <p className="text-sm text-muted-foreground">
                      Last changed: Never
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setIsChangingPassword(!isChangingPassword)}
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Change Password
                  </Button>
                </div>

                {isChangingPassword && (
                  <form onSubmit={handlePasswordChange} className="space-y-4 p-4 border rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) =>
                          setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) =>
                          setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) =>
                          setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit">Update Password</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsChangingPassword(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              {/* 2FA Section */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      Two-Factor Authentication
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {profile?.user?.twoFactorEnabled
                        ? 'Your account is protected with 2FA'
                        : 'Add an extra layer of security to your account'}
                    </p>
                  </div>
                  {profile?.user?.twoFactorEnabled ? (
                    <Badge variant="default" className="bg-green-600">Enabled</Badge>
                  ) : (
                    <Dialog open={is2faDialogOpen} onOpenChange={setIs2faDialogOpen}>
                      <DialogTrigger asChild>
                        <Button onClick={handleSetup2fa}>
                          <QrCode className="h-4 w-4 mr-2" />
                          Enable 2FA
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Setup Two-Factor Authentication</DialogTitle>
                          <DialogDescription>
                            Scan the QR code with your authenticator app
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="flex justify-center p-4 bg-white rounded-lg">
                            <div className="h-48 w-48 bg-muted flex items-center justify-center">
                              <QrCode className="h-24 w-24 text-muted-foreground" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Enter verification code</Label>
                            <Input
                              placeholder="000000"
                              maxLength={6}
                              value={totpCode}
                              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                            />
                          </div>
                          <Button onClick={handleVerify2fa} className="w-full">
                            Verify and Enable
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                {profile?.user?.recoveryCodesRemaining !== undefined && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Recovery Codes Remaining</span>
                      <Badge variant={profile.user.recoveryCodesRemaining < 3 ? 'destructive' : 'default'}>
                        {profile.user.recoveryCodesRemaining} / 10
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-green-500" />
                  <div>
                    <p className="text-sm font-medium">Logged in</p>
                    <p className="text-xs text-muted-foreground">Just now</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Ran Nmap scan</p>
                    <p className="text-xs text-muted-foreground">2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-yellow-500" />
                  <div>
                    <p className="text-sm font-medium">Settings updated</p>
                    <p className="text-xs text-muted-foreground">Yesterday</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Current Session</p>
                    <p className="text-xs text-muted-foreground">Chrome on macOS</p>
                  </div>
                  <Badge variant="default" className="bg-green-600">Active</Badge>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-4">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Sign Out All Devices
              </Button>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <Button variant="destructive" className="w-full">
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
