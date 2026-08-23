import { describe, it, expect } from "vitest";
import { parseIsoDuration, formatClock } from "../../lib/util/duration";

describe("parseIsoDuration", () => {
  it("parses minutes and seconds", () => {
    expect(parseIsoDuration("PT4M30S")).toBe(270);
  });
  it("parses hours", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
  });
  it("parses seconds only", () => {
    expect(parseIsoDuration("PT45S")).toBe(45);
  });
  it("parses minutes only", () => {
    expect(parseIsoDuration("PT12M")).toBe(720);
  });
  it("handles day component", () => {
    expect(parseIsoDuration("P1DT1H")).toBe(90000);
  });
  it("returns undefined for junk", () => {
    expect(parseIsoDuration("banana")).toBeUndefined();
    expect(parseIsoDuration("")).toBeUndefined();
  });
});

describe("formatClock", () => {
  it("formats sub-hour as m:ss", () => {
    expect(formatClock(270)).toBe("4:30");
    expect(formatClock(5)).toBe("0:05");
  });
  it("formats hours as h:mm:ss", () => {
    expect(formatClock(3723)).toBe("1:02:03");
  });
  it("clamps negatives", () => {
    expect(formatClock(-10)).toBe("0:00");
  });
});
