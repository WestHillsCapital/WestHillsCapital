"use strict";

/**
 * Polling trigger: Interview Submitted
 *
 * Fires whenever a Docuplete interview session reaches "generated" status
 * (i.e. the client completed the form and documents were generated).
 *
 * Zapier polls this every 1–15 minutes and deduplicates by `id`, so each
 * session only triggers a Zap once regardless of how often we poll.
 *
 * The trigger accepts an optional `packageId` input so users can limit
 * the trigger to a specific interview package.
 */

/** Flatten a session row into a Zapier-friendly object (no nested objects). */
function flattenSession(session, baseUrl) {
  const answers = session.answers && typeof session.answers === "object"
    ? session.answers
    : {};
  const prefill = session.prefill && typeof session.prefill === "object"
    ? session.prefill
    : {};

  const sessionUrl =
    `${baseUrl}/internal/docufill?session=${session.token}`;

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

/** Prefix each key with a namespace so answers and prefill don't collide. */
function flattenAnswers(obj, prefix) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const safeKey = `${prefix}__${key}`;
    result[safeKey] = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  }
  return result;
}

const sessionSubmittedTrigger = {
  key: "session_submitted",
  noun: "Interview Submission",

  display: {
    label: "Interview Submitted",
    description:
      "Triggers when a client completes a Docuplete interview and documents are generated.",
    directions:
      "Select an optional package to limit this trigger to a single interview type. " +
      "Leave blank to trigger for all packages.",
  },

  operation: {
    type: "polling",

    inputFields: [
      {
        key: "packageId",
        label: "Package (optional)",
        helpText:
          "Only trigger for sessions belonging to this interview package. " +
          "Leave blank to receive all submitted sessions across all packages.",
        type: "integer",
        dynamic: "list_packages.id.name",
        required: false,
        altersDynamicFields: false,
      },
    ],

    perform: async (z, bundle) => {
      const { baseUrl, apiKey } = bundle.authData;
      const { packageId } = bundle.inputData;

      const params = new URLSearchParams();
      params.set("status", "generated");
      params.set("limit", "25");
      if (packageId) params.set("packageId", String(packageId));

      if (bundle.meta.isLoadingSample) {
        params.delete("updatedAfter");
      } else if (bundle.meta.page > 0) {
        const cursor = bundle.meta.zap?.trigger?.lastPollData?.cursor;
        if (cursor) params.set("updatedAfter", cursor);
      }

      const response = await z.request({
        url: `${baseUrl}/api/v1/product/docufill/sessions?${params}`,
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      const data = response.data;
      const sessions = Array.isArray(data.sessions) ? data.sessions : [];
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
      session_url: "https://app.docuplete.com/internal/docufill?session=df_example123",
      pdf_url: "https://app.docuplete.com/api/internal/docufill/sessions/df_example123/packet.pdf",
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
