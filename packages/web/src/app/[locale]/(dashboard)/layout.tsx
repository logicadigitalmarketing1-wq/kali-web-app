'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { setUser, setLoading } = useAuthStore();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
  });

  const user = profile?.user;

  useEffect(() => {
    if (!isLoading) {
      if (error || !user) {
        setUser(null);
        router.push('/login');
      } else {
        setUser(user);
      }
      setLoading(false);
    }
  }, [user, isLoading, error, setUser, setLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto bg-muted/30 p-6">{children}</main>
      </div>
    </div>
  );
}
