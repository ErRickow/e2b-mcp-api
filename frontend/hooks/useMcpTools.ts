/**
 * useMcpTools Hook
 * Manages E2B MCP connection via BACKEND PROXY (no direct E2B connection)
 */

import { useState, useEffect, useRef } from 'react';
import type { UseMcpToolsReturn } from '@/types';
import { z } from 'zod';
import { tool } from 'ai';

// TEST: Hardcoded simple tool to verify tool calling works
const testTool = tool({
  description: 'A simple test tool that returns the current time. Use this to test if tool calling is working.',
  parameters: z.object({
    message: z.string().describe('A message to include in the response'),
  }),
  execute: async ({ message }) => {
    console.log('🎯 TEST TOOL CALLED! Message:', message);
    return {
      status: 'success',
      message: `Test tool executed successfully! Your message: ${message}`,
      timestamp: new Date().toISOString(),
      note: 'This proves tool calling is working!'
    };
  },
});

export function useMcpTools(): UseMcpToolsReturn {
  // Use ref for mcpServer to avoid closure issues with tool execute functions
  const mcpServerRef = useRef<any>(null);
  const [tools, setTools] = useState<any>({}); // Store AI SDK tools format
  const [isStarting, setIsStarting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Convert MCP SDK tools to AI SDK format
   * Uses AI SDK's tool() helper for correct type inference
   */
  function convertMcpToolsToAiSdk(mcpTools: any[], callToolFn: (name: string, args: any) => Promise<any>): Record<string, any> {
    const aiTools: Record<string, any> = {};

    for (const mcpTool of mcpTools) {
      try {
        console.log(`\n🔄 Converting tool: ${mcpTool.name}`);
        console.log('  Original schema:', JSON.stringify(mcpTool.inputSchema, null, 2));

        // Convert MCP tool schema to Zod schema
        const inputSchema = mcpTool.inputSchema ? convertJsonSchemaToZod(mcpTool.inputSchema) : z.object({});

        // Create a clear, detailed description (important for LLM!)
        const description = mcpTool.description || `Tool: ${mcpTool.name}`;
        console.log('  Description:', description);

        // Use AI SDK's tool() helper - this ensures correct type inference
        const toolDefinition = tool({
          description: description,
          parameters: inputSchema, // AI SDK tool() helper uses 'parameters' property
          execute: async (args) => {
            // ✅ Actually call the MCP tool via backend
            console.log(`🔧 Executing MCP tool: ${mcpTool.name}`, args);
            try {
              const response = await callToolFn(mcpTool.name, args);
              console.log(`✅ Tool ${mcpTool.name} executed successfully`, response);

              // Backend returns { result: actualData, isError: false }
              // AI SDK expects just the actualData, not wrapped
              if (response && typeof response === 'object' && 'result' in response) {
                // Check for errors - throw with clear message for AI to understand
                if (response.isError) {
                  const errorMsg = typeof response.result === 'string'
                    ? response.result
                    : JSON.stringify(response.result, null, 2);

                  // Throw with detailed error message that AI can understand
                  throw new Error(`Tool execution failed: ${errorMsg}\n\nPlease try with different parameters or inform the user about the error.`);
                }

                // MCP tools return data in format: { content: [{ type: "text", text: "..." }] }
                // AI SDK expects plain string/object, so we need to convert
                const result = response.result;

                // Convert MCP content format to plain text for AI SDK
                if (result && typeof result === 'object' && 'content' in result && Array.isArray(result.content)) {
                  // Extract text from MCP content array
                  const textContent = result.content
                    .filter((item: any) => item.type === 'text')
                    .map((item: any) => item.text)
                    .join('\n');

                  console.log(`📄 Converted MCP content to text (${textContent.length} chars)`);
                  return textContent;
                }

                // Return unwrapped result if not in MCP content format
                return result;
              }

              // Fallback: return as-is if not wrapped
              return response;
            } catch (error) {
              console.error(`❌ Tool ${mcpTool.name} execution failed:`, error);

              // Re-throw with enhanced error message for AI to understand
              const errorMessage = error instanceof Error ? error.message : String(error);
              throw new Error(`System Error in ${mcpTool.name}: ${errorMessage}\n\nPlease inform the user about this error and suggest alternatives.`);
            }
          }
        });

        aiTools[mcpTool.name] = toolDefinition;
        console.log(`✅ Successfully registered tool: ${mcpTool.name}`);

      } catch (error) {
        console.error(`❌ Failed to convert tool ${mcpTool.name}:`, error);
        // Continue with other tools instead of failing entirely
        console.warn(`⚠️ Skipping tool ${mcpTool.name} due to conversion error`);
      }
    }

    console.log('\n🔍 FINAL TOOLS OBJECT:');
    console.log('  Registered tools:', Object.keys(aiTools));
    console.log('  Total count:', Object.keys(aiTools).length);

    return aiTools;
  }

  /**
   * Convert JSON Schema to Zod schema with descriptions
   * Descriptions help the LLM understand how to use each parameter
   */
  function convertJsonSchemaToZod(schema: any): z.ZodType<any> {
    // If no schema or empty schema, return empty object
    if (!schema) {
      console.log('    No schema provided, using z.object({})');
      return z.object({});
    }

    // If schema has no properties, return empty object
    if (!schema.properties || Object.keys(schema.properties).length === 0) {
      console.log('    Schema has no properties, using z.object({})');
      return z.object({});
    }

    const shape: Record<string, z.ZodType<any>> = {};

    for (const [key, value] of Object.entries(schema.properties as Record<string, any>)) {
      const isRequired = schema.required?.includes(key) ?? false;
      const description = value.description || `Parameter: ${key}`;

      let zodType: z.ZodType<any>;

      // Handle type as array (JSON Schema allows multiple types)
      const types = Array.isArray(value.type) ? value.type : [value.type];
      const primaryType = types[0];

      switch (primaryType) {
        case 'string':
          zodType = z.string();
          // Handle enums
          if (value.enum && Array.isArray(value.enum)) {
            zodType = z.enum(value.enum as [string, ...string[]]);
          }
          break;
        case 'number':
        case 'integer':
          // IMPORTANT: Coerce strings to numbers (LLMs often send wrong types)
          // This allows "10" to be auto-converted to 10
          zodType = z.coerce.number();
          // Handle min/max
          if (typeof value.minimum === 'number') {
            zodType = (zodType as z.ZodNumber).min(value.minimum);
          }
          if (typeof value.maximum === 'number') {
            zodType = (zodType as z.ZodNumber).max(value.maximum);
          }
          break;
        case 'boolean':
          // IMPORTANT: Coerce to boolean (LLMs might send "true"/"false" strings)
          zodType = z.coerce.boolean();
          break;
        case 'array':
          // Handle array items
          if (value.items) {
            // TODO: Use itemSchema for proper validation
            // const itemSchema = convertJsonSchemaToZod({ properties: { item: value.items }, required: [] });
            zodType = z.array(z.any()); // Simplified for now
          } else {
            zodType = z.array(z.any());
          }
          break;
        case 'object':
          // Recursively handle nested objects
          if (value.properties) {
            zodType = convertJsonSchemaToZod(value);
          } else {
            zodType = z.record(z.any());
          }
          break;
        case 'null':
          zodType = z.null();
          break;
        default:
          console.warn(`    Unknown type "${primaryType}" for parameter "${key}", using z.any()`);
          zodType = z.any();
      }

      // Add description (IMPORTANT for LLM!)
      zodType = zodType.describe(description);

      // Make optional if not required
      shape[key] = isRequired ? zodType : zodType.optional();

      console.log(`    - ${key}: ${primaryType}${isRequired ? ' (required)' : ' (optional)'} - ${description}`);
    }

    return z.object(shape);
  }

  /**
   * Start MCP connection via backend proxy
   * Backend handles all E2B communication
   */
  const startHttpClient = async () => {
    setIsStarting(true);
    setError(null);
    setIsReady(false);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 Starting MCP Connection via Backend Proxy');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
      // Get config from localStorage (stored as single object)
      const apiKeysJson = localStorage.getItem('apilab_api_keys');
      const apiKeys = apiKeysJson ? JSON.parse(apiKeysJson) : {};

      const apiKey = apiKeys.e2b;
      let backendUrl = apiKeys.backendUrl;

      if (!apiKey) {
        throw new Error('E2B API key not found. Please configure it in Settings.');
      }

      if (!backendUrl) {
        throw new Error('Backend URL not configured. Please configure it in Settings.');
      }

      // Normalize backend URL - remove trailing slash to prevent double slashes
      backendUrl = backendUrl.replace(/\/+$/, '');

      // Step 1: Call backend to create E2B sandbox
      console.log('📡 Step 1: Creating E2B sandbox via backend...');
      console.log(`   Backend: ${backendUrl}/api/mcp/init`);

      const initResponse = await fetch(`${backendUrl}/api/mcp/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey,
          mcpServers: {
            duckduckgo: {},
            arxiv: { storagePath: '/' },
          }
        })
      });

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }

        const error = new Error(`Backend API error (${initResponse.status}): ${errorData.error || initResponse.statusText}`) as any;
        error.status = initResponse.status;
        error.statusText = initResponse.statusText;
        error.url = `${backendUrl}/api/mcp/init`;
        error.responseBody = errorData;
        error.rawResponse = errorText;

        console.error('❌ Backend API Error:', error);
        throw error;
      }

      const { sandboxId } = await initResponse.json();

      console.log('✅ Backend created sandbox!');
      console.log(`   Sandbox ID: ${sandboxId}\n`);

      // Step 2: Fetch tools from backend proxy (backend handles MCP connection)
      console.log('🔧 Step 2: Fetching tools via backend proxy...');
      console.log(`   Backend: ${backendUrl}/api/mcp/tools/${sandboxId}`);

      const toolsResponse = await fetch(`${backendUrl}/api/mcp/tools/${sandboxId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!toolsResponse.ok) {
        const errorText = await toolsResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }

        const error = new Error(`Backend tools error (${toolsResponse.status}): ${errorData.error || toolsResponse.statusText}`) as any;
        error.status = toolsResponse.status;
        error.statusText = toolsResponse.statusText;
        error.url = `${backendUrl}/api/mcp/tools/${sandboxId}`;
        error.responseBody = errorData;
        error.rawResponse = errorText;

        console.error('❌ Backend Tools Error:', error);
        throw error;
      }

      const { tools: mcpTools } = await toolsResponse.json();

      console.log('\n✅ Tools loaded successfully!');
      console.log(`📊 Total tools: ${mcpTools.length}`);
      console.log('📋 Available tools:');
      mcpTools.forEach((tool: any) => {
        console.log(`   - ${tool.name}: ${tool.description || 'No description'}`);
      });

      // Convert MCP tools to AI SDK format
      console.log('\n🔄 Step 3: Converting tools to AI SDK format...');
      const aiSdkTools = convertMcpToolsToAiSdk(mcpTools, callTool);
      console.log(`✅ Converted ${Object.keys(aiSdkTools).length} tools to AI SDK format\n`);

      // Add test tool for debugging
      aiSdkTools['test_tool'] = testTool;
      console.log('🎯 Added hardcoded test_tool for debugging');

      // Store everything (no MCP client - backend handles it)
      // Use ref instead of state to avoid closure issues
      mcpServerRef.current = { sandboxId, backendUrl };
      setTools(aiSdkTools);
      setIsReady(true);
      setIsStarting(false);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ MCP Ready via Backend Proxy!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (err) {
      console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ MCP Initialization Failed');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.error('Error details:', err);

      // Preserve all error properties for debugging
      let error: any;
      if (err instanceof Error) {
        error = err;
      } else {
        error = new Error(String(err));
        error.originalError = err;
      }

      setError(error);
      setIsStarting(false);
      setIsReady(false);

      console.error('🔴 FULL ERROR OBJECT:', error);
    }
  };

  /**
   * Call MCP tool via backend proxy
   */
  const callTool = async (toolName: string, args: Record<string, any>) => {
    // Use ref to get current value (avoids closure issues)
    const mcpServer = mcpServerRef.current;

    if (!mcpServer || !mcpServer.sandboxId) {
      throw new Error('MCP server not initialized');
    }

    // Note: We don't check tools state here because:
    // 1. If this function is called, the tool already exists (it's in the tools object)
    // 2. We only need mcpServer to make the backend API call
    // 3. Checking tools state causes closure issues since tools are set after callTool is defined

    try {
      console.log(`🔧 Calling MCP tool via backend: ${toolName}`, args);

      const { sandboxId, backendUrl } = mcpServer;

      // Call backend proxy to execute tool
      const response = await fetch(`${backendUrl}/api/mcp/call/${sandboxId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolName,
          args
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }

        // If sandbox not found (worker restarted), auto-reinitialize
        if (response.status === 404 && errorData.error === 'Sandbox not found') {
          console.warn('⚠️ Sandbox not found (worker restarted). Auto-reinitializing...');

          // Clear current state
          mcpServerRef.current = null;
          setIsReady(false);

          // Re-initialize
          await startHttpClient();

          // Retry the tool call with new sandbox
          const newMcpServer = mcpServerRef.current;
          if (newMcpServer && newMcpServer.sandboxId) {
            const retryResponse = await fetch(`${newMcpServer.backendUrl}/api/mcp/call/${newMcpServer.sandboxId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                toolName,
                args
              })
            });

            if (!retryResponse.ok) {
              throw new Error(`Backend tool call error after reinit (${retryResponse.status})`);
            }

            const result = await retryResponse.json();
            console.log('✓ MCP tool result (after reinit):', result);
            return result;
          } else {
            throw new Error('Failed to reinitialize MCP server');
          }
        }

        const error = new Error(`Backend tool call error (${response.status}): ${errorData.error || response.statusText}`) as any;
        error.status = response.status;
        error.statusText = response.statusText;
        error.url = `${backendUrl}/api/mcp/call/${sandboxId}`;
        error.toolName = toolName;
        error.args = args;
        error.responseBody = errorData;
        error.rawResponse = errorText;

        console.error('❌ Backend Tool Call Error:', error);
        throw error;
      }

      const result = await response.json();
      console.log('✓ MCP tool result:', result);

      return result;
    } catch (error) {
      console.error('❌ MCP tool call failed:', error);
      throw error;
    }
  };

  /**
   * Restart MCP connection (for config changes)
   */
  const restartConnection = async () => {
    console.log('🔄 Restarting MCP connection...');

    // Reset state
    setIsReady(false);
    setIsStarting(false);
    setError(null);
    setTools({});
    mcpServerRef.current = null;

    // Wait a bit before restarting
    await new Promise(resolve => setTimeout(resolve, 500));

    // Start again
    await startHttpClient();
  };

  // Auto-start on mount
  useEffect(() => {
    startHttpClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isStarting,
    isReady,
    tools,
    error,
    startHttpClient,
    restartConnection,
    mcpServer: mcpServerRef.current,
    callTool,
  };
}
