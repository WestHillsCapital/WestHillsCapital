#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Docuplete, DocupleteError } from "@docuplete/sdk";

const apiKey = process.env.DOCUPLETE_API_KEY;
if (!apiKey) {
  process.stderr.write(
    "Error: DOCUPLETE_API_KEY environment variable is required.\n" +
    "Set it in your MCP client config or shell before running this server.\n" +
    "Get your API key at https://docuplete.com/settings/api-keys\n",
  );
  process.exit(1);
}

const client = new Docuplete({ apiKey });

const server = new Server(
  { name: "@docupleteapp/mcp-server", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list-packages",
      description:
        "List all document packages configured on the Docuplete account. " +
        "Returns package IDs, names, and descriptions. Use this first to discover available packages before creating a session.",
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: "get-package",
      description:
        "Get full details for a specific document package, including its fields and documents.",
      inputSchema: {
        type: "object" as const,
        properties: {
          packageId: {
            type: "number",
            description: "The numeric ID of the package to fetch.",
          },
        },
        required: ["packageId"],
      },
    },
    {
      name: "create-session",
      description:
        "Start a new interview session for a document package. Returns the session token and a ready-to-use interview URL that can be sent to a recipient to complete the form.",
      inputSchema: {
        type: "object" as const,
        properties: {
          packageId: {
            type: "number",
            description: "The numeric ID of the package to use for this session.",
          },
          prefill: {
            type: "object",
            description:
              "Optional key-value pairs to pre-populate form fields (e.g. { firstName: 'Jane', lastName: 'Smith' }).",
            additionalProperties: true,
          },
          recipientEmail: {
            type: "string",
            description: "Optional email address of the person who will complete the interview.",
          },
          transactionScope: {
            type: "string",
            description: "Optional label describing the transaction (e.g. 'IRA rollover').",
          },
          source: {
            type: "string",
            description: "Optional label identifying where this session was created from.",
          },
        },
        required: ["packageId"],
      },
    },
    {
      name: "get-session",
      description:
        "Check the current status and details of a session by its token. " +
        "Status is one of: 'draft' (not started), 'in_progress' (form open), or 'generated' (PDF ready). " +
        "Poll this tool to check for completion.",
      inputSchema: {
        type: "object" as const,
        properties: {
          token: {
            type: "string",
            description: "The session token returned by create-session.",
          },
        },
        required: ["token"],
      },
    },
    {
      name: "generate-pdf",
      description:
        "Finalise a session and trigger PDF generation. Returns a download URL for the completed PDF packet. " +
        "Call this once the session status is 'in_progress' or after filling answers programmatically.",
      inputSchema: {
        type: "object" as const,
        properties: {
          token: {
            type: "string",
            description: "The session token to generate the PDF for.",
          },
        },
        required: ["token"],
      },
    },
    {
      name: "list-sessions",
      description:
        "List recent sessions on the account with optional filters for package and status.",
      inputSchema: {
        type: "object" as const,
        properties: {
          packageId: {
            type: "number",
            description: "Optional: filter sessions to a specific package.",
          },
          status: {
            type: "string",
            enum: ["draft", "in_progress", "generated"],
            description: "Optional: filter by session status.",
          },
          limit: {
            type: "number",
            description: "Maximum number of sessions to return (default 50).",
          },
          offset: {
            type: "number",
            description: "Offset for pagination.",
          },
        },
        required: [],
      },
    },
  ],
}));

function requireString(input: Record<string, unknown>, key: string): string {
  const val = input[key];
  if (typeof val !== "string" || val.trim() === "") {
    throw new Error(`Missing required argument: "${key}" must be a non-empty string.`);
  }
  return val;
}

function requireNumber(input: Record<string, unknown>, key: string): number {
  const val = input[key];
  if (typeof val !== "number" || !isFinite(val)) {
    throw new Error(`Missing required argument: "${key}" must be a number.`);
  }
  return val;
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const input = (args ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      case "list-packages": {
        const packages = await client.packages.list();
        if (packages.length === 0) {
          return {
            content: [{ type: "text", text: "No packages found on this account." }],
          };
        }
        const lines = packages.map(
          (p) =>
            `• ID ${p.id}: ${p.name}${p.description ? ` — ${p.description}` : ""}`,
        );
        return {
          content: [
            {
              type: "text",
              text: `Found ${packages.length} package(s):\n\n${lines.join("\n")}`,
            },
          ],
        };
      }

      case "get-package": {
        const packageId = requireNumber(input, "packageId");
        const pkg = await client.packages.get(packageId);
        const details = [
          `Package ID: ${pkg.id}`,
          `Name: ${pkg.name}`,
          pkg.description ? `Description: ${pkg.description}` : null,
        ]
          .filter(Boolean)
          .join("\n");
        return {
          content: [{ type: "text", text: details }],
        };
      }

      case "create-session": {
        const packageId = requireNumber(input, "packageId");
        // prefill values must be strings per the SDK type (Record<string, string>)
        const prefill = input.prefill as Record<string, string> | undefined;

        const result = await client.sessions.create({
          packageId,
          prefill,
        });

        const lines = [
          `Session created successfully.`,
          ``,
          `Token: ${result.sessionToken}`,
          ...(result.expiresAt ? [`Expires: ${result.expiresAt}`] : []),
          ``,
          `Interview URL (send this to the recipient):`,
          result.interviewUrl,
        ];

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      }

      case "get-session": {
        const token = requireString(input, "token");
        const session = await client.sessions.get(token);

        const lines = [
          `Token: ${session.token}`,
          `Status: ${session.status}`,
          `Package: ${session.package_name} (ID: ${session.package_id})`,
          `Created: ${session.created_at}`,
          `Expires: ${session.expires_at}`,
        ];

        if (session.status === "generated") {
          lines.push(``, `Answers recorded: ${Object.keys(session.answers ?? {}).length} field(s)`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      }

      case "generate-pdf": {
        const token = requireString(input, "token");
        const result = await client.sessions.generate(token);

        if (result.status === "pending") {
          return {
            content: [{
              type: "text",
              text: [
                `PDF generation is in progress.`,
                ``,
                `Job ID: ${result.jobId}`,
                ``,
                `Use get-generate-status to poll until ready.`,
              ].join("\n"),
            }],
          };
        }

        return {
          content: [{
            type: "text",
            text: [
              `PDF generated successfully.`,
              ``,
              `Download URL: ${result.downloadUrl}`,
            ].join("\n"),
          }],
        };
      }

      case "list-sessions": {
        const packageId = input.packageId as number | undefined;
        const status = input.status as "draft" | "in_progress" | "generated" | undefined;
        const limit = input.limit as number | undefined;
        const offset = input.offset as number | undefined;

        const { sessions, total } = await client.sessions.list({
          packageId,
          status,
          limit,
          offset,
        });

        if (sessions.length === 0) {
          return {
            content: [{ type: "text", text: "No sessions found matching the given filters." }],
          };
        }

        const lines = [
          `Showing ${sessions.length} of ${total} session(s):`,
          ``,
        ];

        for (const s of sessions) {
          lines.push(`• Token: ${s.token}  Status: ${s.status}  Created: ${s.created_at}`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    if (err instanceof DocupleteError) {
      return {
        content: [
          {
            type: "text",
            text: `Docuplete API error (HTTP ${err.status}): ${err.message}`,
          },
        ],
        isError: true,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Unexpected error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Docuplete MCP server running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
