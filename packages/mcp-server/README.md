# @docuplete/mcp-server

[![Docuplete](https://img.shields.io/badge/Powered%20by-Docuplete-blue?style=flat-square)](https://docuplete.com)

Official [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for [Docuplete](https://docuplete.com) — control document automation from **Claude Desktop**, **Cursor**, and any MCP-compatible AI client.

---

## What it does

This server exposes Docuplete's document-filling and PDF-generation capabilities as MCP tools, letting you ask your AI assistant things like:

- "List my available document packages"
- "Create a session for the IRA Rollover package and pre-fill Jane Smith's name"
- "Check if session df_abc123 is complete"
- "Generate the PDF for session df_abc123 and give me the download link"

---

## Quick start (npx)

```bash
DOCUPLETE_API_KEY=sk_live_... npx @docuplete/mcp-server
```

---

## Installation

### Claude Desktop

Add the following to your `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "docuplete": {
      "command": "npx",
      "args": ["-y", "@docuplete/mcp-server"],
      "env": {
        "DOCUPLETE_API_KEY": "sk_live_YOUR_KEY_HERE"
      }
    }
  }
}
```

Restart Claude Desktop — you'll see the Docuplete tools available in the tool panel.

### Cursor

Add the following to `.cursor/mcp.json` in your project (or `~/.cursor/mcp.json` globally):

```json
{
  "mcpServers": {
    "docuplete": {
      "command": "npx",
      "args": ["-y", "@docuplete/mcp-server"],
      "env": {
        "DOCUPLETE_API_KEY": "sk_live_YOUR_KEY_HERE"
      }
    }
  }
}
```

---

## Authentication

Get your API key from the [Docuplete dashboard](https://docuplete.com/settings/api-keys) under **Settings → API Keys**.

API keys are prefixed with `sk_live_`. Store them in environment variables — never hard-code them.

---

## Available tools

| Tool | Description | Required inputs |
|------|-------------|-----------------|
| `list-packages` | List all document packages on your account | — |
| `get-package` | Get full details for a specific package | `packageId` |
| `create-session` | Start a new interview session and get the interview URL | `packageId` |
| `get-session` | Check the status of a session (poll for completion) | `token` |
| `generate-pdf` | Finalise a session and generate the PDF packet | `token` |
| `list-sessions` | List recent sessions with optional filters | — |

### Tool details

#### `list-packages`
Returns all packages configured on the account with their IDs and names.

#### `get-package`
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `packageId` | number | yes | Numeric package ID |

#### `create-session`
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `packageId` | number | yes | Package to use |
| `prefill` | object | no | Key-value pairs to pre-populate form fields |
| `recipientEmail` | string | no | Email of the person completing the interview |
| `transactionScope` | string | no | Label describing the transaction |
| `source` | string | no | Label identifying where this session came from |

Returns the session `token` and `interviewUrl`.

#### `get-session`
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | yes | Session token from `create-session` |

Session `status` values: `draft` → `in_progress` → `generated`.

#### `generate-pdf`
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | yes | Session token |

Returns a `downloadUrl` for the completed PDF packet.

#### `list-sessions`
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `packageId` | number | no | Filter to a specific package |
| `status` | string | no | Filter by status: `draft`, `in_progress`, or `generated` |
| `limit` | number | no | Max results (default 50) |
| `offset` | number | no | Offset for pagination |

---

## Example workflow

Ask your AI assistant:

> "Use Docuplete to create an IRA rollover document session for Jane Smith (jane@example.com) and give me the link."

The assistant will:
1. Call `list-packages` to find the IRA rollover package
2. Call `create-session` with Jane's details pre-filled
3. Return the interview URL for you to share

---

## Get your API key

Sign up or log in at [docuplete.com](https://docuplete.com) and go to **Settings → API Keys** to create your key.

---

## License

MIT
