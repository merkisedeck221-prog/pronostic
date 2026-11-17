import { describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "./cron-auth";

const secret = "s".repeat(40);

describe("isAuthorizedCronRequest", () => {
  it("accepte uniquement « Bearer <CRON_SECRET> »", () => {
    expect(isAuthorizedCronRequest(`Bearer ${secret}`, secret)).toBe(true);
    expect(isAuthorizedCronRequest(secret, secret)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isAuthorizedCronRequest(null, secret)).toBe(false);
    expect(isAuthorizedCronRequest("", secret)).toBe(false);
  });

  it("refuse tout si le secret configuré est absent ou trop court", () => {
    expect(isAuthorizedCronRequest("Bearer ", "")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer court", "court")).toBe(false);
  });
});
