'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Shield,
  Bell,
  Moon,
  Sun,
  Monitor,
  Key,
  Globe,
  Clock,
  Database,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/lib/store';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { user } = useAuthStore();

  // Local state for settings
  const [notifications, setNotifications] = useState({
    email: true,
    scanComplete: true,
    findings: true,
    systemAlerts: false,
  });

  const [preferences, setPreferences] = useState({
    defaultTimeout: 300,
    autoAnalyze: true,
    compactView: false,
    timezone: 'UTC',
  });

  const handleSaveNotifications = () => {
    toast({
      title: 'Settings saved',
      description: 'Notification preferences have been updated.',
    });
  };

  const handleSavePreferences = () => {
    toast({
      title: 'Settings saved',
      description: 'Application preferences have been updated.',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Settings className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your application preferences and notifications
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize how HexStrike looks on your device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => setTheme('light')}
                >
                  <Sun className="h-4 w-4 mr-2" />
                  Light
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => setTheme('dark')}
                >
                  <Moon className="h-4 w-4 mr-2" />
                  Dark
                </Button>
                <Button
                  variant={theme === 'system' ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => setTheme('system')}
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  System
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Compact View</Label>
                <p className="text-xs text-muted-foreground">
                  Use a more condensed layout for tables and lists
                </p>
              </div>
              <Switch
                checked={preferences.compactView}
                onCheckedChange={(checked) =>
                  setPreferences((p) => ({ ...p, compactView: checked }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure how you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Receive email updates about your account
                </p>
              </div>
              <Switch
                checked={notifications.email}
                onCheckedChange={(checked) =>
                  setNotifications((n) => ({ ...n, email: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Scan Complete</Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when a scan finishes
                </p>
              </div>
              <Switch
                checked={notifications.scanComplete}
                onCheckedChange={(checked) =>
                  setNotifications((n) => ({ ...n, scanComplete: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>New Findings</Label>
                <p className="text-xs text-muted-foreground">
                  Alert when critical or high findings are discovered
                </p>
              </div>
              <Switch
                checked={notifications.findings}
                onCheckedChange={(checked) =>
                  setNotifications((n) => ({ ...n, findings: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>System Alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Maintenance and system-wide notifications
                </p>
              </div>
              <Switch
                checked={notifications.systemAlerts}
                onCheckedChange={(checked) =>
                  setNotifications((n) => ({ ...n, systemAlerts: checked }))
                }
              />
            </div>

            <Button onClick={handleSaveNotifications} className="w-full mt-4">
              Save Notifications
            </Button>
          </CardContent>
        </Card>

        {/* Scanning Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Scanning Preferences
            </CardTitle>
            <CardDescription>
              Default settings for new scans
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default Timeout (seconds)</Label>
              <Input
                type="number"
                min={30}
                max={3600}
                value={preferences.defaultTimeout}
                onChange={(e) =>
                  setPreferences((p) => ({
                    ...p,
                    defaultTimeout: parseInt(e.target.value) || 300,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Default timeout for new scan runs (30-3600 seconds)
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Analyze Results</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically analyze scan results with AI
                </p>
              </div>
              <Switch
                checked={preferences.autoAnalyze}
                onCheckedChange={(checked) =>
                  setPreferences((p) => ({ ...p, autoAnalyze: checked }))
                }
              />
            </div>

            <Button onClick={handleSavePreferences} className="w-full mt-4">
              Save Preferences
            </Button>
          </CardContent>
        </Card>

        {/* Regional Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Regional Settings
            </CardTitle>
            <CardDescription>
              Language and timezone preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={preferences.timezone}
                onValueChange={(value) =>
                  setPreferences((p) => ({ ...p, timezone: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  <SelectItem value="Europe/London">London (GMT)</SelectItem>
                  <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Format</Label>
              <Select defaultValue="iso">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="iso">ISO (2024-01-28)</SelectItem>
                  <SelectItem value="us">US (01/28/2024)</SelectItem>
                  <SelectItem value="eu">EU (28/01/2024)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* API & Integrations (Admin only) */}
        {user?.role === 'ADMIN' && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API & Integrations
              </CardTitle>
              <CardDescription>
                Manage API keys and external integrations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Anthropic API Key</Label>
                  <Input
                    type="password"
                    placeholder="sk-ant-..."
                    defaultValue="••••••••••••••••"
                  />
                  <p className="text-xs text-muted-foreground">
                    Required for AI-powered analysis features
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>HexStrike MCP URL</Label>
                  <Input
                    placeholder="http://localhost:8888"
                    defaultValue="http://localhost:8888"
                  />
                  <p className="text-xs text-muted-foreground">
                    URL of the HexStrike AI MCP server
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Database Connection
                </h4>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span>PostgreSQL connected</span>
                  <span className="text-muted-foreground">- localhost:5432</span>
                </div>
              </div>

              <Button className="w-full mt-4">
                Save Integration Settings
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
