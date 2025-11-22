/**
 * WebhookMonitor Component
 * Displays webhook URL and received events
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Trash2, RefreshCw, Webhook } from 'lucide-react';

interface WebhookEvent {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, any>;
  body: any;
  ip: string;
}

interface WebhookMonitorProps {
  webhookUrl?: string;
  events: WebhookEvent[];
  onRefresh?: () => void;
  onClear?: () => void;
  isLoading?: boolean;
}

export function WebhookMonitor({
  webhookUrl,
  events = [],
  onRefresh,
  onClear,
  isLoading = false,
}: WebhookMonitorProps) {
  const [copied, setCopied] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const handleCopy = async () => {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-blue-500';
      case 'POST':
        return 'bg-green-500';
      case 'PUT':
        return 'bg-yellow-500';
      case 'DELETE':
        return 'bg-red-500';
      case 'PATCH':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString() + '.' + date.getMilliseconds();
  };

  const formatJson = (data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhook Monitor
            </CardTitle>
            <CardDescription>
              Receive webhooks from external services
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            )}
            {onClear && events.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClear}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Webhook URL */}
        {webhookUrl && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Webhook URL</p>
            <div className="flex gap-2">
              <div className="flex-1 p-2 bg-muted rounded-md font-mono text-xs break-all">
                {webhookUrl}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="flex-shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Send webhook POSTs to this URL to test your integrations
            </p>
          </div>
        )}

        {/* Events List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Events ({events.length})
            </p>
          </div>

          {events.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              <Webhook className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No events received yet</p>
              <p className="text-xs mt-1">Send a POST request to the webhook URL above</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {[...events].reverse().map((event) => (
                <Card
                  key={event.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                >
                  <CardContent className="p-3 space-y-2">
                    {/* Event Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={`${getMethodColor(event.method)} text-white`}>
                          {event.method}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">
                          {event.path}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>

                    {/* Expanded Details */}
                    {expandedEvent === event.id && (
                      <div className="space-y-3 mt-3 pt-3 border-t">
                        {/* IP */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">IP Address</p>
                          <p className="text-xs font-mono">{event.ip}</p>
                        </div>

                        {/* Query Params */}
                        {Object.keys(event.query).length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Query Parameters</p>
                            <div className="bg-muted rounded p-2">
                              <pre className="text-xs font-mono">{formatJson(event.query)}</pre>
                            </div>
                          </div>
                        )}

                        {/* Headers */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Headers</p>
                          <div className="bg-muted rounded p-2 max-h-32 overflow-y-auto">
                            <pre className="text-xs font-mono">{formatJson(event.headers)}</pre>
                          </div>
                        </div>

                        {/* Body */}
                        {event.body && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Body</p>
                            <div className="bg-muted rounded p-2 max-h-48 overflow-y-auto">
                              <pre className="text-xs font-mono">{formatJson(event.body)}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
