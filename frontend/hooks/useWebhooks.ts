/**
 * useWebhooks Hook
 * Manages webhook receiver MCP server
 * DISABLED: Webhook feature temporarily disabled during E2B MCP migration
 */

import { useState, useEffect, useCallback } from 'react';
// import { startMcpSandbox } from '@netglade/mcp-sandbox';

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

export interface UseWebhooksReturn {
  webhookUrl: string | null;
  events: WebhookEvent[];
  isStarting: boolean;
  isReady: boolean;
  error: Error | null;
  startWebhookServer: () => Promise<void>;
  refreshEvents: () => Promise<void>;
  clearEvents: () => Promise<void>;
  getLatestEvent: () => Promise<WebhookEvent | null>;
}

export function useWebhooks(): UseWebhooksReturn {
  const [webhookServer, _setWebhookServer] = useState<any>(null);
  const [webhookUrl, _setWebhookUrl] = useState<string | null>(null);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const startWebhookServer = async () => {
    if (isStarting || isReady) return;

    setIsStarting(true);
    setError(null);

    try {
      console.log('🚀 Starting Webhook Receiver MCP server in E2B sandbox...');

      // Get E2B API key from localStorage
      const stored = window.localStorage.getItem('apilab_api_keys');
      const apiKeys = stored ? JSON.parse(stored) : {};
      const apiKey = apiKeys.e2b;

      if (!apiKey) {
        throw new Error('E2B API key not found. Please configure it in Settings.');
      }

      // Start the webhook receiver MCP server in E2B sandbox
      // DISABLED: Migration to E2B Official Beta MCP in progress
      throw new Error('Webhook feature temporarily disabled during migration');

      // const mcp = await startMcpSandbox({
      //   command: 'npx -y @apilab/webhook-receiver-mcp',
      //   apiKey,
      // });
      // console.log('✓ Webhook MCP server started');
      // console.log('  URL:', mcp.getUrl());
      // const startResult = await (mcp as any).callTool('start_webhook_server', {
      //   port: 3000,
      // });
      // const startData = JSON.parse(startResult.content[0].text);
      // console.log('✓ Webhook server initialized:', startData);
      // const mcpUrl = mcp.getUrl();
      // const baseUrl = mcpUrl.replace('/sse', '');
      // const webhookPublicUrl = `${baseUrl}:3000/webhook`;
      // console.log('✓ Webhook URL ready:', webhookPublicUrl);
      // setWebhookServer(mcp);
      // setWebhookUrl(webhookPublicUrl);
      // setIsReady(true);
      // setIsStarting(false);
      // console.log('✅ Webhook receiver ready!');
      // console.log('📍 Send webhooks to:', webhookPublicUrl);
    } catch (err) {
      console.error('❌ Failed to start webhook server:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsStarting(false);
      setIsReady(false);
    }
  };

  const refreshEvents = useCallback(async () => {
    if (!webhookServer) return;

    try {
      const result = await (webhookServer as any).callTool('get_events', {});
      const data = JSON.parse(result.content[0].text);

      if (data.success) {
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error('❌ Failed to refresh events:', err);
    }
  }, [webhookServer]);

  const clearEvents = useCallback(async () => {
    if (!webhookServer) return;

    try {
      await (webhookServer as any).callTool('clear_events', {});
      setEvents([]);
    } catch (err) {
      console.error('❌ Failed to clear events:', err);
    }
  }, [webhookServer]);

  const getLatestEvent = useCallback(async () => {
    if (!webhookServer) return null;

    try {
      const result = await (webhookServer as any).callTool('get_latest_event', {});
      const data = JSON.parse(result.content[0].text);

      if (data.success) {
        return data.event;
      }
      return null;
    } catch (err) {
      console.error('❌ Failed to get latest event:', err);
      return null;
    }
  }, [webhookServer]);

  // Auto-start on mount
  useEffect(() => {
    startWebhookServer();
  }, []);

  // Auto-refresh events every 3 seconds when ready
  useEffect(() => {
    if (!isReady) return;

    const interval = setInterval(() => {
      refreshEvents();
    }, 3000);

    return () => clearInterval(interval);
  }, [isReady, refreshEvents]);

  return {
    webhookUrl,
    events,
    isStarting,
    isReady,
    error,
    startWebhookServer,
    refreshEvents,
    clearEvents,
    getLatestEvent,
  };
}
