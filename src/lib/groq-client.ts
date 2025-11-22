/**
 * LLM Client using Vercel AI SDK
 * Multi-provider support: Neosantara AI and Groq
 */

import { createOpenAI } from '@ai-sdk/openai';
import { streamText, type ToolSet } from 'ai';

export type LLMProvider = 'neosantara' | 'groq';

/**
 * Get API keys from localStorage
 */
function getApiKeys() {
  try {
    const stored = window.localStorage.getItem('apilab_api_keys');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load API keys from localStorage:', error);
  }
  return { neosantara: '', groq: '', e2b: '' };
}

export function createLLMProvider(provider: LLMProvider = 'neosantara') {
  const apiKeys = getApiKeys();

  if (provider === 'neosantara') {
    const apiKey = apiKeys.neosantara;

    if (!apiKey) {
      throw new Error('Neosantara API key not found. Please configure it in Settings.');
    }

    // Use AI SDK createOpenAI with Neosantara baseURL
    return createOpenAI({
      apiKey,
      baseURL: 'https://api.neosantara.xyz/v1',
    });
  } else {
    const apiKey = apiKeys.groq;

    if (!apiKey) {
      throw new Error('Groq API key not found. Please configure it in Settings.');
    }

    // Groq is also OpenAI-compatible
    return createOpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
}

export function getModelName(provider: LLMProvider = 'neosantara'): string {
  if (provider === 'neosantara') {
    return 'nusantara-base'; // Supports function calling
  } else {
    // Use Groq's specialized tool-use model for better function calling support
    return 'llama3-groq-70b-8192-tool-use-preview';
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface ToolCallHandler {
  (toolName: string, args: Record<string, any>): Promise<any>;
}

export interface ToolCallStartHandler {
  (toolCallId: string, toolName: string, args: Record<string, any>): void;
}

export interface ToolCallCompleteHandler {
  (toolCallId: string, toolName: string, result: any): void;
}

export async function streamChatCompletion(
  messages: ChatMessage[],
  tools: any, // AI SDK tools format (from client.tools())
  onChunk: (text: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  onToolCallStart?: ToolCallStartHandler,
  _onToolCallComplete?: ToolCallCompleteHandler, // TODO: Use with experimental_onToolCall
  provider: LLMProvider = 'neosantara'
) {
  try {
    const llmProvider = createLLMProvider(provider);
    const modelName = getModelName(provider);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🤖 LLM Provider: ${provider}`);
    console.log(`📝 Model: ${modelName}`);
    console.log(`🔧 Tools Count: ${Object.keys(tools || {}).length}`);
    console.log(`🔧 Available Tools:`, Object.keys(tools || {}));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Extract system prompt from messages (following zola-chat pattern)
    const systemMessage = messages.find(m => m.role === 'system');
    const systemPrompt = systemMessage?.content || '';

    // Format messages for AI SDK (exclude system message - passed separately)
    const formattedMessages = messages
      .filter(m => m.role !== 'system' && m.role !== 'tool') // AI SDK handles tool results differently
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    console.log('📋 System prompt:', systemPrompt);
    console.log('📨 Message count (excluding system):', formattedMessages.length);

    // Track tool calls
    const toolCallsMap = new Map<string, { name: string; args: any }>();

    // Start streaming (following zola-chat reference pattern)
    const result = streamText({
      model: llmProvider(modelName),
      system: systemPrompt, // Pass system separately (like reference)
      messages: formattedMessages,
      tools: tools as ToolSet, // Cast to ToolSet (like reference)
      // NOTE: Reference doesn't use toolChoice - let model decide naturally
      maxSteps: 10, // Match reference (10 steps)
    });

    // IMPORTANT: Must iterate over fullStream to consume chunks
    // onChunk callback won't fire unless we consume the stream!
    try {
      for await (const chunk of result.fullStream) {
        // Handle different chunk types
        switch (chunk.type) {
          case 'text-delta':
            onChunk(chunk.textDelta);
            break;

          case 'tool-call-streaming-start':
            // Tool call streaming started (AI is preparing args)
            console.log(`🔧 Tool call streaming started: ${chunk.toolName}`);
            // Create placeholder with empty args
            toolCallsMap.set(chunk.toolCallId, {
              name: chunk.toolName,
              args: {},
            });
            onToolCallStart?.(chunk.toolCallId, chunk.toolName, {});
            break;

          case 'tool-call-delta':
            // Tool call args streaming (show progress)
            console.log(`📝 Tool call args delta: ${chunk.toolName}`, chunk.argsTextDelta);
            break;

          case 'tool-call':
            // Tool call complete with all args (ready to execute)
            toolCallsMap.set(chunk.toolCallId, {
              name: chunk.toolName,
              args: chunk.args,
            });
            console.log(`🔧 Tool call ready: ${chunk.toolName}`, chunk.args);
            // Update with full args
            onToolCallStart?.(chunk.toolCallId, chunk.toolName, chunk.args);
            break;

          // NOTE: 'tool-result' type removed in newer AI SDK versions
          // Tool completion is now handled via experimental_onToolCall callbacks

          case 'step-finish':
            console.log(`📊 Step finished`);
            break;

          case 'finish':
            // Stream finished
            console.log('✓ Stream finished');
            console.log(`  Finish reason: ${chunk.finishReason}`);
            console.log(`  Usage:`, chunk.usage);
            break;

          case 'error':
            console.error('❌ Stream error:', chunk.error);
            throw chunk.error;
        }
      }

      // Call onComplete after stream is done
      onComplete();
    } catch (streamError) {
      console.error('❌ Stream iteration error:', streamError);
      throw streamError;
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${provider} streaming error:`, errorMessage);
    console.error('Full error object:', error);

    // Provide helpful error messages
    let userFriendlyError: Error;

    if (errorMessage.includes('API key')) {
      userFriendlyError = new Error(`${provider === 'neosantara' ? 'Neosantara' : 'Groq'} API key is invalid or missing. Please check your Settings.`);
    } else if (errorMessage.includes('401')) {
      userFriendlyError = new Error(`Authentication failed with ${provider === 'neosantara' ? 'Neosantara' : 'Groq'}. Please verify your API key in Settings.`);
    } else if (errorMessage.includes('429')) {
      userFriendlyError = new Error(`Rate limit exceeded for ${provider === 'neosantara' ? 'Neosantara' : 'Groq'}. Please try again later.`);
    } else if (errorMessage.includes('timeout') || errorMessage.includes('TimeoutError') || errorMessage.includes('aborted')) {
      userFriendlyError = new Error(`Request timed out after 2 minutes. The ${provider === 'neosantara' ? 'Neosantara' : 'Groq'} API may be slow or unreachable. Try again or switch to ${provider === 'neosantara' ? 'Groq' : 'Neosantara'} in Settings.`);
    } else if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('EAI_AGAIN')) {
      userFriendlyError = new Error(`Network error: Cannot reach ${provider === 'neosantara' ? 'Neosantara' : 'Groq'} API. Check your internet connection or try switching to ${provider === 'neosantara' ? 'Groq' : 'Neosantara'} in Settings.`);
    } else {
      userFriendlyError = error instanceof Error ? error : new Error(errorMessage);
    }

    onError(userFriendlyError);
    throw userFriendlyError;
  }
}
