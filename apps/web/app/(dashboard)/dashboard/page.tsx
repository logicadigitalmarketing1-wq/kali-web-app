'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['findings-stats'],
    queryFn: async () => {
      const res = await fetch('/api/findings/stats', { credentials: 'include' });
      if (!res.ok) return {};
      return res.json();
    },
  });

  const { data: recentRuns } = useQuery({
    queryKey: ['recent-runs'],
    queryFn: async () => {
      const res = await fetch('/api/runs?limit=5', { credentials: 'include' });
      if (!res.ok) return { runs: [] };
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-500">Security assessment overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{stats?.critical || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">High</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-500">{stats?.high || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Medium</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-500">{stats?.medium || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Low</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-500">{stats?.low || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Info</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-500">{stats?.info || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRuns?.runs?.length > 0 ? (
            <div className="space-y-3">
              {recentRuns.runs.map((run: any) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{run.tool?.displayName}</p>
                    <p className="text-sm text-gray-500">{run.targetHost}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-1 text-xs rounded ${
                        run.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : run.status === 'running'
                          ? 'bg-blue-100 text-blue-800'
                          : run.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {run.status}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(run.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No runs yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
