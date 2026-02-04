'use client';

import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Wrench,
  Play,
  AlertTriangle,
  MessageSquare,
  Shield,
  Users,
  ChevronLeft,
  ChevronRight,
  Zap,
  Loader2,
  Clock,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSidebarStore } from '@/lib/store';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Link } from '@/i18n/routing';

export function Sidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { isOpen, toggle } = useSidebarStore();
  const { user } = useAuthStore();

  // Fetch smart scan status counts for indicators
  const { data: scanCounts } = useQuery({
    queryKey: ['smart-scan-counts'],
    queryFn: () => api.getSmartScanCounts(),
    refetchInterval: 5000,
  });

  const scanStats = {
    running: scanCounts?.RUNNING || 0,
    queued: scanCounts?.CREATED || 0,
  };

  const navigation = [
    { name: t('dashboard'), href: '/dashboard', icon: LayoutDashboard },
    { name: t('smartScan'), href: '/smart-scan', icon: Zap },
    { name: t('tools'), href: '/tools', icon: Wrench },
    { name: t('runs'), href: '/runs', icon: Play },
    { name: t('findings'), href: '/findings', icon: AlertTriangle },
    { name: t('chat'), href: '/chat', icon: MessageSquare },
    { name: t('messages'), href: '/messages', icon: MessageCircle },
  ];

  const adminNavigation = [
    { name: t('users'), href: '/admin/users', icon: Users },
    { name: t('scopes'), href: '/admin/scopes', icon: Shield },
  ];

  // Remove locale prefix from pathname for comparison
  const cleanPathname = pathname.replace(/^\/(en|fr)/, '') || '/';

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-300',
        isOpen ? 'w-64' : 'w-16',
      )}
    >
      <div className="flex h-16 items-center justify-between border-b px-4">
        {isOpen && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">HexStrike</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className={cn(!isOpen && 'mx-auto')}
        >
          {isOpen ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {navigation.map((item) => {
          const isActive = cleanPathname === item.href || cleanPathname.startsWith(`${item.href}/`);
          const isSmartScan = item.href === '/smart-scan';

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                !isOpen && 'justify-center',
              )}
              title={!isOpen ? item.name : undefined}
            >
              <div className="relative">
                <item.icon className="h-5 w-5 shrink-0" />
                {!isOpen && isSmartScan && (scanStats.running > 0 || scanStats.queued > 0) && (
                  <span className={cn(
                    'absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full',
                    scanStats.running > 0 ? 'bg-blue-500 animate-pulse' : 'bg-yellow-500'
                  )} />
                )}
              </div>
              {isOpen && (
                <>
                  <span className="flex-1">{item.name}</span>
                  {isSmartScan && (scanStats.running > 0 || scanStats.queued > 0) && (
                    <div className="flex items-center gap-1">
                      {scanStats.running > 0 && (
                        <span className="flex items-center gap-0.5 text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {scanStats.running}
                        </span>
                      )}
                      {scanStats.queued > 0 && (
                        <span className="flex items-center gap-0.5 text-xs bg-yellow-500 text-white px-1.5 py-0.5 rounded-full">
                          <Clock className="h-3 w-3" />
                          {scanStats.queued}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </Link>
          );
        })}

        {user?.role === 'ADMIN' && (
          <>
            <div className="my-4 border-t" />
            <div className={cn('px-3 py-2 text-xs font-semibold text-muted-foreground', !isOpen && 'text-center')}>
              {isOpen ? t('admin') : '...'}
            </div>
            {adminNavigation.map((item) => {
              const isActive = cleanPathname === item.href || cleanPathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    !isOpen && 'justify-center',
                  )}
                  title={!isOpen ? item.name : undefined}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {isOpen && <span>{item.name}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="border-t p-4">
        {isOpen && (
          <div className="text-xs text-muted-foreground">
            HexStrike Security Platform
            <br />
            v0.1.0
          </div>
        )}
      </div>
    </aside>
  );
}
