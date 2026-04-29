(function () {
  "use strict";

  var scripts = document.querySelectorAll("script[data-key]");
  var scriptTag = scripts[scripts.length - 1];
  if (!scriptTag) return;

  var embedKey  = scriptTag.getAttribute("data-key") || "";
  var apiBase   = (scriptTag.getAttribute("data-api") || "").replace(/\/$/, "");
  var targetId  = scriptTag.getAttribute("data-target") || "";
  var height    = parseInt(scriptTag.getAttribute("data-height") || "0", 10);

  if (!embedKey || !apiBase) {
    console.warn("[Docuplete] embed/v1.js: data-key and data-api are required.");
    return;
  }

  var container;
  if (targetId) {
    container = document.getElementById(targetId);
    if (!container) {
      console.warn("[Docuplete] embed/v1.js: element #" + targetId + " not found.");
      return;
    }
  } else {
    container = document.createElement("div");
    scriptTag.parentNode && scriptTag.parentNode.insertBefore(container, scriptTag);
  }

  container.style.cssText = "width:100%;position:relative;";
  container.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:center;' +
    'padding:48px 24px;font-family:system-ui,sans-serif;color:#8a9bb8;font-size:14px;">' +
    "Loading\u2026</div>";

  fetch(apiBase + "/api/v1/docufill/public/embed/" + embedKey + "/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.token || !data.interviewUrl) {
        throw new Error(data.error || "Could not start session");
      }

      var src = data.interviewUrl + "?embed=1";
      var iframe = document.createElement("iframe");
      iframe.src = src;
      iframe.title = "Document form";
      iframe.setAttribute("allowtransparency", "true");
      iframe.setAttribute("scrolling", "no");
      iframe.style.cssText =
        "width:100%;border:none;display:block;overflow:hidden;" +
        "min-height:" + (height > 0 ? height : 520) + "px;";
      if (height > 0) iframe.style.height = height + "px";

      container.innerHTML = "";
      container.appendChild(iframe);

      window.addEventListener("message", function (e) {
        if (
          e.data &&
          e.data.type === "docuplete:resize" &&
          typeof e.data.height === "number"
        ) {
          iframe.style.height = e.data.height + "px";
        }
      });
    })
    .catch(function (err) {
      container.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;' +
        'padding:48px 24px;font-family:system-ui,sans-serif;color:#ef4444;font-size:14px;">' +
        "Failed to load form. Please refresh the page.</div>";
      console.error("[Docuplete] Embed error:", err);
    });
})();
