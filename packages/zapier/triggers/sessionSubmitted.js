"use strict";

/**
 * Polling trigger: Interview Submitted
 *
 * Fires whenever a Docuplete interview session reaches "generated" status
 * (client completed the form and documents were generated).
 *
 * Correctness guarantees:
 * 1. No missed events: within each poll, the trigger paginates by offset until
 *    it receives a partial page (< PAGE_SIZE), ensuring all sessions in the
 *    window are captured regardless of volume.
 * 2. No duplicate triggers: z.cursor persists a composite cursor
 *    {updatedAt, cursorId} between polls. The backend filters using a PostgreSQL
 *    tuple comparison `(updated_at, id) > (cursorTs, cursorId)` with ORDER BY
 *    updated_at DESC, id DESC — deterministic even when sessions share a
 *    timestamp. Zapier deduplication by `id` acts as a final safety net.
 * 3. Stable ordering: ORDER BY updated_at DESC, id DESC on the backend
 *    ensures the same session always has the same rank, making offset-based
 *    pagination within a poll reliable.
 */

const PAGE_SIZE = 100;

/** Flatten a session row into a Zapier-friendly top-level object. */
function flattenSession(session, baseUrl) {
  const answers =
    session.answers && typeof session.answers === "object"
      ? session.answers
      : {};
  const prefill =
    session.prefill && typeof session.prefill === "object"
      ? session.prefill
      : {};

  const sessionUrl = `${baseUrl}/internal/docufill?session=${session.token}`;
  const pdfUrl = session.generated_pdf_url
    ? `${baseUrl}${session.generated_pdf_url}`
    : null;

  return {
    id: session.id,
    token: session.token,
    package_id: session.package_id,
    package_name: session.package_name,
    status: session.status,
    transaction_scope: session.transaction_scope || null,
    created_at: session.created_at,
    updated_at: session.updated_at,
    expires_at: session.expires_at,
    session_url: sessionUrl,
    pdf_url: pdfUrl,
    ...flattenAnswers(answers, "answer"),
    ...flattenAnswers(prefill, "prefill"),
  };
}

function flattenAnswers(obj, prefix) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[`${prefix}__${key}`] = Array.isArray(value)
      ? value.join(", ")
      : String(value ?? "");
  }
  return result;
}

/** Fetch all pages for the current poll window. Paginates until a partial page. */
async function fetchAllPages(z, baseUrl, apiKey, packageId, cursorUpdatedAt, cursorId) {
  const allSessions = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams();
    params.set("status", "generated");
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));
    if (packageId) params.set("packageId", String(packageId));
    if (cursorUpdatedAt) {
      params.set("updatedAfter", cursorUpdatedAt);
      if (cursorId != null) params.set("cursorId", String(cursorId));
    }

    const response = await z.request({
      url: `${baseUrl}/api/v1/product/docufill/sessions?${params}`,
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const sessions = Array.isArray(response.data.sessions)
      ? response.data.sessions
      : [];

    allSessions.push(...sessions);

    if (sessions.length < PAGE_SIZE) {
      // Partial page: we've reached the end of available results.
      break;
    }
    offset += PAGE_SIZE;
  }

  return allSessions;
}

const sessionSubmittedTrigger = {
  key: "session_submitted",
  noun: "Interview Submission",

  display: {
    label: "Interview Submitted",
    description:
      "Triggers when a client completes a Docuplete interview and documents are generated.",
    directions:
      "Optionally filter by package to limit this trigger to a single interview type.",
  },

  operation: {
    type: "polling",

    canPaginate: false,

    inputFields: [
      {
        key: "packageId",
        label: "Package (optional)",
        helpText:
          "Only trigger for this interview package. Leave blank for all packages.",
        type: "integer",
        dynamic: "list_packages.id.name",
        required: false,
        altersDynamicFields: false,
      },
    ],

    perform: async (z, bundle) => {
      const { baseUrl, apiKey } = bundle.authData;
      const { packageId } = bundle.inputData;

      // Load composite cursor persisted from the previous poll.
      // Cursor shape: { updatedAt: ISO string, cursorId: number }
      let cursorUpdatedAt = null;
      let cursorId = null;

      if (!bundle.meta.isLoadingSample) {
        const rawCursor = await z.cursor.get();
        if (rawCursor) {
          try {
            const parsed = JSON.parse(rawCursor);
            cursorUpdatedAt = parsed.updatedAt || null;
            cursorId = parsed.cursorId != null ? Number(parsed.cursorId) : null;
          } catch {
            // Malformed cursor — treat as first run.
          }
        }
      }

      const sessions = await fetchAllPages(
        z,
        baseUrl,
        apiKey,
        packageId,
        cursorUpdatedAt,
        cursorId,
      );

      // Advance the cursor to the newest session in this batch.
      // With ORDER BY updated_at DESC, id DESC, sessions[0] is the most recent.
      if (sessions.length > 0 && !bundle.meta.isLoadingSample) {
        const newest = sessions[0];
        await z.cursor.set(
          JSON.stringify({
            updatedAt: newest.updated_at,
            cursorId: newest.id,
          }),
        );
      }

      return sessions.map((s) => flattenSession(s, baseUrl));
    },

    sample: {
      id: 1,
      token: "df_example123",
      package_id: 7,
      package_name: "IRA Transfer Package",
      status: "generated",
      transaction_scope: "ira_transfer",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
      session_url:
        "https://app.docuplete.com/internal/docufill?session=df_example123",
      pdf_url:
        "https://app.docuplete.com/api/internal/docufill/sessions/df_example123/packet.pdf",
      "answer__client_name": "Jane Smith",
      "answer__client_email": "jane@example.com",
      "prefill__firstName": "Jane",
      "prefill__lastName": "Smith",
    },

    outputFields: [
      { key: "id", label: "Session ID", type: "integer" },
      { key: "token", label: "Session Token" },
      { key: "package_id", label: "Package ID", type: "integer" },
      { key: "package_name", label: "Package Name" },
      { key: "status", label: "Status" },
      { key: "transaction_scope", label: "Transaction Scope" },
      { key: "session_url", label: "Session URL" },
      { key: "pdf_url", label: "PDF Download URL" },
      { key: "created_at", label: "Created At", type: "datetime" },
      { key: "updated_at", label: "Updated At", type: "datetime" },
      { key: "expires_at", label: "Expires At", type: "datetime" },
    ],
  },
};

module.exports = sessionSubmittedTrigger;
