"use strict";

const { version: platformVersion } = require("zapier-platform-core");

const authentication = require("./authentication");
const sessionSubmittedTrigger = require("./triggers/sessionSubmitted");
const listPackagesTrigger = require("./triggers/listPackages");
const createSessionAction = require("./creates/createSession");
const getSessionSearch = require("./searches/getSession");

const { version } = require("./package.json");

const App = {
  version,
  platformVersion,

  authentication,

  beforeRequest: [
    (request, z, bundle) => {
      if (bundle.authData.apiKey) {
        request.headers = request.headers || {};
        request.headers.Authorization = `Bearer ${bundle.authData.apiKey}`;
        request.headers["Content-Type"] = "application/json";
      }
      return request;
    },
  ],

  afterResponse: [
    (response, z) => {
      if (response.status === 401) {
        throw new z.errors.Error(
          "Invalid API key. Check your Docuplete connection under Settings → API Keys.",
          "AuthenticationError",
          401,
        );
      }
      if (response.status >= 500) {
        throw new z.errors.Error(
          "Docuplete returned a server error. Please try again later.",
          "ServerError",
          response.status,
        );
      }
      return response;
    },
  ],

  triggers: {
    [sessionSubmittedTrigger.key]: sessionSubmittedTrigger,
    [listPackagesTrigger.key]: listPackagesTrigger,
  },

  creates: {
    [createSessionAction.key]: createSessionAction,
  },

  searches: {
    [getSessionSearch.key]: getSessionSearch,
  },

  searchOrCreates: {},
};

module.exports = App;
