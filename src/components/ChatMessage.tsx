/**
 * ChatMessage Component
 * Displays a single chat message (user or assistant)
 */

import { User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiResponse } from './ApiResponse';
import { ThinkingIndicator } from './ThinkingIndicator';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming = false }: ChatMessageProps) {
  const isUser = role === 'user';
  const isSystem = role === 'system';

  if (isSystem) return null; // Don't display system messages

  // Try to extract API response from content
  const parseApiResponse = (text: string) => {
    // Look for JSON code blocks that contain API response data
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        // Check if it looks like an API response
        if (data.url || data.status || data.method) {
          return {
            response: data,
            remainingText: text.replace(jsonMatch[0], '').trim(),
          };
        }
      } catch {
        // Not valid JSON, continue
      }
    }

    // Also try to find inline JSON objects for responses
    try {
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('{') && line.endsWith('}')) {
          try {
            const data = JSON.parse(line);
            if (data.url || data.status || data.method) {
              return {
                response: data,
                remainingText: lines.filter((_, idx) => idx !== i).join('\n').trim(),
              };
            }
          } catch {
            // Continue
          }
        }
      }
    } catch {
      // Continue
    }

    return null;
  };

  const parsed = !isUser ? parseApiResponse(content) : null;

  // Convert URLs to clickable links and add citations
  const renderContentWithLinks = (text: string) => {
    // URL regex pattern
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        // This is a URL
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-lg border',
        isUser
          ? 'bg-primary/5 border-primary/20'
          : 'bg-card border-border'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2">
        <div className="font-bold text-sm text-foreground">
          {isUser ? 'You' : 'Assistant'}
        </div>

        {/* Text content */}
        {!content && isStreaming ? (
          <ThinkingIndicator message="Thinking..." />
        ) : parsed ? (
          <>
            {parsed.remainingText && (
              <div className="text-base leading-relaxed text-foreground">
                {renderContentWithLinks(parsed.remainingText)}
              </div>
            )}
            <ApiResponse
              url={parsed.response.url}
              method={parsed.response.method}
              status={parsed.response.status}
              statusText={parsed.response.statusText}
              headers={parsed.response.headers}
              body={parsed.response.body}
              duration={parsed.response.duration}
              error={parsed.response.error}
            />
          </>
        ) : (
          <div className="text-base leading-relaxed whitespace-pre-wrap break-words text-foreground">
            {renderContentWithLinks(content)}
          </div>
        )}
      </div>
    </div>
  );
}
