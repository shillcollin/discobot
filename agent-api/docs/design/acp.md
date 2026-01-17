# ACP Module

This module implements the Agent Client Protocol (ACP) client for communicating with Claude Code.

## Files

| File | Description |
|------|-------------|
| `src/acp/client.ts` | ACP client wrapper with session replay |
| `src/acp/translate.ts` | UIMessage ↔ ContentBlock conversion |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ACP Client                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Connection Layer                        │  │
│  │  - Spawns claude-code-acp process                        │  │
│  │  - Manages stdio streams                                  │  │
│  │  - ndjson protocol framing                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Session Layer                           │  │
│  │  - Creates/loads/resumes sessions                        │  │
│  │  - Handles permission requests                           │  │
│  │  - Routes updates to callbacks                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Translation happens in two places:
- translate.ts: UIMessage → ContentBlock (for sending prompts to ACP)
- stream.ts: SessionUpdate → UIMessageChunk (for streaming responses)
- client.ts: SessionUpdate → UIPart (for session replay only)
```

## ACPClient Class

### Constructor

```typescript
interface ACPClientConfig {
  command: string      // e.g., "claude-code-acp"
  args: string[]       // Additional arguments
  cwd: string          // Working directory
}

class ACPClient {
  constructor(config: ACPClientConfig)
}
```

### Methods

#### connect()

Spawns the Claude Code process and establishes ACP connection:

```typescript
async connect(): Promise<void>
```

Implementation:
1. Spawn child process with configured command
2. Create Web Streams from stdio
3. Initialize ACP connection with ndjson transport
4. Set up error handlers

#### ensureSession()

Creates or loads an existing session:

```typescript
async ensureSession(): Promise<string>
```

Flow:
```
1. Try to load persisted session
   │
   ├─ Success: Replay messages, return session ID
   │
   └─ Failure: Try to resume session
               │
               ├─ Success: Return session ID
               │
               └─ Failure: Create new session
```

#### prompt(content)

Sends a prompt to the agent:

```typescript
async prompt(content: ContentBlock[]): Promise<void>
```

The response is received via the update callback.

#### setUpdateCallback(callback)

Registers handler for streaming updates:

```typescript
setUpdateCallback(callback: (update: SessionUpdate) => void): void
```

Update types received:
- `agent_message_chunk` - Text content
- `agent_thought_chunk` - Reasoning/thinking
- `tool_call` - Tool invocation start
- `tool_call_update` - Tool progress/completion
- `user_message_chunk` - Echo of user message (during replay)

#### cancel()

Cancels the current prompt:

```typescript
async cancel(): Promise<void>
```

#### disconnect()

Terminates the agent process:

```typescript
disconnect(): void
```

## Session Replay

When loading a persisted session, messages are replayed:

```typescript
async replaySession(sessionId: string): Promise<UIMessage[]> {
  const messages: UIMessage[] = []
  let currentMessage: UIMessage | null = null

  // Intercept updates during loadSession
  this.setUpdateCallback((update) => {
    switch (update.type) {
      case 'user_message_chunk':
        // Start new user message
        currentMessage = createUIMessage('user')
        // Append text content
        break

      case 'agent_message_chunk':
        // Start or continue assistant message
        if (!currentMessage || currentMessage.role !== 'assistant') {
          currentMessage = createUIMessage('assistant')
        }
        // Append text part
        break

      case 'tool_call':
        // Add tool invocation part
        break
    }
  })

  await this.acp.loadSession(sessionId)
  return messages
}
```

## Translation Functions

### uiMessageToContentBlocks()

Converts AI SDK message to ACP format:

```typescript
function uiMessageToContentBlocks(message: UIMessage): ContentBlock[] {
  return message.parts.map(part => {
    switch (part.type) {
      case 'text':
        return { type: 'text', text: part.text }

      case 'file':
        return {
          type: 'resource_link',
          uri: part.url,
          name: part.name,
          mimeType: part.mimeType
        }

      default:
        throw new Error(`Unsupported part type: ${part.type}`)
    }
  })
}
```

### sessionUpdateToPart() (in client.ts)

Local helper in client.ts for session replay. Converts ACP update to AI SDK part:

```typescript
function sessionUpdateToPart(update: SessionUpdate): UIMessagePart | null {
  switch (update.sessionUpdate) {
    case 'user_message_chunk':
    case 'agent_message_chunk':
      if (update.content.type === 'text') {
        return { type: 'text', text: update.content.text }
      }
      break

    case 'agent_thought_chunk':
      if (update.content.type === 'text') {
        return { type: 'reasoning', text: update.content.text }
      }
      break

    case 'tool_call':
    case 'tool_call_update':
      // Returns DynamicToolUIPart with appropriate state
      break
  }
  return null
}
```

**Note:** For real-time streaming, use `sessionUpdateToChunks()` from `stream.ts` instead,
which produces UIMessageChunk events with proper start/delta/end sequencing.

### Tool Status Mapping

```typescript
function mapToolStatus(acpStatus: string): string {
  const mapping = {
    'pending': 'input-streaming',
    'in_progress': 'input-available',
    'completed': 'output-available',
    'failed': 'output-error'
  }
  return mapping[acpStatus] ?? 'input-streaming'
}
```

### toolCallToUIPart()

Converts tool call to dynamic tool part:

```typescript
function toolCallToUIPart(toolCall: ACPToolCall): DynamicToolUIPart {
  return {
    type: 'dynamic-tool',
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    state: mapToolStatus(toolCall.status),
    input: toolCall.input,
    output: toolCall.output
  }
}
```

## Message ID Generation

```typescript
function generateMessageId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `msg-${timestamp}-${random}`
}
```

## Error Handling

### Connection Errors

```typescript
try {
  await this.connect()
} catch (error) {
  if (error.code === 'ENOENT') {
    throw new Error(`Agent command not found: ${this.config.command}`)
  }
  throw error
}
```

### Session Errors

```typescript
try {
  await this.acp.loadSession(sessionId)
} catch (error) {
  console.warn('Failed to load session, creating new:', error)
  await this.acp.newSession()
}
```

### Permission Handling

The client auto-approves permission requests:

```typescript
this.acp.onPermissionRequest((request) => {
  return { approved: true }
})
```

## Agent-Specific Extensions

The ACP specification includes an `_meta` field for agent-specific extensions. This section documents
how different agent implementations use this field.

### Claude Code Extensions

Claude Code (via `claude-code-acp`) uses `_meta.claudeCode` to provide additional metadata not covered
by the standard ACP specification. The translation layer extracts these fields with fallbacks:

```
Priority: Standard ACP field → _meta.claudeCode field → Default value
```

#### _meta.claudeCode Fields

| Field | Type | Description |
|-------|------|-------------|
| `toolName` | `string` | The actual Claude Code tool name (e.g., "Bash", "Read", "Edit", "Write"). Different from `title` which is the display name. |
| `toolResponse` | `object` | Structured tool output for terminal commands |
| `toolResponse.stdout` | `string` | Standard output from the command |
| `toolResponse.stderr` | `string` | Standard error from the command |
| `toolResponse.interrupted` | `boolean` | Whether the command was interrupted |
| `toolResponse.isImage` | `boolean` | Whether the output is an image |
| `options` | `object` | Session options forwarded to Claude Code (only on `newSession`) |

#### Field Extraction Priority

When translating ACP events to UIMessageChunk:

**Tool Name:**
```typescript
// Priority: _meta.claudeCode.toolName → title → "unknown"
toolName = _meta?.claudeCode?.toolName || title || "unknown"
```

**Tool Output:**
```typescript
// Priority: rawOutput → _meta.claudeCode.toolResponse → content array
output = rawOutput ?? _meta?.claudeCode?.toolResponse ?? extractFromContent(content)
```

**Display Title:**
```typescript
// Use ACP title field directly (e.g., "`ls -la /tmp`")
title = update.title
```

#### Example: Tool Call with Claude Code Extensions

ACP ToolCall from Claude Code:
```json
{
  "sessionUpdate": "tool_call",
  "toolCallId": "toolu_123",
  "title": "`ls -la /tmp`",
  "kind": "execute",
  "status": "pending",
  "rawInput": { "command": "ls -la /tmp" },
  "_meta": {
    "claudeCode": {
      "toolName": "Bash"
    }
  }
}
```

Translated UIMessageChunk:
```json
{
  "type": "tool-input-start",
  "toolCallId": "toolu_123",
  "toolName": "Bash",
  "title": "`ls -la /tmp`",
  "providerMetadata": {
    "claudeCode": { "toolName": "Bash" }
  },
  "dynamic": true
}
```

#### Example: Tool Output with Claude Code Extensions

ACP ToolCallUpdate from Claude Code:
```json
{
  "sessionUpdate": "tool_call_update",
  "toolCallId": "toolu_123",
  "status": "completed",
  "_meta": {
    "claudeCode": {
      "toolName": "Bash",
      "toolResponse": {
        "stdout": "file1.txt\nfile2.txt",
        "stderr": "",
        "interrupted": false
      }
    }
  }
}
```

Translated UIMessageChunk:
```json
{
  "type": "tool-output-available",
  "toolCallId": "toolu_123",
  "output": {
    "stdout": "file1.txt\nfile2.txt",
    "stderr": "",
    "interrupted": false
  },
  "dynamic": true
}
```

### Adding Support for New Agents

When adding support for a new ACP agent implementation:

1. **Check for _meta extensions**: Review the agent's source code for `_meta` usage
2. **Add extraction helpers**: Create functions in `stream.ts` to extract agent-specific fields
3. **Maintain fallback order**: Always check standard ACP fields first, then agent extensions
4. **Document the extension**: Add a section here describing the agent's `_meta` structure
5. **Pass through providerMetadata**: Include relevant metadata in `providerMetadata` for UI access

## Testing

### Unit Tests (translate.test.ts)

```typescript
describe('sessionUpdateToUIPart', () => {
  it('converts agent_message_chunk to text part', () => {
    const update = {
      type: 'agent_message_chunk',
      content: 'Hello'
    }
    const part = sessionUpdateToUIPart(update)
    assert.deepStrictEqual(part, {
      type: 'text',
      text: 'Hello'
    })
  })

  it('converts tool_call to dynamic-tool part', () => {
    const update = {
      type: 'tool_call',
      id: 'tc-1',
      name: 'write_file',
      status: 'completed',
      input: { path: '/file.txt' },
      output: 'Success'
    }
    const part = sessionUpdateToUIPart(update)
    assert.strictEqual(part.type, 'dynamic-tool')
    assert.strictEqual(part.state, 'output-available')
  })
})
```

### Integration Tests

```typescript
describe('ACPClient', () => {
  it('sends prompt and receives response', async () => {
    const client = new ACPClient({
      command: 'claude-code-acp',
      args: [],
      cwd: '/workspace'
    })

    await client.connect()
    await client.ensureSession()

    const updates: SessionUpdate[] = []
    client.setUpdateCallback(u => updates.push(u))

    await client.prompt([{ type: 'text', text: 'Hello' }])

    assert(updates.some(u => u.type === 'agent_message_chunk'))
  })
})
```
