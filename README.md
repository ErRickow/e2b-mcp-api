# e2b-mcp-api

## Architecture

APILab uses a **backend proxy architecture** to run MCP servers securely:

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Frontend  │────▶│     Backend      │────▶│  E2B MCP    │
│  (Browser)  │     │ (Cloudflare      │     │  Sandbox    │
│             │     │   Worker)        │     │             │
└─────────────┘     └──────────────────┘     └─────────────┘
```

- **Frontend**: React + Vite + Vercel AI SDK
- **Backend**: Cloudflare Worker that proxies MCP requests via JSON-RPC over HTTP
- **E2B Sandbox**: Secure sandbox running MCP servers (DuckDuckGo, ArXiv, etc.)

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm
- API Keys:
  - [E2B API Key](https://e2b.dev) (Required)
  - [Neosantara API Key](https://app.neosantara.xyz/api-keys) or [Groq API Key](https://console.groq.com) (Required)

### Installation

1. **Clone and install dependencies**:
```bash
git clone https://github.com/errickow/e2b-mcp-api
npm install
cd backend && npm install && cd .
```

2. **Start the backend worker**:
```bash
npm run dev:worker
```

The Cloudflare Worker will start on `http://localhost:8787` with these endpoints:
- `POST /api/mcp/init` - Create E2B sandbox
- `GET /api/mcp/tools/:sandboxId` - List available tools
- `POST /api/mcp/call/:sandboxId` - Execute tool
- `GET /api/mcp/sandbox/:sandboxId` - Get sandbox info
- `GET /health` - Health check

3. **Start the frontend** (in a new terminal):
```bash
npm run dev
```

The frontend will start on `http://localhost:5173`

4. **Configure API keys**:
   - Open the app in your browser
   - Click the Settings (⚙️) button
   - Add your API keys:
     - **Backend API URL**: `http://localhost:8787` (auto-filled)
     - **E2B API Key**: Your E2B sandbox key
     - **Neosantara AI** or **Groq**: Your LLM provider key

### Development Scripts

```bash
# Run only frontend
npm run dev

# Run only backend (Cloudflare Worker)
npm run dev:worker

# Build for production
npm run build

# Deploy worker to Cloudflare
npm run deploy:worker
```