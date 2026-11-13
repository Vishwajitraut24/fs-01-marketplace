import { authRouter } from "./routes/auth.routes.js";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./infrastructure/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/health.routes.js";
import cookieParser from "cookie-parser";
import { accessRouter } from "./routes/access.routes.js";
import { vendorRouter } from "./routes/vendor.routes.js";
import adminRouter from "./routes/admin.routes.js";
import productRouter from "./routes/product.routes.js";
import catalogRouter from "./routes/catalog.routes.js";
import cartRouter from "./routes/cart.routes.js";
import orderRouter from "./routes/order.routes.js";
import vendorOrderRouter from "./routes/vendor-order.routes.js";
import paymentRouter from "./routes/payment.routes.js";
import razorpayWebhookRouter from "./routes/razorpay-webhook.routes.js";
import reviewRouter from "./routes/review.routes.js";
import { connectInfrastructure } from "./infrastructure/index.js";

export const app = express();
// Initialize cloud infrastructure when running on Vercel.
let serverlessInfrastructurePromise: Promise<void> | null = null;

if (process.env.VERCEL === "1") {
  app.use((_request, _response, next) => {
    if (!serverlessInfrastructurePromise) {
      serverlessInfrastructurePromise = connectInfrastructure()
        .catch((error: unknown) => {
          serverlessInfrastructurePromise = null;
          throw error;
        });
    }

    void serverlessInfrastructurePromise
      .then(() => next())
      .catch(next);
  });
}

app.disable("x-powered-by");
if (env.TRUST_PROXY) app.set("trust proxy", 1);

app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(cors({
  origin: env.WEB_ORIGIN.split(",").map((origin) => origin.trim()),
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
}));
app.use(
  "/api/v1/webhooks/razorpay",
  razorpayWebhookRouter,
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.get("/", (_request, response) => {
  response.json({ name: "FS-01 Marketplace API", version: "0.1.0", docs: "/api/v1/health/live" });
});

app.use("/api/v1", rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (request) => request.path.startsWith("/health")
}));
app.use("/api/v1/health", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/access", accessRouter);
app.use("/api/v1/vendors", vendorRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/products", reviewRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/catalog", catalogRouter);
app.use("/api/v1/cart", cartRouter);
app.use("/api/v1/orders", orderRouter);
app.use("/api/v1/vendor/orders", vendorOrderRouter);
app.use("/api/v1/payments", paymentRouter);
app.use((_request, response) => {
  response.status(404).json({
    success: false,
    error: { code: "ROUTE_NOT_FOUND", message: "The requested endpoint does not exist." }
  });
});

app.use(errorHandler);
export default app;