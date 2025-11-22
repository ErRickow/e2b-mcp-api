/**
 * ThinkingIndicator Component
 * Shows AI reasoning/thinking process
 */

import { Card } from '@/components/ui/card';

interface ThinkingIndicatorProps {
  message?: string;
}

export function ThinkingIndicator({ message = 'Thinking...' }: ThinkingIndicatorProps) {
  return (
    <Card className="p-3 bg-muted/50">
      <div className="flex items-center gap-3">
        <span className="text-xl animate-pulse">⭐</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">
            {message}
          </p>
        </div>
      </div>
    </Card>
  );
}
