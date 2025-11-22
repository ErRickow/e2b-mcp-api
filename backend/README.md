# Deploy to Cloudflare:

### Step 1: Install Cloudflare CLI (Wrangler)

```bash
# Install wrangler globally
npm install -g wrangler

# Login ke Cloudflare
wrangler login
```

### Step 2: Deploy Worker

```bash
npm install
wrangler deploy
```

#### Method 1: Simple Python Example

```python
import os
import requests
from openai import OpenAI

# Worker URL (already deployed)
WORKER_URL = "https://your-worker.workers.dev"

# Initialize OpenAI client (Neosantara compatible)
client = OpenAI(
    api_key=os.environ.get("NEOSANTARA_API_KEY"),
    base_url="https://api.neosantara.xyz/v1"
)

# Initialize MCP session
def init_session():
    response = requests.post(f"{WORKER_URL}/api/mcp/init")
    data = response.json()
    return data["sandboxId"]

# Fetch tools from worker
def fetch_tools(sandbox_id):
    response = requests.get(f"{WORKER_URL}/api/mcp/tools/{sandbox_id}")
    data = response.json()
    return data["tools"]

# Call tool via worker
def call_tool(sandbox_id, tool_name, args):
    response = requests.post(
        f"{WORKER_URL}/api/mcp/call/{sandbox_id}",
        json={"toolName": tool_name, "args": args}
    )
    return response.json()

# Convert MCP tools to OpenAI function format
def convert_to_openai_tools(mcp_tools):
    openai_tools = []

    for tool in mcp_tools:
        openai_tool = {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["inputSchema"]
            }
        }
        openai_tools.append(openai_tool)

    return openai_tools

# Main chat function
def chat(prompt):
    # Initialize
    sandbox_id = init_session()
    mcp_tools = fetch_tools(sandbox_id)
    tools = convert_to_openai_tools(mcp_tools)

    print(f"✓ Loaded {len(tools)} tools")

    # Chat with tools
    messages = [{"role": "user", "content": prompt}]

    response = client.chat.completions.create(
        model="neosantara/Meta-Llama-3.1-70B-Instruct-Turbo",
        messages=messages,
        tools=tools,
        tool_choice="auto"
    )

    # Handle tool calls
    message = response.choices[0].message

    if message.tool_calls:
        for tool_call in message.tool_calls:
            tool_name = tool_call.function.name
            args = eval(tool_call.function.arguments)  # Parse JSON

            print(f"\n🔧 Calling: {tool_name}")
            print(f"📊 Args: {args}")

            # Execute tool via worker
            result = call_tool(sandbox_id, tool_name, args)

            print(f"✓ Result: {result}")

            # Add tool response to messages
            messages.append({
                "role": "assistant",
                "content": None,
                "tool_calls": [tool_call]
            })
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": str(result)
            })

        # Get final response
        final_response = client.chat.completions.create(
            model="neosantara/Meta-Llama-3.1-70B-Instruct-Turbo",
            messages=messages
        )

        print(f"\n{final_response.choices[0].message.content}")
    else:
        print(f"\n{message.content}")

# Run
if __name__ == "__main__":
    chat("Search for the latest AI research papers")
```

**Run:**

```bash
# Install dependencies
pip install openai requests

# Set environment variable
export NEOSANTARA_API_KEY=nsk_your_key

# Run
python chat.py
```

---

#### Method 2: Python with Streaming

```python
import os
import json
import requests
from openai import OpenAI

WORKER_URL = "https://your-worker.workers.dev"

client = OpenAI(
    api_key=os.environ.get("NEOSANTARA_API_KEY"),
    base_url="https://api.neosantara.xyz/v1"
)

class WorkerTools:
    def __init__(self):
        self.sandbox_id = None
        self.tools = []
        self._init_session()

    def _init_session(self):
        """Initialize MCP session"""
        response = requests.post(f"{WORKER_URL}/api/mcp/init")
        data = response.json()
        self.sandbox_id = data["sandboxId"]

        # Fetch tools
        response = requests.get(f"{WORKER_URL}/api/mcp/tools/{self.sandbox_id}")
        data = response.json()
        self.tools = self._convert_tools(data["tools"])

    def _convert_tools(self, mcp_tools):
        """Convert MCP tools to OpenAI format"""
        return [
            {
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool["description"],
                    "parameters": tool["inputSchema"]
                }
            }
            for tool in mcp_tools
        ]

    def call_tool(self, tool_name, args):
        """Execute tool via worker"""
        response = requests.post(
            f"{WORKER_URL}/api/mcp/call/{self.sandbox_id}",
            json={"toolName": tool_name, "args": args}
        )
        return response.json()

def chat_stream(prompt):
    # Initialize tools
    worker = WorkerTools()
    print(f"✓ Loaded {len(worker.tools)} tools\n")

    messages = [{"role": "user", "content": prompt}]

    # Stream response
    stream = client.chat.completions.create(
        model="neosantara/Meta-Llama-3.1-70B-Instruct-Turbo",
        messages=messages,
        tools=worker.tools,
        stream=True
    )

    print("🤖 Assistant: ", end="", flush=True)

    for chunk in stream:
        delta = chunk.choices[0].delta

        # Handle text
        if delta.content:
            print(delta.content, end="", flush=True)

        # Handle tool calls
        if delta.tool_calls:
            for tool_call in delta.tool_calls:
                if tool_call.function.name:
                    print(f"\n\n🔧 Tool: {tool_call.function.name}")

                if tool_call.function.arguments:
                    args = json.loads(tool_call.function.arguments)
                    print(f"📊 Args: {args}")

                    # Execute tool
                    result = worker.call_tool(
                        tool_call.function.name,
                        args
                    )
                    print(f"✓ Result: {result}\n")

    print("\n")

if __name__ == "__main__":
    chat_stream("What is the weather in Jakarta?")
```

---

#### Method 3: Python Class with Error Handling

Complete production-ready example with error handling.

```python
import os
import json
import requests
from typing import List, Dict, Any, Optional
from openai import OpenAI
from dataclasses import dataclass

@dataclass
class ToolResult:
    success: bool
    data: Any
    error: Optional[str] = None

class MCPWorkerClient:
    """Client for interacting with Cloudflare Worker MCP Gateway"""

    def __init__(self, worker_url: str, api_key: str):
        self.worker_url = worker_url
        self.sandbox_id: Optional[str] = None
        self.tools: List[Dict] = []

        self.client = OpenAI(
            api_key=api_key,
            base_url="https://api.neosantara.xyz/v1"
        )

        self._initialize()

    def _initialize(self):
        """Initialize MCP session and fetch tools"""
        try:
            # Init session
            response = requests.post(
                f"{self.worker_url}/api/mcp/init",
                timeout=10
            )
            response.raise_for_status()

            data = response.json()
            self.sandbox_id = data["sandboxId"]

            # Fetch tools
            response = requests.get(
                f"{self.worker_url}/api/mcp/tools/{self.sandbox_id}",
                timeout=10
            )
            response.raise_for_status()

            data = response.json()
            self.tools = self._convert_to_openai_format(data["tools"])

            print(f"✓ Initialized with {len(self.tools)} tools")

        except requests.RequestException as e:
            raise Exception(f"Failed to initialize MCP session: {e}")

    def _convert_to_openai_format(self, mcp_tools: List[Dict]) -> List[Dict]:
        """Convert MCP tools to OpenAI function calling format"""
        return [
            {
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool["description"],
                    "parameters": tool["inputSchema"]
                }
            }
            for tool in mcp_tools
        ]

    def execute_tool(self, tool_name: str, args: Dict) -> ToolResult:
        """Execute tool via worker with error handling"""
        try:
            response = requests.post(
                f"{self.worker_url}/api/mcp/call/{self.sandbox_id}",
                json={"toolName": tool_name, "args": args},
                timeout=30
            )

            # Handle 404 (sandbox restart)
            if response.status_code == 404:
                print("⚠️ Sandbox restarted. Reinitializing...")
                self._initialize()

                # Retry
                response = requests.post(
                    f"{self.worker_url}/api/mcp/call/{self.sandbox_id}",
                    json={"toolName": tool_name, "args": args},
                    timeout=30
                )

            response.raise_for_status()
            data = response.json()

            # Check for MCP errors
            if data.get("isError"):
                return ToolResult(
                    success=False,
                    data=None,
                    error=data.get("error", "Unknown error")
                )

            return ToolResult(success=True, data=data)

        except requests.RequestException as e:
            return ToolResult(
                success=False,
                data=None,
                error=f"Network error: {str(e)}"
            )

    def chat(self, prompt: str, max_iterations: int = 5) -> str:
        """Chat with tool calling support"""
        messages = [{"role": "user", "content": prompt}]

        for iteration in range(max_iterations):
            response = self.client.chat.completions.create(
                model="neosantara/Meta-Llama-3.1-70B-Instruct-Turbo",
                messages=messages,
                tools=self.tools,
                tool_choice="auto"
            )

            message = response.choices[0].message

            # No tool calls - return response
            if not message.tool_calls:
                return message.content

            # Handle tool calls
            messages.append({
                "role": "assistant",
                "content": message.content,
                "tool_calls": message.tool_calls
            })

            for tool_call in message.tool_calls:
                tool_name = tool_call.function.name
                args = json.loads(tool_call.function.arguments)

                print(f"\n🔧 Calling: {tool_name}")
                print(f"📊 Args: {json.dumps(args, indent=2)}")

                # Execute tool
                result = self.execute_tool(tool_name, args)

                if result.success:
                    print(f"✓ Success")
                    content = json.dumps(result.data)
                else:
                    print(f"❌ Error: {result.error}")
                    content = f"Error: {result.error}"

                # Add tool result to messages
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": content
                })

        return "Max iterations reached"

# Usage
def main():
    # Initialize client
    client = MCPWorkerClient(
        worker_url="https://your-worker.workers.dev",
        api_key=os.environ.get("NEOSANTARA_API_KEY")
    )

    # Chat with tool support
    response = client.chat(
        "Search for recent papers on machine learning and summarize the top 3"
    )

    print(f"\n📝 Final Response:\n{response}\n")

if __name__ == "__main__":
    main()
```