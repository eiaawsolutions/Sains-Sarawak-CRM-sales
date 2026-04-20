import { describe, it, expect } from "vitest";
import { normaliseActual, deriveSeverity, mapModule } from "@/uat/classify";

describe("UAT classification", () => {
  it("normalises 'Please select:' to Pending", () => {
    expect(normaliseActual("Please select:")).toBe("Pending");
    expect(normaliseActual("")).toBe("Pending");
    expect(normaliseActual("Pass")).toBe("Pass");
    expect(normaliseActual("Fail")).toBe("Fail");
  });

  it("derives Critical from known panic-phrases", () => {
    expect(deriveSeverity("Fail", "can't proceed next step")).toBe("Critical");
    expect(deriveSeverity("Fail", "Server Error in /sains ...")).toBe("Critical");
    expect(deriveSeverity("Fail", "Ajax Error has occurred")).toBe("Critical");
  });

  it("Fail without remark is Medium", () => {
    expect(deriveSeverity("Fail", null)).toBe("Medium");
    expect(deriveSeverity("Fail", "")).toBe("Medium");
  });

  it("maps sheet names to module enum", () => {
    expect(mapModule("LEAD MODULE")).toBe("Lead");
    expect(mapModule("SAINS CRM Login via SSO")).toBe("Auth");
    expect(mapModule("Reporting Module")).toBe("Reporting");
  });
});
