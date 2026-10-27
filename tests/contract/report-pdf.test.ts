import { expect, test } from "bun:test";
import { PDFDocument } from "pdf-lib";
import { buildOfficeSnapshot, InMemoryOfficeRepository } from "../../packages/domain/src";
import { createOfficeReportPdf } from "../../apps/api/src/report-pdf";

test("PDF export produces a readable single-page document from the dashboard snapshot", async () => {
  const snapshot = buildOfficeSnapshot(new InMemoryOfficeRepository(new Date("2026-10-27T10:00:00Z")), {
    currency: "BDT", tariffPerKwh: 12, timezone: "Asia/Dhaka", publicWsUrl: "ws://localhost/ws",
    platformAuthenticated: true, controlAuthorized: false
  });
  const bytes = await createOfficeReportPdf({ ...snapshot, telemetryMode: "simulated" });
  expect(new TextDecoder().decode(bytes.slice(0, 8))).toBe("%PDF-1.7");
  const parsed = await PDFDocument.load(bytes);
  expect(parsed.getPageCount()).toBe(1);
  expect(parsed.getTitle()).toBe("OfficePulse energy report");
  expect(parsed.getPage(0).getHeight()).toBeCloseTo(841.89);
});
