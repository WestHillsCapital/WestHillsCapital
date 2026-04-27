"use strict";

/**
 * Action: Create Interview Session
 *
 * Creates a new Docuplete interview session for a given package.
 * Returns the session token and a direct URL to the interview form
 * so a Zap can immediately share it with the intended recipient.
 *
 * Prefill data is passed as key-value pairs using line-item fields
 * so Zap users can map CRM fields directly into the interview.
 */
const createSessionAction = {
  key: "create_session",
  noun: "Interview Session",

  display: {
    label: "Create Interview Session",
    description:
      "Creates a new Docuplete interview session and returns the interview URL " +
      "so you can send it to a client via email, SMS, or any other channel.",
  },

  operation: {
    inputFields: [
      {
        key: "packageId",
        label: "Package",
        helpText: "The interview package to use for this session.",
        type: "integer",
        dynamic: "list_packages.id.name",
        required: true,
        altersDynamicFields: false,
      },
      {
        key: "source",
        label: "Source",
        helpText:
          "A label describing how this session was created (e.g. 'zapier', 'crm-webhook'). " +
          "Appears in your Docuplete session list.",
        type: "string",
        required: false,
        default: "zapier",
      },
      {
        key: "prefill",
        label: "Prefill Data",
        helpText:
          "Key-value pairs to pre-populate in the interview form. " +
          "Common keys: `firstName`, `lastName`, `email`, `phone`, `accountNumber`. " +
          "Keys must match the field IDs in your package.",
        dict: true,
        required: false,
      },
    ],

    perform: async (z, bundle) => {
      const { baseUrl, apiKey } = bundle.authData;
      const { packageId, source, prefill } = bundle.inputData;

      const body = {
        packageId: Number(packageId),
        source: source || "zapier",
      };

      if (prefill && typeof prefill === "object" && Object.keys(prefill).length > 0) {
        body.prefill = prefill;
      }

      const response = await z.request({
        url: `${baseUrl}/api/v1/product/docufill/sessions`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body,
      });

      const data = response.data;
      const session = data.session || {};

      return {
        id: session.id,
        token: data.token || session.token,
        interview_url: data.interviewUrl,
        package_id: session.package_id,
        package_name: session.package_name,
        status: session.status,
        created_at: session.created_at,
        expires_at: session.expires_at,
        session_url: `${baseUrl}/internal/docufill?session=${data.token || session.token}`,
      };
    },

    sample: {
      id: 42,
      token: "df_example456",
      interview_url: "https://app.docuplete.com/docufill/public/df_example456",
      package_id: 7,
      package_name: "IRA Transfer Package",
      status: "draft",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
      session_url: "https://app.docuplete.com/internal/docufill?session=df_example456",
    },

    outputFields: [
      { key: "id", label: "Session ID", type: "integer" },
      { key: "token", label: "Session Token" },
      { key: "interview_url", label: "Interview URL" },
      { key: "package_id", label: "Package ID", type: "integer" },
      { key: "package_name", label: "Package Name" },
      { key: "status", label: "Status" },
      { key: "created_at", label: "Created At", type: "datetime" },
      { key: "expires_at", label: "Expires At", type: "datetime" },
      { key: "session_url", label: "Internal Session URL" },
    ],
  },
};

module.exports = createSessionAction;
