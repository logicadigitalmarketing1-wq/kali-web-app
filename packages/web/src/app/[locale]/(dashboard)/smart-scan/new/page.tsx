'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

interface SmartScanFormData {
  target: string;
  objective: 'quick' | 'comprehensive' | 'stealth' | 'aggressive';
  maxTools: number;
  name?: string;
}

export default function NewSmartScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Get initial target from URL query params
  const initialTarget = searchParams.get('target') || '';

  const [formData, setFormData] = useState<SmartScanFormData>({
    target: initialTarget,
    objective: 'comprehensive',
    maxTools: 20,
    name: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: keyof SmartScanFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/smart-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create Smart Scan');
      }

      const scanResponse = await response.json();
      if (scanResponse.success) {
        const scanData = scanResponse.data;
        toast({
          title: 'Smart Scan Started',
          description: `Smart scan session created for ${formData.target}`,
        });
        router.push(`/smart-scan/${scanData.id}`);
      } else {
        throw new Error('Failed to create Smart Scan');
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to create Smart Scan. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/smart-scan">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Smart Scan</h1>
          <p className="text-muted-foreground">
            Configure and launch a new security assessment
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Target Configuration</CardTitle>
            <CardDescription>
              Configure your security scan parameters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="target">Target Domain or IP</Label>
                <Input
                  id="target"
                  placeholder="example.com"
                  value={formData.target}
                  onChange={(e) => handleInputChange('target', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="objective">Scan Objective</Label>
                <Select
                  value={formData.objective}
                  onValueChange={(value) => handleInputChange('objective', value as typeof formData.objective)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select objective" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quick">Quick Scan</SelectItem>
                    <SelectItem value="comprehensive">Comprehensive Scan</SelectItem>
                    <SelectItem value="stealth">Stealth Scan</SelectItem>
                    <SelectItem value="aggressive">Aggressive Scan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxTools">Maximum Tools</Label>
                <Input
                  id="maxTools"
                  type="number"
                  min="1"
                  max="50"
                  value={formData.maxTools}
                  onChange={(e) => handleInputChange('maxTools', parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Scan Name (Optional)</Label>
                <Input
                  id="name"
                  placeholder="My Security Scan"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !formData.target}
              >
                {isSubmitting ? 'Creating Scan...' : 'Start Smart Scan'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scan Protocol</CardTitle>
            <CardDescription>
              6-step security audit protocol
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Badge variant="outline">1</Badge>
                <span className="text-sm">Intelligence Gathering & Planning</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">2</Badge>
                <span className="text-sm">Automated Security Scanning</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">3</Badge>
                <span className="text-sm">Deep Reconnaissance</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">4</Badge>
                <span className="text-sm">Vulnerability Assessment</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">5</Badge>
                <span className="text-sm">Exploitation Chain Analysis</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">6</Badge>
                <span className="text-sm">Final Security Report</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
