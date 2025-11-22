/**
 * ToolExecutionCard Component
 * Shows tool execution with detailed status
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';

export type ToolStatus = 'pending' | 'running' | 'complete' | 'error';

interface ToolExecutionCardProps {
  toolName: string;
  status: ToolStatus;
  args?: Record<string, any>;
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export function ToolExecutionCard({
  toolName,
  status,
  args,
  result,
  error,
  startTime,
  endTime,
}: ToolExecutionCardProps) {
  const [isExpanded, setIsExpanded] = useState(status === 'running' || status === 'error');

  // Auto-expand when args change (tool is ready to execute)
  useEffect(() => {
    if (status === 'running' && args && Object.keys(args).length > 0) {
      setIsExpanded(true);
    }
  }, [status, args]);

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Loader2 className="h-4 w-4 text-amber-600 dark:text-amber-400 animate-spin" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-orange-600 dark:text-orange-400 animate-spin" />;
      case 'complete':
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return 'border-2 border-amber-400 dark:border-amber-600 bg-amber-100 dark:bg-amber-900';
      case 'running':
        return 'border-2 border-orange-400 dark:border-orange-600 bg-orange-100 dark:bg-orange-900';
      case 'complete':
        return 'border-2 border-green-400 dark:border-green-600 bg-green-100 dark:bg-green-900';
      case 'error':
        return 'border-2 border-red-400 dark:border-red-600 bg-red-100 dark:bg-red-900';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return 'Queued';
      case 'running':
        return 'Executing';
      case 'complete':
        return 'Complete';
      case 'error':
        return 'Failed';
    }
  };

  const getDuration = () => {
    if (startTime && endTime) {
      return `${endTime - startTime}ms`;
    }
    return null;
  };

  const formatJson = (data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <Card className={`p-3 ${getStatusColor()} transition-all`}>
      {/* Header - Always visible */}
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 flex-1">
          {getStatusIcon()}
          <Zap className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm font-mono font-medium text-foreground">{toolName}</span>
          <Badge variant="outline" className="text-xs">
            {getStatusText()}
          </Badge>
          {getDuration() && (
            <span className="text-xs text-muted-foreground">{getDuration()}</span>
          )}
        </div>
        <div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Details - Expandable */}
      {isExpanded && (
        <div className="mt-3 space-y-2 pl-9">
          {/* Arguments */}
          {args && Object.keys(args).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Arguments:</p>
              <div className="bg-muted/30 border rounded p-2">
                <pre className="text-xs font-mono text-foreground overflow-x-auto">{formatJson(args)}</pre>
              </div>
            </div>
          )}

          {/* Result */}
          {result && status === 'complete' && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Result:</p>
              <div className="bg-muted/30 border rounded p-2 max-h-48 overflow-y-auto">
                <pre className="text-xs font-mono text-foreground overflow-x-auto">{formatJson(result)}</pre>
              </div>
            </div>
          )}

          {/* Error */}
          {error && status === 'error' && (
            <div>
              <p className="text-xs font-medium text-destructive mb-1">Error:</p>
              <div className="bg-destructive/10 border border-destructive/20 rounded p-2">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            </div>
          )}

          {/* Running message */}
          {status === 'running' && (
            <p className="text-xs text-muted-foreground italic flex items-center gap-2 font-medium">
              <span className="text-base animate-pulse">⭐</span>
              {args && Object.keys(args).length > 0 ? 'Executing...' : 'Preparing...'}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
