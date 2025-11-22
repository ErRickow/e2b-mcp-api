/**
 * Settings Component
 * Configure API keys and preferences
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings as SettingsIcon, Eye, EyeOff, Check, X, Save, Trash2, Loader2 } from 'lucide-react';
import { useApiKeys } from '@/hooks/useLocalStorage';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => Promise<void>;
}

type Provider = 'e2b' | 'neosantara' | 'groq' | 'backendUrl';

interface ProviderInfo {
  name: string;
  description: string;
  placeholder: string;
  url: string;
  required: boolean;
}

const PROVIDERS: Record<Provider, ProviderInfo> = {
  backendUrl: {
    name: 'Backend API URL',
    description: 'APILab backend server URL (local or Cloudflare Worker)',
    placeholder: 'http://localhost:3001',
    url: 'https://developers.cloudflare.com/workers',
    required: true,
  },
  e2b: {
    name: 'E2B Sandbox',
    description: 'Required for running MCP servers in browser',
    placeholder: 'e2b_...',
    url: 'https://e2b.dev',
    required: true,
  },
  neosantara: {
    name: 'Neosantara AI',
    description: 'Indonesian language model with function calling (Primary)',
    placeholder: 'nsk_...',
    url: 'https://api.neosantara.xyz',
    required: false,
  },
  groq: {
    name: 'Groq',
    description: 'Fast inference with llama-3.1-8b-instant (Alternative)',
    placeholder: 'gsk_...',
    url: 'https://console.groq.com',
    required: false,
  },
};

export function Settings({ isOpen, onClose, onSettingsSaved }: SettingsProps) {
  const { apiKeys, updateKey, isConfigured } = useApiKeys();
  const [selectedProvider, setSelectedProvider] = useState<Provider>('e2b');
  const [inputValue, setInputValue] = useState('');
  const [showKeys, setShowKeys] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!inputValue.trim()) {
      return;
    }

    updateKey(selectedProvider, inputValue.trim());
    setSavedMessage(`${PROVIDERS[selectedProvider].name} saved!`);
    setInputValue('');

    // Auto-restart MCP connection if backend URL or E2B key changed
    if ((selectedProvider === 'backendUrl' || selectedProvider === 'e2b') && onSettingsSaved) {
      setIsRestarting(true);
      setSavedMessage(`${PROVIDERS[selectedProvider].name} saved! Restarting connection...`);

      try {
        await onSettingsSaved();
        setSavedMessage('✅ Settings saved and connection restarted!');
      } catch (error) {
        setSavedMessage(`⚠️ Saved but restart failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsRestarting(false);
      }
    }

    // Clear success message after 3 seconds
    setTimeout(() => setSavedMessage(null), 3000);
  };

  const handleDelete = (provider: Provider) => {
    updateKey(provider, '');
    setSavedMessage(`${PROVIDERS[provider].name} API key deleted!`);
    setTimeout(() => setSavedMessage(null), 2000);
  };

  const handleClose = () => {
    if (!isConfigured) {
      alert('⚠️ Please configure at least E2B API key and one LLM provider (Neosantara or Groq) before closing.');
      return;
    }
    onClose();
  };

  const currentProviderInfo = PROVIDERS[selectedProvider];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              <CardTitle>API Key Configuration</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Configure your API keys. All keys are stored locally in your browser.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Success Message */}
          {savedMessage && (
            <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm font-medium text-green-900 dark:text-green-100 flex items-center gap-2">
                <Check className="h-4 w-4" />
                {savedMessage}
              </p>
            </div>
          )}

          {/* Add API Key Section */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold text-sm">Add/Update API Key</h3>

            {/* Provider Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Select Provider {currentProviderInfo.required && <span className="text-destructive">*</span>}
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => {
                  setSelectedProvider(e.target.value as Provider);
                  setInputValue('');
                }}
                className="w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="backendUrl">Backend API URL (Required)</option>
                <option value="e2b">E2B Sandbox (Required)</option>
                <option value="neosantara">Neosantara AI (Primary LLM)</option>
                <option value="groq">Groq (Alternative LLM)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {currentProviderInfo.description}
              </p>
            </div>

            {/* API Key Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{selectedProvider === 'backendUrl' ? 'URL' : 'API Key'}</label>
              <div className="flex gap-2">
                <Input
                  type={selectedProvider === 'backendUrl' ? 'url' : (showKeys ? 'text' : 'password')}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={currentProviderInfo.placeholder}
                  className="font-mono text-sm flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSave();
                    }
                  }}
                />
                {selectedProvider !== 'backendUrl' && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowKeys(!showKeys)}
                    title={showKeys ? 'Hide' : 'Show'}
                  >
                    {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Get your key from:{' '}
                <a
                  href={currentProviderInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {currentProviderInfo.url}
                </a>
              </p>
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={!inputValue.trim() || isRestarting}
              className="w-full"
            >
              {isRestarting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restarting...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save {PROVIDERS[selectedProvider].name}
                </>
              )}
            </Button>
          </div>

          {/* Current Keys Status */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Configured API Keys</h3>

            {/* Backend URL Status */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-medium text-sm">Backend API URL</p>
                  <p className="text-xs text-muted-foreground">Required</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {apiKeys.backendUrl ? (
                  <>
                    <Badge variant="default" className="bg-green-500">
                      <Check className="h-3 w-3 mr-1" />
                      {apiKeys.backendUrl}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete('backendUrl')}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                    Not Configured
                  </Badge>
                )}
              </div>
            </div>

            {/* E2B Status */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-medium text-sm">E2B Sandbox</p>
                  <p className="text-xs text-muted-foreground">Required</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {apiKeys.e2b ? (
                  <>
                    <Badge variant="default" className="bg-green-500">
                      <Check className="h-3 w-3 mr-1" />
                      Configured
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete('e2b')}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                    Not Configured
                  </Badge>
                )}
              </div>
            </div>

            {/* Neosantara Status */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-medium text-sm">Neosantara AI</p>
                  <p className="text-xs text-muted-foreground">Primary LLM</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {apiKeys.neosantara ? (
                  <>
                    <Badge variant="default" className="bg-green-500">
                      <Check className="h-3 w-3 mr-1" />
                      Configured
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete('neosantara')}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Badge variant="outline">Optional</Badge>
                )}
              </div>
            </div>

            {/* Groq Status */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-medium text-sm">Groq</p>
                  <p className="text-xs text-muted-foreground">Alternative LLM</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {apiKeys.groq ? (
                  <>
                    <Badge variant="default" className="bg-green-500">
                      <Check className="h-3 w-3 mr-1" />
                      Configured
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete('groq')}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Badge variant="outline">Optional</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Warning */}
          {!isConfigured && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                ⚠️ <strong>Required:</strong> You need at least E2B API key and one LLM provider (Neosantara or Groq) to use APILab.
              </p>
            </div>
          )}

          {/* Close Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={handleClose}
              variant="outline"
              className="w-full"
            >
              Close Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
