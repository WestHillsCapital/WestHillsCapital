import { Router, type IRouter } from "express";
import swaggerUi from "swagger-ui-express";
import spec from "../lib/openapi-spec.json";

const router: IRouter = Router();

const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
  customSiteTitle: "DocuPak API Docs",
  customCss: `
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
  `,
  swaggerOptions: {
    deepLinking: true,
    displayRequestDuration: true,
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 2,
    tryItOutEnabled: true,
  },
};

router.get("/docs/openapi.json", (_req, res) => {
  res.json(spec);
});

router.use("/docs", swaggerUi.serve, swaggerUi.setup(spec as swaggerUi.JsonObject, swaggerUiOptions));

export default router;
