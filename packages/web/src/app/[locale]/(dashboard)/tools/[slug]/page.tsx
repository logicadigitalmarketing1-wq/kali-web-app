'use client';

import { useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Play, Clock, Shield, AlertTriangle, Info, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { api, type CreateRunDto } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/components/ui/use-toast';

interface ArgProperty {
  type: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  enumLabels?: string[];
}

interface ArgsSchema {
  type: string;
  properties?: Record<string, ArgProperty>;
}

export default function ToolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const slug = params.slug as string;

  // Get initial target from URL query params (for "New Scan" button from runs page)
  const initialTarget = searchParams.get('target') || '';

  // Form state
  const [target, setTarget] = useState(initialTarget);
  const [scopeId, setScopeId] = useState('');
  const [timeout, setTimeout] = useState(300);
  const [toolParams, setToolParams] = useState<Record<string, unknown>>({});

  // Parallel data fetching with useQueries
  const results = useQueries({
    queries: [
      {
        queryKey: ['tool', slug],
        queryFn: () => api.getTool(slug),
      },
      {
        queryKey: ['scopes'],
        queryFn: api.getScopes,
      },
    ],
  });

  const [toolQuery, scopesQuery] = results;
  const tool = toolQuery.data;
  const scopes = scopesQuery.data;
  const isLoading = toolQuery.isLoading;

  // Parse argsSchema
  const argsSchema = useMemo(() => {
    const manifest = tool?.manifests?.[0];
    if (!manifest?.argsSchema) return null;
    return manifest.argsSchema as unknown as ArgsSchema;
  }, [tool]);

  // Initialize defaults when tool loads
  useEffect(() => {
    if (argsSchema?.properties && Object.keys(toolParams).length === 0) {
      const defaults: Record<string, unknown> = {};
      Object.entries(argsSchema.properties).forEach(([key, prop]) => {
        if (prop.default !== undefined) {
          defaults[key] = prop.default;
        }
      });
      if (Object.keys(defaults).length > 0) {
        setToolParams(defaults);
      }
    }
  }, [argsSchema]);

  // Auto-select first scope
  useEffect(() => {
    if (scopes && scopes.length > 0 && !scopeId) {
      setScopeId(scopes[0].id);
    }
  }, [scopes, scopeId]);

  const createRunMutation = useMutation({
    mutationFn: (data: CreateRunDto) => api.createRun(data),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      toast({
        title: 'Run created',
        description: `Scan started for ${run.target}`,
      });
      router.push(`/runs/${run.id}`);
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create run',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!tool || !target || !scopeId) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill in all required fields',
      });
      return;
    }

    // Filter out empty/null values from params
    const filteredParams = Object.fromEntries(
      Object.entries(toolParams).filter(
        ([, v]) => v !== '' && v !== null && v !== undefined
      )
    );

    createRunMutation.mutate({
      toolSlug: tool.slug,
      target,
      scopeId,
      params: filteredParams,
      timeout,
    });
  };

  const updateParam = (key: string, value: unknown) => {
    setToolParams((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-lg font-medium">Tool not found</p>
        <Link href="/tools">
          <Button variant="ghost" className="mt-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to tools
          </Button>
        </Link>
      </div>
    );
  }

  const manifest = tool.manifests?.[0];

  // Group parameters into required and optional
  const requiredParams: [string, ArgProperty][] = [];
  const optionalParams: [string, ArgProperty][] = [];

  if (argsSchema?.properties) {
    Object.entries(argsSchema.properties).forEach(([key, prop]) => {
      if (prop.default !== undefined || prop.enum) {
        requiredParams.push([key, prop]);
      } else {
        optionalParams.push([key, prop]);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/tools">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{tool.name}</h1>
            <Badge variant={tool.riskLevel.toLowerCase() as 'critical' | 'high' | 'medium' | 'low' | 'info'}>
              {tool.riskLevel}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">{tool.description}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Required Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Target Configuration</CardTitle>
                <CardDescription>Configure the scan target and authorization scope</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="target" className="flex items-center gap-2">
                      Target <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="target"
                      placeholder="e.g., 192.168.1.1 or example.com"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      IP address, hostname, or CIDR range to scan
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scope" className="flex items-center gap-2">
                      Authorization Scope <span className="text-destructive">*</span>
                    </Label>
                    <Select value={scopeId} onValueChange={setScopeId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a scope" />
                      </SelectTrigger>
                      <SelectContent>
                        {scopes?.map((scope) => (
                          <SelectItem key={scope.id} value={scope.id}>
                            <div className="flex flex-col">
                              <span>{scope.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {scope.cidrs.slice(0, 2).join(', ')}
                                {scope.cidrs.length > 2 && ` +${scope.cidrs.length - 2} more`}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min={30}
                    max={3600}
                    value={timeout}
                    onChange={(e) => setTimeout(parseInt(e.target.value) || 300)}
                    className="max-w-[200px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum time the scan can run (30-3600 seconds)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Tool Parameters */}
            {argsSchema?.properties && Object.keys(argsSchema.properties).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tool Parameters</CardTitle>
                  <CardDescription>Configure {tool.name} specific options</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Primary Parameters (with defaults or enums) */}
                  {requiredParams.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        Primary Options
                      </h4>
                      <div className="grid gap-4">
                        {requiredParams.map(([key, prop]) => (
                          <ParameterField
                            key={key}
                            name={key}
                            property={prop}
                            value={toolParams[key]}
                            onChange={(value) => updateParam(key, value)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Advanced Parameters (optional) */}
                  {optionalParams.length > 0 && (
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="advanced" className="border-none">
                        <AccordionTrigger className="text-sm font-medium py-2 px-3 bg-muted/50 rounded-lg hover:bg-muted">
                          Advanced Options ({optionalParams.length})
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="grid gap-4 pt-4">
                            {optionalParams.map(([key, prop]) => (
                              <ParameterField
                                key={key}
                                name={key}
                                property={prop}
                                value={toolParams[key]}
                                onChange={(value) => updateParam(key, value)}
                              />
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Run Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={createRunMutation.isPending || !tool.isEnabled || !target || !scopeId}
            >
              <Play className="mr-2 h-5 w-5" />
              {createRunMutation.isPending ? 'Starting Scan...' : `Run ${tool.name}`}
            </Button>

            {!tool.isEnabled && (
              <p className="text-center text-sm text-destructive">
                This tool is currently disabled by an administrator
              </p>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Tool Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={tool.isEnabled ? 'default' : 'secondary'}>
                    {tool.isEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                {manifest && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Binary</span>
                      <code className="text-sm bg-muted px-2 py-1 rounded">{manifest.binary}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Default Timeout</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {manifest.timeout}s
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Memory Limit</span>
                      <span>{manifest.memoryLimit} MB</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">CPU Limit</span>
                      <span>{manifest.cpuLimit} cores</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {scopes && scopes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Your Scopes
                  </CardTitle>
                  <CardDescription>
                    Authorized targets for your account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {scopes.map((scope) => (
                      <div
                        key={scope.id}
                        className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                          scopeId === scope.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-muted-foreground/50'
                        }`}
                        onClick={() => setScopeId(scope.id)}
                      >
                        <p className="font-medium">{scope.name}</p>
                        {scope.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {scope.description}
                          </p>
                        )}
                        {scope.cidrs.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">CIDRs:</span> {scope.cidrs.slice(0, 3).join(', ')}
                            {scope.cidrs.length > 3 && ` +${scope.cidrs.length - 3} more`}
                          </p>
                        )}
                        {scope.hosts.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Hosts:</span> {scope.hosts.slice(0, 3).join(', ')}
                            {scope.hosts.length > 3 && ` +${scope.hosts.length - 3} more`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

// Dynamic Parameter Field Component
function ParameterField({
  name,
  property,
  value,
  onChange,
}: {
  name: string;
  property: ArgProperty;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .replace(/_/g, ' ');

  // Boolean switch
  if (property.type === 'boolean') {
    return (
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5 flex-1 mr-4">
          <Label htmlFor={name} className="font-medium cursor-pointer">
            {label}
          </Label>
          {property.description && (
            <p className="text-xs text-muted-foreground">{property.description}</p>
          )}
        </div>
        <Switch
          id={name}
          checked={(value as boolean) ?? (property.default as boolean) ?? false}
          onCheckedChange={onChange}
        />
      </div>
    );
  }

  // Enum dropdown
  if (property.enum) {
    return (
      <div className="space-y-2">
        <Label htmlFor={name}>{label}</Label>
        <Select
          value={(value as string) ?? (property.default as string) ?? ''}
          onValueChange={onChange}
        >
          <SelectTrigger>
            <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {property.enum.map((option, index) => (
              <SelectItem key={option} value={option}>
                <div className="flex flex-col">
                  <span>{property.enumLabels?.[index] || option}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {property.description && (
          <p className="text-xs text-muted-foreground">{property.description}</p>
        )}
      </div>
    );
  }

  // Number input
  if (property.type === 'number') {
    return (
      <div className="space-y-2">
        <Label htmlFor={name}>{label}</Label>
        <Input
          id={name}
          type="number"
          value={(value as number) ?? (property.default as number) ?? ''}
          onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : undefined)}
          placeholder={property.default !== undefined ? `Default: ${property.default}` : undefined}
        />
        {property.description && (
          <p className="text-xs text-muted-foreground">{property.description}</p>
        )}
      </div>
    );
  }

  // String input (default)
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        value={(value as string) ?? (property.default as string) ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={property.default !== undefined ? `Default: ${property.default}` : undefined}
      />
      {property.description && (
        <p className="text-xs text-muted-foreground">{property.description}</p>
      )}
    </div>
  );
}
