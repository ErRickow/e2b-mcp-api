/**
 * Cloudflare Worker untuk APILab Backend
 * Handles E2B MCP sandbox creation and proxies MCP tool operations
 *
 * Available Endpoints:
 * - POST /api/mcp/init - Create E2B sandbox with MCP gateway
 * - GET /api/mcp/sandbox/:id - Get sandbox info
 * - GET /api/mcp/tools/:id - List available MCP tools
 * - POST /api/mcp/call/:id - Call MCP tool
 */

import Sandbox from 'e2b';

// Type untuk environment variables
interface Env {
  // E2B_API_KEY bisa disimpan sebagai secret di Cloudflare Workers
}

// Helper function untuk CORS response
function corsResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// In-memory cache with MCP client info (Workers KV lebih baik untuk production)
const sandboxCache = new Map<string, {
  sandbox: any;
  mcpUrl: string;
  mcpToken: string;
  sessionId: string;
  initialized: boolean;
}>();

/**
 * Initialize MCP session with proper handshake
 * MCP protocol requires: initialize request → initialized notification
 * Returns the session ID that must be included in all subsequent requests
 */
async function initializeMcpSession(mcpUrl: string, mcpToken: string): Promise<string> {
  console.log('🤝 Initializing MCP session...');

  // Step 1: Send initialize request
  const initResponse = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${mcpToken}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: 'apilab-worker',
          version: '1.0.0',
        },
      },
    }),
  });

  console.log('   Initialize response:', initResponse.status);

  if (!initResponse.ok) {
    const errorText = await initResponse.text();
    throw new Error(`MCP initialize failed: ${initResponse.status} - ${errorText}`);
  }

  // CRITICAL: Extract Mcp-Session-Id header for subsequent requests
  const sessionId = initResponse.headers.get('Mcp-Session-Id') || '';
  console.log('   Session ID:', sessionId);

  // Parse response (may be SSE or JSON)
  const contentType = initResponse.headers.get('content-type') || '';
  const responseText = await initResponse.text();

  let initData;
  if (contentType.includes('text/event-stream') || responseText.startsWith('event:')) {
    const dataMatch = responseText.match(/data:\s*({.*})/);
    if (dataMatch) {
      initData = JSON.parse(dataMatch[1]);
    }
  } else {
    initData = JSON.parse(responseText);
  }

  console.log('   Server capabilities:', JSON.stringify(initData.result).substring(0, 200));

  // Step 2: Send initialized notification (no params field for notifications!)
  // IMPORTANT: Include session ID in notification
  const notifyResponse = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${mcpToken}`,
      ...(sessionId && { 'Mcp-Session-Id': sessionId }),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }),
  });

  console.log('   Initialized notification sent:', notifyResponse.status);

  // Small delay to ensure server processes the notification
  // (MCP gateway might need time to transition out of init state)
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('✅ MCP session initialized with ID:', sessionId);

  return sessionId;
}

/**
 * Create E2B sandbox with MCP gateway
 * Using official E2B API: https://e2b.dev/docs/mcp
 */
async function createMcpSandbox(apiKey: string, mcpServers: Record<string, any>) {
  console.log('📦 Creating E2B sandbox with MCP gateway...');
  console.log('🌐 MCP Servers:', Object.keys(mcpServers).join(', '));

  // Official API: Use Sandbox.create() not Sandbox.betaCreate()
  const sandbox = await Sandbox.create({
    apiKey,
    mcp: mcpServers,
    timeoutMs: 600_000, // 10 minutes
  });

  // Official methods: getMcpUrl() and getMcpToken() (not beta methods)
  const mcpUrl = sandbox.getMcpUrl();
  const mcpToken = await sandbox.getMcpToken();

  console.log('✅ Sandbox created successfully!');
  console.log('🔗 MCP URL:', mcpUrl);

  // Initialize MCP session with proper handshake and get session ID
  const sessionId = await initializeMcpSession(mcpUrl, mcpToken);

  // Cache the sandbox with MCP info including session ID
  const sandboxId = (sandbox as any).id || Date.now().toString();
  sandboxCache.set(sandboxId, {
    sandbox,
    mcpUrl,
    mcpToken,
    sessionId,
    initialized: true,
  });

  return {
    sandboxId,
    mcpUrl,
    mcpToken,
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Health check
    if (url.pathname === '/health') {
      return corsResponse({ status: 'ok', timestamp: new Date().toISOString() });
    }

    // Create MCP sandbox
    if (url.pathname === '/api/mcp/init' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const { apiKey, mcpServers } = body;

        if (!apiKey) {
          return corsResponse({ error: 'E2B API key is required' }, 400);
        }

        // Default MCP servers if not specified
        const servers = mcpServers || {
          duckduckgo: {},
          arxiv: { storagePath: '/' },
        };

        const result = await createMcpSandbox(apiKey, servers);
        return corsResponse(result);
      } catch (error: any) {
        console.error('❌ Failed to create sandbox:', error);
        return corsResponse(
          {
            error: error.message || 'Failed to create MCP sandbox',
            details: error.stack,
          },
          500
        );
      }
    }

    // Get sandbox info
    if (url.pathname.startsWith('/api/mcp/sandbox/') && request.method === 'GET') {
      const sandboxId = url.pathname.split('/').pop();
      const cached = sandboxCache.get(sandboxId || '');

      if (!cached) {
        return corsResponse({ error: 'Sandbox not found' }, 404);
      }

      const isRunning = (await cached.sandbox.isRunning?.()) || false;

      return corsResponse({
        sandboxId,
        isRunning,
        url: cached.mcpUrl,
      });
    }

    // List MCP tools (using MCP JSON-RPC protocol)
    if (url.pathname.startsWith('/api/mcp/tools/') && request.method === 'GET') {
      const sandboxId = url.pathname.split('/').pop();
      const cached = sandboxCache.get(sandboxId || '');

      if (!cached) {
        return corsResponse({ error: 'Sandbox not found' }, 404);
      }

      try {
        console.log('📋 Listing MCP tools for sandbox:', sandboxId);
        console.log('   MCP URL:', cached.mcpUrl);
        console.log('   Token:', cached.mcpToken.substring(0, 10) + '...');
        console.log('   Session ID:', cached.sessionId);

        // Use MCP JSON-RPC protocol to list tools
        // Based on E2B examples: client.listTools() sends tools/list JSON-RPC request
        // IMPORTANT: MCP gateway requires Accept header with BOTH content types
        // CRITICAL: Must include Mcp-Session-Id header from initialization
        const mcpResponse = await fetch(cached.mcpUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'Authorization': `Bearer ${cached.mcpToken}`,
            'Mcp-Session-Id': cached.sessionId,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/list',
            params: {}
          })
        });

        console.log('   Response status:', mcpResponse.status, mcpResponse.statusText);

        if (!mcpResponse.ok) {
          const errorText = await mcpResponse.text();
          console.error('   Error response:', errorText);
          throw new Error(`MCP gateway error: ${mcpResponse.status} ${mcpResponse.statusText} - ${errorText}`);
        }

        // MCP gateway may return SSE or JSON format
        const contentType = mcpResponse.headers.get('content-type') || '';
        const responseText = await mcpResponse.text();
        console.log('   Content-Type:', contentType);
        console.log('   Response preview:', responseText.substring(0, 100));

        let mcpData;

        // Parse SSE format if needed
        if (contentType.includes('text/event-stream') || responseText.startsWith('event:')) {
          console.log('   Parsing as SSE format');
          // SSE format: "event: message\ndata: {...}\n\n"
          const dataMatch = responseText.match(/data:\s*({.*})/);
          if (dataMatch) {
            mcpData = JSON.parse(dataMatch[1]);
          } else {
            throw new Error('Failed to parse SSE response');
          }
        } else {
          console.log('   Parsing as JSON format');
          mcpData = JSON.parse(responseText);
        }

        console.log('   Parsed data:', JSON.stringify(mcpData).substring(0, 300));

        // Check for JSON-RPC error
        if (mcpData.error) {
          console.error('   MCP JSON-RPC error:', mcpData.error);
          throw new Error(`MCP error: ${mcpData.error.message || JSON.stringify(mcpData.error)}`);
        }

        // Extract tools from result
        const tools = mcpData.result?.tools || [];
        console.log(`✅ Found ${tools.length} tools`);

        if (tools.length > 0) {
          console.log('   Tools:', tools.map((t: any) => t.name).join(', '));
          console.log('   First tool detail:', JSON.stringify(tools[0]));
        } else {
          console.warn('   ⚠️ No tools found!');
          console.warn('   Full response:', JSON.stringify(mcpData));
        }

        return corsResponse({
          tools,
          count: tools.length
        });
      } catch (error: any) {
        console.error('❌ Failed to list tools:', error);
        return corsResponse({
          error: error.message || 'Failed to list MCP tools',
          details: error.stack
        }, 500);
      }
    }

    // Call MCP tool (using MCP JSON-RPC protocol)
    if (url.pathname.startsWith('/api/mcp/call/') && request.method === 'POST') {
      const sandboxId = url.pathname.split('/').pop();
      const cached = sandboxCache.get(sandboxId || '');

      if (!cached) {
        return corsResponse({ error: 'Sandbox not found' }, 404);
      }

      try {
        const body: any = await request.json();
        const { toolName, args } = body;

        if (!toolName) {
          return corsResponse({ error: 'toolName is required' }, 400);
        }

        console.log(`🔧 Calling tool: ${toolName}`);
        console.log('   Args:', JSON.stringify(args));
        console.log('   Session ID:', cached.sessionId);

        // Use MCP JSON-RPC protocol to call tool
        // Based on E2B examples: client.callTool(name, arguments) sends tools/call JSON-RPC request
        // IMPORTANT: MCP gateway requires Accept header with BOTH content types
        // CRITICAL: Must include Mcp-Session-Id header from initialization
        const mcpResponse = await fetch(cached.mcpUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'Authorization': `Bearer ${cached.mcpToken}`,
            'Mcp-Session-Id': cached.sessionId,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: {
              name: toolName,
              arguments: args || {}
            }
          })
        });

        console.log('   Response status:', mcpResponse.status, mcpResponse.statusText);

        if (!mcpResponse.ok) {
          const errorText = await mcpResponse.text();
          console.error('   Error response:', errorText);
          throw new Error(`MCP gateway error: ${mcpResponse.status} ${mcpResponse.statusText} - ${errorText}`);
        }

        // MCP gateway may return SSE or JSON format
        const contentType = mcpResponse.headers.get('content-type') || '';
        const responseText = await mcpResponse.text();
        console.log('   Content-Type:', contentType);
        console.log('   Response preview:', responseText.substring(0, 100));

        let mcpData;

        // Parse SSE format if needed
        if (contentType.includes('text/event-stream') || responseText.startsWith('event:')) {
          console.log('   Parsing as SSE format');
          // SSE format: "event: message\ndata: {...}\n\n"
          const dataMatch = responseText.match(/data:\s*({.*})/);
          if (dataMatch) {
            mcpData = JSON.parse(dataMatch[1]);
          } else {
            throw new Error('Failed to parse SSE response');
          }
        } else {
          console.log('   Parsing as JSON format');
          mcpData = JSON.parse(responseText);
        }

        console.log('   Parsed data:', JSON.stringify(mcpData).substring(0, 500));

        // Check for JSON-RPC error
        if (mcpData.error) {
          console.error('   MCP JSON-RPC error:', mcpData.error);
          return corsResponse({
            result: { error: mcpData.error.message || JSON.stringify(mcpData.error) },
            isError: true
          }, 200);
        }

        // Extract result - MCP returns { content: [...], isError: boolean }
        const result = mcpData.result;
        console.log('✅ Tool call successful');
        console.log('   Result type:', typeof result);
        console.log('   Has content:', 'content' in (result || {}));

        return corsResponse({
          result: result,
          isError: false
        });
      } catch (error: any) {
        console.error('❌ Failed to call tool:', error);
        return corsResponse({
          result: { error: error.message },
          isError: true
        }, 200); // Return 200 with isError flag instead of 500
      }
    }

    // 404
    return corsResponse({ error: 'Not found' }, 404);
  },
};
