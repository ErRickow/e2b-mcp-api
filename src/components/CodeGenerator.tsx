/**
 * CodeGenerator Component
 * Generates curl, Python, and JavaScript code snippets from API requests
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

interface CodeGeneratorProps {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}

export function CodeGenerator({ url, method = 'GET', headers, body }: CodeGeneratorProps) {
  const [selectedLang, setSelectedLang] = useState<'curl' | 'python' | 'javascript'>('curl');
  const [copied, setCopied] = useState(false);

  const generateCurl = () => {
    let cmd = `curl -X ${method} '${url}'`;

    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        cmd += ` \\\n  -H '${key}: ${value}'`;
      });
    }

    if (body && method !== 'GET' && method !== 'HEAD') {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      cmd += ` \\\n  -d '${bodyStr}'`;
    }

    return cmd;
  };

  const generatePython = () => {
    let code = `import requests\n\n`;

    if (headers) {
      code += `headers = ${JSON.stringify(headers, null, 2)}\n\n`;
    }

    if (body && method !== 'GET' && method !== 'HEAD') {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
      code += `data = ${bodyStr}\n\n`;
    }

    code += `response = requests.${method.toLowerCase()}(\n`;
    code += `    '${url}'`;

    if (headers) {
      code += `,\n    headers=headers`;
    }

    if (body && method !== 'GET' && method !== 'HEAD') {
      code += `,\n    json=data`;
    }

    code += `\n)\n\n`;
    code += `print(f"Status: {response.status_code}")\n`;
    code += `print(response.json())`;

    return code;
  };

  const generateJavaScript = () => {
    let code = `// Using fetch API\n`;
    code += `fetch('${url}', {\n`;
    code += `  method: '${method}'`;

    if (headers || (body && method !== 'GET' && method !== 'HEAD')) {
      code += `,\n  headers: {\n`;

      if (headers) {
        Object.entries(headers).forEach(([key, value]) => {
          code += `    '${key}': '${value}',\n`;
        });
      } else {
        code += `    'Content-Type': 'application/json',\n`;
      }

      code += `  }`;
    }

    if (body && method !== 'GET' && method !== 'HEAD') {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      code += `,\n  body: JSON.stringify(${bodyStr})`;
    }

    code += `\n})\n`;
    code += `  .then(response => response.json())\n`;
    code += `  .then(data => console.log(data))\n`;
    code += `  .catch(error => console.error('Error:', error));`;

    return code;
  };

  const getCode = () => {
    switch (selectedLang) {
      case 'curl':
        return generateCurl();
      case 'python':
        return generatePython();
      case 'javascript':
        return generateJavaScript();
      default:
        return '';
    }
  };

  const handleCopy = async () => {
    const code = getCode();
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Code Snippet</p>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(['curl', 'python', 'javascript'] as const).map((lang) => (
              <Button
                key={lang}
                variant={selectedLang === lang ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedLang(lang)}
                className="h-7 text-xs"
              >
                {lang === 'javascript' ? 'JS' : lang}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 w-7 p-0"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      <div className="bg-muted rounded-lg p-3 overflow-x-auto">
        <pre className="text-xs font-mono">{getCode()}</pre>
      </div>
    </Card>
  );
}
