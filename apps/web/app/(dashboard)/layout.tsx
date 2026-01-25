'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: 'grid' },
  { name: 'Tools', href: '/tools', icon: 'wrench' },
  { name: 'Runs', href: '/runs', icon: 'play' },
  { name: 'Findings', href: '/findings', icon: 'alert' },
  { name: 'Chat', href: '/chat', icon: 'message' },
];

const adminNavigation = [
  { name: 'Users', href: '/admin/users', icon: 'users' },
  { name: 'Scopes', href: '/admin/scopes', icon: 'shield' },
  { name: 'Audit Log', href: '/admin/audit', icon: 'list' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Not authenticated');
        return res.json();
      })
      .then(setUser)
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-xl font-bold">SecureScope</h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center px-3 py-2 rounded-md hover:bg-gray-800 transition-colors"
            >
              <span>{item.name}</span>
            </Link>
          ))}

          {user?.role === 'admin' && (
            <>
              <div className="pt-4 pb-2">
                <p className="px-3 text-xs font-semibold text-gray-400 uppercase">
                  Admin
                </p>
              </div>
              {adminNavigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center px-3 py-2 rounded-md hover:bg-gray-800 transition-colors"
                >
                  <span>{item.name}</span>
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{user?.username}</p>
              <p className="text-xs text-gray-400">{user?.role}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-8 overflow-auto bg-gray-100 dark:bg-gray-950">
          {children}
        </main>
      </div>
    </div>
  );
}
