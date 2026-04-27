"use strict";

/**
 * Docuplete uses API key authentication.
 *
 * Users paste their `sk_live_...` API key into the Zapier connection form.
 * The key is sent as a Bearer token on every request.
 * The auth test calls GET /product/auth/me to validate the key and fetches
 * the account name which is used as the connection label in the Zapier UI.
 */
const authentication = {
  type: "custom",

  test: {
    url: "{{bundle.authData.baseUrl}}/api/v1/product/auth/me",
    method: "GET",
    headers: {
      Authorization: "Bearer {{bundle.authData.apiKey}}",
      "Content-Type": "application/json",
    },
    removeMissingValuesFrom: { params: true, body: true },
  },

  connectionLabel: async (z, bundle) => {
    const response = await z.request({
      url: `${bundle.authData.baseUrl}/api/v1/product/auth/me`,
      method: "GET",
      headers: { Authorization: `Bearer ${bundle.authData.apiKey}` },
    });
    const data = response.data;
    return data.accountName || data.slug || "Docuplete Account";
  },

  fields: [
    {
      key: "apiKey",
      label: "API Key",
      required: true,
      type: "password",
      helpText:
        "Your Docuplete API key (starts with `sk_live_`). " +
        "Find it in your Docuplete dashboard under **Settings → API Keys**.",
    },
    {
      key: "baseUrl",
      label: "API Base URL",
      required: true,
      type: "string",
      default: "https://app.docuplete.com",
      helpText:
        "Leave as-is unless your organization uses a custom domain. " +
        "Must not include a trailing slash.",
    },
  ],
};

module.exports = authentication;
