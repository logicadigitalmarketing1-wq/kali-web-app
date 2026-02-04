'use client';

import { useQuery } from '@tanstack/react-query';
import { Wrench, Search } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ToolsPage() {
  const t = useTranslations('tools');
  const [search, setSearch] = useState('');

  const { data: categories, isLoading } = useQuery({
    queryKey: ['tool-categories'],
    queryFn: api.getToolCategories,
  });

  const filteredCategories = categories?.map((category) => ({
    ...category,
    tools: category.tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(search.toLowerCase()) ||
        tool.description.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter((category) => category.tools.length > 0);

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
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs defaultValue={filteredCategories?.[0]?.name || 'all'} className="space-y-4">
        <div className="relative">
          <TabsList className="flex h-auto w-full justify-start gap-2 overflow-x-auto pb-2 md:flex-wrap md:overflow-visible">
            {filteredCategories?.map((category) => (
              <TabsTrigger
                key={category.id}
                value={category.name}
                className="shrink-0 whitespace-nowrap"
              >
                {category.name} ({category.tools.length})
              </TabsTrigger>
            ))}
          </TabsList>
          {/* Scroll indicator gradient for mobile */}
          <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-background to-transparent md:hidden" />
        </div>

        {filteredCategories?.map((category) => (
          <TabsContent key={category.id} value={category.name}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {category.tools.map((tool) => (
                <Link key={tool.id} href={`/tools/${tool.slug}`}>
                  <Card className="h-full transition-colors hover:bg-muted/50">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Wrench className="h-5 w-5 text-primary" />
                          <CardTitle className="text-lg">{tool.name}</CardTitle>
                        </div>
                        <RiskBadge level={tool.riskLevel} />
                      </div>
                      <CardDescription className="line-clamp-2">
                        {tool.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">{category.name}</Badge>
                        {!tool.isEnabled && (
                          <Badge variant="secondary">{t('disabled')}</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {filteredCategories?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <Wrench className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-lg font-medium">{t('noTools')}</p>
          <p className="text-muted-foreground">{t('noToolsDescription')}</p>
        </div>
      )}
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const variants: Record<string, 'critical' | 'high' | 'medium' | 'low' | 'info'> = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
    INFO: 'info',
  };

  return (
    <Badge variant={variants[level] || 'info'} className="text-xs">
      {level}
    </Badge>
  );
}
