import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { OfficeSnapshot } from "../../../packages/contracts/src";

/** A real, printable report; values are taken from the same snapshot as the dashboard. */
export async function createOfficeReportPdf(snapshot: OfficeSnapshot): Promise<ArrayBuffer> {
  const document = await PDFDocument.create();
  document.setTitle("OfficePulse energy report");
  document.setAuthor("OfficePulse");
  document.setCreationDate(new Date(snapshot.generatedAt));
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const page = document.addPage([595.28, 841.89]);
  const ink = rgb(0.08, 0.09, 0.1);
  const muted = rgb(0.39, 0.42, 0.45);
  const orange = rgb(0.96, 0.48, 0.24);
  const text = (value: string, x: number, y: number, size = 11, strong = false, color = ink) => {
    // The built-in font covers the report's English labels and seeded room names.
    const printable = value.normalize("NFKD").replace(/[^\x20-\x7e]/g, "?");
    page.drawText(printable, { x, y, size, font: strong ? bold : regular, color });
  };
  page.drawRectangle({ x: 0, y: 728, width: 595.28, height: 114, color: ink });
  page.drawRectangle({ x: 48, y: 763, width: 5, height: 38, color: orange });
  text("OfficePulse", 67, 783, 25, true, rgb(1, 1, 1));
  text("OFFICE ENERGY REPORT", 67, 758, 10, false, rgb(0.8, 0.82, 0.84));
  text(`Generated ${new Date(snapshot.generatedAt).toISOString().replace("T", " ").slice(0, 19)} UTC`, 48, 697, 10, false, muted);
  text(snapshot.telemetryMode === "simulated" ? "SIMULATED TELEMETRY" : "CONFIGURED TELEMETRY", 48, 674, 10, true, muted);
  const metrics = [
    ["TOTAL POWER", `${snapshot.energy.totalPowerWatts.toFixed(2)} W`],
    ["ENERGY TODAY", `${snapshot.energy.todayKwh.toFixed(3)} kWh`],
    ["ESTIMATED COST TODAY", `${snapshot.energy.estimatedCostToday.toFixed(2)} ${snapshot.energy.currency}`]
  ];
  metrics.forEach(([label, value], index) => {
    const x = 48 + index * 170;
    page.drawRectangle({ x, y: 566, width: 159, height: 77, color: rgb(0.96, 0.96, 0.95) });
    text(label, x + 12, 619, 8, true, muted);
    text(value, x + 12, 587, 17, true);
  });
  text("Room overview", 48, 527, 17, true);
  const columns = [48, 300, 405, 480];
  ["ROOM", "POWER (W)", "ACTIVE", "ALERTS"].forEach((label, index) => text(label, columns[index], 494, 9, true, muted));
  page.drawLine({ start: { x: 48, y: 482 }, end: { x: 547, y: 482 }, thickness: 1, color: rgb(0.85, 0.86, 0.87) });
  snapshot.rooms.forEach((room, index) => {
    const y = 452 - index * 45;
    if (index % 2 === 0) page.drawRectangle({ x: 48, y: y - 13, width: 499, height: 36, color: rgb(0.97, 0.97, 0.97) });
    text(room.room.name.length > 30 ? `${room.room.name.slice(0, 27)}...` : room.room.name, columns[0] + 8, y);
    text(room.powerWatts.toFixed(2), columns[1], y);
    text(String(room.activeDeviceCount), columns[2], y);
    text(String(room.alerts.length), columns[3], y);
  });
  text(`Active alerts: ${snapshot.alerts.filter(alert => alert.status === "active").length}`, 48, 270, 11, true);
  text("Energy and cost values are estimates based on configured telemetry.", 48, 99, 10, false, muted);
  text("This report is not a billing statement.", 48, 82, 10, false, muted);
  page.drawLine({ start: { x: 48, y: 64 }, end: { x: 547, y: 64 }, thickness: 1, color: rgb(0.85, 0.86, 0.87) });
  text("OfficePulse", 48, 44, 9, true, muted);
  text("1 / 1", 518, 44, 9, false, muted);
  return new Uint8Array(await document.save()).buffer;
}
