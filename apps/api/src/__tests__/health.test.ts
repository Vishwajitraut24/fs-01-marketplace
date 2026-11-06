import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";

describe("GET /api/v1/health/live", () => {
  it("returns a live response without requiring infrastructure connections", async () => {
    const response = await request(app).get("/api/v1/health/live");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { status: "alive" }
    });
  });
});
