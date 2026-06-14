import { createHttpClient } from "bw-web-service-shared";

const baseUrl = process.env.PACWICH_WEB_SERVICE_BASE_URL;

if (!baseUrl) {
  // eslint-disable-next-line no-console
  console.error(
    "PACWICH_WEB_SERVICE_BASE_URL is not set. Rest features may not work.",
  );
}

export const serviceClient = createHttpClient(
  baseUrl ?? "http://localhost:8080",
);
