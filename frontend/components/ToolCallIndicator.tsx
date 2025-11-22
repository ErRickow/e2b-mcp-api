/**
 * ToolCallIndicator Component
 * Shows when AI is calling tools (making API requests)
 */

import { Loader2, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ToolCallIndicatorProps {
  toolName?: string;
  args?: Record<string, any>;
}

export function ToolCallIndicator({ toolName, args }: ToolCallIndicatorProps) {
  return (
    <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
          <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Making API request...
          </p>
          {toolName && (
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              {toolName}
              {args?.url && ` → ${args.url}`}
              {args?.method && ` (${args.method})`}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
