"use strict";

/**
 * Search: Get Session
 *
 * Looks up a Docuplete interview session by its numeric ID or opaque token
 * and returns the current status, answers, and PDF link.
 *
 * The backend GET /sessions/:token endpoint accepts both formats:
 *   - A numeric session ID (e.g. "42") — useful when the session ID comes
 *     from the "Interview Submitted" trigger output
 *   - An opaque session token (e.g. "df_abc123") — returned by Create Session
 *
 * This is a Zapier "Search" action — use it in a Zap to look up a session's
 * completion status before taking a downstream action.
 */

function flattenSession(session, baseUrl) {
  const answers =
    session.answers && typeof session.answers === "object"
      ? session.answers
      : {};

  const pdfUrl = session.generated_pdf_url
    ? `${baseUrl}${session.generated_pdf_url}`
    : null;

  const sessionUrl = `${baseUrl}/internal/docufill?session=${session.token}`;

  const flat = {
    id: session.id,
    token: session.token,
    package_id: session.package_id,
    package_name: session.package_name,
    status: session.status,
    transaction_scope: session.transaction_scope || null,
    custodian_name: session.custodian_name || null,
    depository_name: session.depository_name || null,
    created_at: session.created_at,
    updated_at: session.updated_at,
    expires_at: session.expires_at,
    pdf_url: pdfUrl,
    session_url: sessionUrl,
  };

  for (const [key, value] of Object.entries(answers)) {
    flat[`answer__${key}`] = Array.isArray(value)
      ? value.join(", ")
      : String(value ?? "");
  }

  return flat;
}

const getSessionSearch = {
  key: "get_session",
  noun: "Interview Session",

  display: {
    label: "Get Session",
    description:
      "Finds a Docuplete interview session by its ID or token and returns its " +
      "current status, answers, and a link to the generated PDF.",
  },

  operation: {
    inputFields: [
      {
        key: "sessionId",
        label: "Session ID or Token",
        helpText:
          "The numeric session ID (e.g. `42`) or opaque token (e.g. `df_abc123`). " +
          "Use the **Session ID** output from the **Interview Submitted** trigger, " +
          "or the **Session Token** output from the **Create Interview Session** action.",
        type: "string",
        required: true,
      },
    ],

    perform: async (z, bundle) => {
      const { baseUrl, apiKey } = bundle.authData;
      const { sessionId } = bundle.inputData;

      const response = await z.request({
        url: `${baseUrl}/api/v1/product/docufill/sessions/${encodeURIComponent(sessionId)}`,
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      const data = response.data;
      if (!data.session) return [];
      return [flattenSession(data.session, baseUrl)];
    },

    sample: {
      id: 42,
      token: "df_example456",
      package_id: 7,
      package_name: "IRA Transfer Package",
      status: "generated",
      transaction_scope: "ira_transfer",
      custodian_name: "Example Custodian",
      depository_name: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
      pdf_url:
        "https://app.docuplete.com/api/internal/docufill/sessions/df_example456/packet.pdf",
      session_url:
        "https://app.docuplete.com/internal/docufill?session=df_example456",
      "answer__client_name": "Jane Smith",
      "answer__client_email": "jane@example.com",
    },

    outputFields: [
      { key: "id", label: "Session ID", type: "integer" },
      { key: "token", label: "Session Token" },
      { key: "package_id", label: "Package ID", type: "integer" },
      { key: "package_name", label: "Package Name" },
      { key: "status", label: "Status" },
      { key: "transaction_scope", label: "Transaction Scope" },
      { key: "custodian_name", label: "Custodian" },
      { key: "depository_name", label: "Depository" },
      { key: "pdf_url", label: "PDF Download URL" },
      { key: "session_url", label: "Internal Session URL" },
      { key: "created_at", label: "Created At", type: "datetime" },
      { key: "updated_at", label: "Updated At", type: "datetime" },
      { key: "expires_at", label: "Expires At", type: "datetime" },
    ],
  },
};

module.exports = getSessionSearch;
