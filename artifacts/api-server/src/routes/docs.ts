import { Router, type IRouter, type Request, type Response } from "express";
import { openApiSpec } from "../lib/openapi";

const router: IRouter = Router();

const SWAGGER_UI_VERSION = "5.18.2";
const SWAGGER_UI_CDN = `https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}`;

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DocuPak API Docs</title>
  <link rel="stylesheet" href="${SWAGGER_UI_CDN}/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { background: #0F1C3F; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
    .swagger-ui .topbar-wrapper .link { pointer-events: none; }
    .swagger-ui .topbar-wrapper img { content: none; }
    .swagger-ui .topbar-wrapper::before {
      content: "DocuPak API";
      color: #fff;
      font-size: 1.1rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      padding: 0 0.5rem;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${SWAGGER_UI_CDN}/swagger-ui-bundle.js"></script>
  <script src="${SWAGGER_UI_CDN}/swagger-ui-standalone-preset.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/api/docs/openapi.json",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: "StandaloneLayout",
      deepLinking: true,
      displayRequestDuration: true,
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 2,
      tryItOutEnabled: true,
    });
  </script>
</body>
</html>`;

router.get("/docs/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

router.get("/docs", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(HTML);
});

export default router;
