/**
 * MCP E2B - Minimalist Chat Interface
 * Inspired by modern chat UIs (ChatGPT, Claude, etc.)
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Loader2, Settings as SettingsIcon, AlertCircle, Copy, Check } from 'lucide-react'
import { ChatMessage } from '@/components/ChatMessage'
import { ToolExecutionCard } from '@/components/ToolExecutionCard'
import { Settings } from '@/components/Settings'
import { useApiChat } from '@/hooks/useApiChat'
import { useMcpTools } from '@/hooks/useMcpTools'
import { useApiKeys } from '@/hooks/useLocalStorage'
import { useRef, useEffect, useState } from 'react'

function App() {
  const { messages, input, isLoading, error, toolExecutions, handleInputChange, handleSubmit } = useApiChat()
  const { isStarting, isReady, error: mcpError, restartConnection } = useMcpTools()
  const { isConfigured } = useApiKeys()
  const [showSettings, setShowSettings] = useState(!isConfigured)
  const [copiedError, setCopiedError] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const showError = error || mcpError

  // Copy error to clipboard
  const copyErrorToClipboard = () => {
    if (!showError) return

    const errorText = JSON.stringify({
      ...showError,
      message: showError.message,
      name: showError.name,
      stack: showError.stack
    }, null, 2)

    navigator.clipboard.writeText(errorText).then(() => {
      setCopiedError(true)
      setTimeout(() => setCopiedError(false), 2000)
    }).catch(err => {
      console.error('Failed to copy:', err)
    })
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Minimal Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between flex-shrink-0 bg-card">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-primary">APILab</h1>

          {/* Status Indicator (Minimal) */}
          {isStarting && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Starting...</span>
            </div>
          )}
          {isReady && (
            <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-950 px-2.5 py-1 rounded-md border border-green-200 dark:border-green-800">
              <div className="h-2 w-2 rounded-full bg-green-600 dark:bg-green-400 animate-pulse" />
              <span className="text-xs text-green-800 dark:text-green-200 font-medium">Ready</span>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSettings(true)}
          className="h-9 w-9"
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </header>

      {/* Messages Area - Full Screen */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {/* Error Display - Raw Debug Format */}
          {showError && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-destructive">Error (Raw Debug Info)</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyErrorToClipboard}
                  className="h-7 px-2 hover:bg-destructive/20"
                >
                  {copiedError ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      <span className="text-xs">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      <span className="text-xs">Copy</span>
                    </>
                  )}
                </Button>
              </div>
              <div className="bg-black/5 dark:bg-black/20 rounded p-2 overflow-x-auto max-h-96 overflow-y-auto">
                <pre className="text-xs font-mono text-destructive whitespace-pre-wrap break-all">
                  {JSON.stringify({
                    ...showError,
                    message: showError.message,
                    name: showError.name,
                    stack: showError.stack
                  }, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Welcome Message */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-12">
              <div className="space-y-3">
                <h2 className="text-3xl font-bold text-primary">
                  Welcome to APILab
                </h2>
                <p className="text-base text-muted-foreground max-w-lg leading-relaxed px-4">
                  AI Assistant with access to <span className="font-bold text-foreground">real-time tools</span>
                  <br />
                  <span className="text-sm">Powered by E2B MCP Servers • Neosantara AI</span>
                </p>
              </div>

              {/* Example Prompts */}
              <div className="flex flex-wrap gap-3 justify-center mt-8">
                {[
                  'Search for latest AI news',
                  'Find papers about machine learning',
                ].map((example) => (
                  <Button
                    key={example}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const event = new Event('submit') as any
                      event.preventDefault = () => {}
                      handleInputChange({
                        target: { value: example },
                      } as any)
                      setTimeout(() => handleSubmit(event), 100)
                    }}
                  >
                    {example}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="space-y-6">
              {messages.map((message, index) => {
                const isLastAssistantMessage = message.role === 'assistant' && index === messages.length - 1;

                return (
                  <div key={index}>
                    {/* Show tool executions ABOVE the last assistant message */}
                    {isLastAssistantMessage && toolExecutions.length > 0 && (
                      <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="h-px flex-1 bg-border"></div>
                          <span className="text-xs font-medium text-muted-foreground tracking-wide px-3 py-1 bg-muted rounded-md">
                            🔧 Tool Executions
                          </span>
                          <div className="h-px flex-1 bg-border"></div>
                        </div>
                        {toolExecutions.map((execution) => (
                          <ToolExecutionCard
                            key={execution.id}
                            toolName={execution.toolName}
                            status={execution.status}
                            args={execution.args}
                            result={execution.result}
                            error={execution.error}
                            startTime={execution.startTime}
                            endTime={execution.endTime}
                          />
                        ))}
                        <div className="h-px bg-border my-4"></div>
                      </div>
                    )}

                    <ChatMessage
                      role={message.role}
                      content={message.content}
                      isStreaming={isLoading && index === messages.length - 1}
                    />
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input Area - Fixed Bottom */}
      <div className="border-t bg-background px-4 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder={
                isReady
                  ? "Ask me anything..."
                  : "Waiting for server..."
              }
              disabled={isLoading || !isReady}
              className="flex-1"
              autoFocus
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !isReady || !input.trim()}
              className="h-10 w-10"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-2">
            AI with real-time tool access • E2B MCP • Neosantara
          </p>
        </div>
      </div>

      {/* Settings Modal */}
      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSettingsSaved={restartConnection}
      />
    </div>
  )
}

export default App
