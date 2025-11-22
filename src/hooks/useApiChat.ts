/**
 * useApiChat Hook
 * Manages AI chat with streaming and tool calling
 */

import { useState, useRef } from 'react';
import { useMcpTools } from './useMcpTools';
import { streamChatCompletion, type ChatMessage, type LLMProvider } from '@/lib/groq-client';
import type { UseApiChatReturn } from '@/types';
import type { ToolStatus } from '@/components/ToolExecutionCard';
import { useApiKeys } from './useLocalStorage';

export interface ToolExecution {
  id: string;
  toolName: string;
  status: ToolStatus;
  args?: Record<string, any>;
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export function useApiChat(): UseApiChatReturn {
  const { isReady, tools } = useMcpTools();
  const { apiKeys } = useApiKeys();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-detect available provider
  const getAvailableProvider = (): LLMProvider => {
    if (apiKeys.neosantara) return 'neosantara';
    if (apiKeys.groq) return 'groq';
    throw new Error('No LLM provider configured. Please add Neosantara or Groq API key in Settings.');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isReady) {
      setError(new Error('MCP server not ready yet. Please wait...'));
      return;
    }

    if (!input.trim()) {
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setError(null);
    setIsLoading(true);

    // Add user message
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userMessage },
    ];
    setMessages(newMessages);

    // Use minimal system prompt (following zola-chat reference pattern)
    // Empty or minimal prompts work better - the AI SDK handles tool invocation
    console.log('\n🔍 ===== TOOLS DEBUG INFO =====');
    console.log('Tools object type:', typeof tools);
    console.log('Tools is object:', typeof tools === 'object');
    console.log('Tools keys:', Object.keys(tools || {}));
    console.log('Tools count:', Object.keys(tools || {}).length);
    console.log('Tools object:', tools);

    // Check structure of first tool
    const firstToolName = Object.keys(tools || {})[0];
    if (firstToolName) {
      const firstTool = tools[firstToolName];
      console.log('\n🔍 First tool analysis:');
      console.log('  Name:', firstToolName);
      console.log('  Type:', typeof firstTool);
      console.log('  Keys:', Object.keys(firstTool || {}));
      console.log('  Has description:', 'description' in (firstTool || {}));
      console.log('  Has parameters:', 'parameters' in (firstTool || {}));
      console.log('  Has execute:', 'execute' in (firstTool || {}));
      console.log('  Full structure:', firstTool);
    }
    console.log('===== END TOOLS DEBUG =====\n');

    const systemPrompt = `You are APILab AI - an API testing assistant.`;

    const messagesWithSystem: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...newMessages,
    ];

    // Prepare for streaming response
    let assistantMessage = '';
    setMessages([...newMessages, { role: 'assistant', content: '' }]);

    try {
      await streamChatCompletion(
        messagesWithSystem,
        tools, // Pass the MCP tools
        // On each text chunk
        (chunk) => {
          assistantMessage += chunk;
          setMessages([
            ...newMessages,
            { role: 'assistant', content: assistantMessage },
          ]);
        },
        // On complete
        () => {
          console.log('✓ Response complete');
          setIsLoading(false);
        },
        // On error
        (err) => {
          console.error('Chat error:', err);
          setError(err);
          setIsLoading(false);
        },
        // On tool call start
        (toolCallId: string, toolName: string, args: Record<string, any>) => {
          console.log('🔧 Tool call started:', toolName, args);

          const newExecution: ToolExecution = {
            id: toolCallId,
            toolName,
            status: 'running',
            args,
            startTime: Date.now(),
          };
          setToolExecutions(prev => [...prev, newExecution]);
        },
        // On tool call complete
        (toolCallId: string, toolName: string, result: any) => {
          console.log('✅ Tool call completed:', toolName);

          // Check if result contains error
          const isError = result?.isError || result?.error;
          const status: ToolStatus = isError ? 'error' : 'complete';

          setToolExecutions(prev =>
            prev.map(exec =>
              exec.id === toolCallId
                ? {
                    ...exec,
                    status,
                    result: isError ? undefined : result,
                    error: isError ? (result?.error || JSON.stringify(result)) : undefined,
                    endTime: Date.now()
                  }
                : exec
            )
          );
        },
        // Provider - Auto-detect available provider
        getAvailableProvider()
      );
    } catch (err) {
      console.error('Failed to send message:', err);

      // If Neosantara fails and Groq is available, try fallback
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('Neosantara') && apiKeys.groq && apiKeys.neosantara) {
        console.log('⚠️ Neosantara failed, attempting fallback to Groq...');
        try {
          // Retry with Groq
          let assistantMessage2 = '';
          setMessages([...newMessages, { role: 'assistant', content: '' }]);

          await streamChatCompletion(
            messagesWithSystem,
            tools,
            (chunk) => {
              assistantMessage2 += chunk;
              setMessages([
                ...newMessages,
                { role: 'assistant', content: assistantMessage2 },
              ]);
            },
            () => {
              console.log('✓ Response complete (via Groq)');
              setIsLoading(false);
            },
            (err2) => {
              console.error('Groq fallback error:', err2);
              setError(err2);
              setIsLoading(false);
            },
            (toolCallId, toolName, args) => {
              const newExecution: ToolExecution = {
                id: toolCallId,
                toolName,
                status: 'running',
                args,
                startTime: Date.now(),
              };
              setToolExecutions(prev => [...prev, newExecution]);
            },
            (toolCallId, _toolName, result) => {
              const isError = result?.isError || result?.error;
              setToolExecutions(prev =>
                prev.map(exec =>
                  exec.id === toolCallId
                    ? {
                        ...exec,
                        status: isError ? 'error' : 'complete',
                        result: isError ? undefined : result,
                        error: isError ? (result?.error || JSON.stringify(result)) : undefined,
                        endTime: Date.now()
                      }
                    : exec
                )
              );
            },
            'groq'
          );
          return; // Success with fallback
        } catch (err2) {
          console.error('Groq fallback also failed:', err2);
          setError(new Error(`Both Neosantara and Groq failed. Neosantara: ${errorMessage}. Groq: ${err2 instanceof Error ? err2.message : String(err2)}`));
        }
      } else {
        setError(err instanceof Error ? err : new Error(String(err)));
      }

      setIsLoading(false);
      // Remove empty assistant message on error
      setMessages(newMessages);
    }
  };

  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const clearToolExecutions = () => {
    setToolExecutions([]);
  };

  return {
    messages: messages as any,
    input,
    isLoading,
    error,
    toolExecutions,
    handleInputChange,
    handleSubmit,
    stop,
    clearToolExecutions,
  };
}
