// Every API route proxies to the Quarkus backend through this constant so
// there's a single place to point at a different backend (staging, prod,
// etc.) via the BACKEND_URL environment variable instead of editing code.
export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";
