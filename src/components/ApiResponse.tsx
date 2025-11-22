/**
 * ApiResponse Component
 * Beautiful visualization for API responses
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import { CodeGenerator } from './CodeGenerator';

interface ApiResponseProps {
  url?: string;
  method?: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: any;
  duration?: number;
  error?: string;
}

export function ApiResponse({
  url,
  method = 'GET',
  status,
  statusText,
  headers,
  body,
  duration,
  error,
}: ApiResponseProps) {
  // Determine status color
  const getStatusColor = (status?: number) => {
    if (!status) return 'bg-gray-500';
    if (status >= 200 && status < 300) return 'bg-green-500';
    if (status >= 300 && status < 400) return 'bg-blue-500';
    if (status >= 400 && status < 500) return 'bg-yellow-500';
    if (status >= 500) return 'bg-red-500';
    return 'bg-gray-500';
  };

  // Get status icon
  const getStatusIcon = (status?: number) => {
    if (!status) return <AlertCircle className="h-4 w-4" />;
    if (status >= 200 && status < 300) return <CheckCircle2 className="h-4 w-4" />;
    if (status >= 400) return <XCircle className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  };

  // Format JSON with syntax highlighting (simple version)
  const formatJson = (data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  if (error) {
    return (
      <Card className="p-4 border-destructive bg-destructive/5">
        <div className="flex items-start gap-3">
          <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-destructive mb-1">Error</p>
            <p className="text-sm text-destructive/90">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      {/* Request Info */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="font-mono">
          {method}
        </Badge>
        {status && (
          <div className="flex items-center gap-2">
            {getStatusIcon(status)}
            <Badge className={`${getStatusColor(status)} text-white`}>
              {status} {statusText}
            </Badge>
          </div>
        )}
        {duration && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{duration}ms</span>
          </div>
        )}
      </div>

      {url && (
        <div className="text-sm">
          <span className="text-muted-foreground">URL: </span>
          <code className="text-xs bg-muted px-2 py-1 rounded">{url}</code>
        </div>
      )}

      {/* Headers */}
      {headers && Object.keys(headers).length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
            Response Headers ({Object.keys(headers).length})
          </summary>
          <div className="mt-2 space-y-1">
            {Object.entries(headers).map(([key, value]) => (
              <div key={key} className="flex gap-2 text-xs">
                <span className="text-muted-foreground font-mono">{key}:</span>
                <span className="font-mono">{value}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Response Body */}
      {body && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Response Body</p>
          <div className="bg-muted rounded-lg p-3 overflow-x-auto">
            <pre className="text-xs font-mono">{formatJson(body)}</pre>
          </div>
        </div>
      )}

      {/* Code Generator */}
      {url && (
        <CodeGenerator url={url} method={method} headers={headers} body={body} />
      )}
    </Card>
  );
}
