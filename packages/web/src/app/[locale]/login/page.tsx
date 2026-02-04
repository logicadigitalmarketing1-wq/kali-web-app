'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const totpSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

type LoginForm = z.infer<typeof loginSchema>;
type TotpForm = z.infer<typeof totpSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { setUser } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const totpForm = useForm<TotpForm>({
    resolver: zodResolver(totpSchema),
    defaultValues: { code: '' },
  });

  const onLogin = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const result = await api.login(data.email, data.password);
      if (result.requiresTwoFactor) {
        setRequiresTwoFactor(true);
      } else {
        setUser(result.user);
        router.push('/dashboard');
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Login failed';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onVerifyTotp = async (data: TotpForm) => {
    setIsLoading(true);
    try {
      const result = await api.verifyTotp(data.code);
      setUser(result.user);
      router.push('/dashboard');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Verification failed';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">HexStrike</CardTitle>
          <CardDescription>
            {requiresTwoFactor
              ? 'Enter your two-factor authentication code'
              : 'Sign in to access the security platform'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requiresTwoFactor ? (
            <form onSubmit={totpForm.handleSubmit(onVerifyTotp)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Authentication Code</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  className="text-center text-2xl tracking-widest"
                  {...totpForm.register('code')}
                />
                {totpForm.formState.errors.code && (
                  <p className="text-sm text-destructive">
                    {totpForm.formState.errors.code.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Verifying...' : 'Verify'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setRequiresTwoFactor(false)}
              >
                Back to login
              </Button>
            </form>
          ) : (
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@hexstrike.local"
                  {...loginForm.register('email')}
                />
                {loginForm.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {loginForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    {...loginForm.register('password')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
