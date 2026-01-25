'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ToolsPage() {
  const { data: categories } = useQuery({
    queryKey: ['tool-categories'],
    queryFn: async () => {
      const res = await fetch('/api/tools/categories', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: tools } = useQuery({
    queryKey: ['tools'],
    queryFn: async () => {
      const res = await fetch('/api/tools', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const groupedTools = tools?.reduce((acc: any, tool: any) => {
    const cat = tool.category?.name || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tool);
    return acc;
  }, {}) || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tools</h1>
        <p className="text-gray-500">Security assessment tools catalog</p>
      </div>

      {categories?.map((category: any) => (
        <div key={category.id} className="space-y-4">
          <h2 className="text-xl font-semibold">{category.displayName}</h2>
          <p className="text-gray-500 text-sm">{category.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedTools[category.name]?.map((tool: any) => (
              <Link key={tool.id} href={`/tools/${tool.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{tool.displayName}</CardTitle>
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          tool.riskLevel === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : tool.riskLevel === 'high'
                            ? 'bg-orange-100 text-orange-800'
                            : tool.riskLevel === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : tool.riskLevel === 'low'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {tool.riskLevel}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
