"use strict";

/**
 * Hidden trigger used only as a data source for dynamic dropdowns.
 * Populates the "Package" field in the sessionSubmitted trigger and
 * the "Package ID" field in the createSession action.
 */
const listPackagesTrigger = {
  key: "list_packages",
  noun: "Package",

  display: {
    label: "List Packages",
    description: "Lists all Docuplete interview packages for your account.",
    hidden: true,
  },

  operation: {
    perform: async (z, bundle) => {
      const { baseUrl, apiKey } = bundle.authData;
      const response = await z.request({
        url: `${baseUrl}/api/v1/product/docufill/packages`,
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = response.data;
      const packages = Array.isArray(data.packages) ? data.packages : [];
      return packages.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        status: pkg.status,
        transaction_scope: pkg.transaction_scope,
      }));
    },

    sample: {
      id: 7,
      name: "IRA Transfer Package",
      status: "active",
      transaction_scope: "ira_transfer",
    },
  },
};

module.exports = listPackagesTrigger;
