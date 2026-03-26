import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8000";

export const handlers = [
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { username: string; password: string };
    if (body.username === "admin" && body.password === "changeme") {
      return HttpResponse.json({
        access_token: "fake-jwt-token",
        token_type: "bearer",
      });
    }
    return HttpResponse.json({ detail: "Invalid credentials" }, { status: 401 });
  }),
];
