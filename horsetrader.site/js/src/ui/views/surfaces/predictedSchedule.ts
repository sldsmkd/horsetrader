/**
 * A local, deliberately unofficial release-schedule poster. It is drawn from the
 * same next-month predictions the planner already reads; nothing is fetched and
 * confirmed entries are never presented as a Horsetrader prediction.
 */

import type { CalendarDate } from "../../../core/projection/dates.ts";
import type { Bundle, EventRecord } from "../../bundle/access.ts";

const WIDTH = 1200;
const HEADER_HEIGHT = 250;
const ROW_HEIGHT = 355;
const PADDING = 52;
const CARD_INSET = 16;
const BANNER_HEIGHT = 252;
const FORECASTER_ID = "char-matikanefukukitaru";
// Release schedules advertise content drops, not the recurring mission cadence
// which happens to be predicted by the same timeline.
const SCHEDULE_TYPES = new Set(["trainee", "support", "scenario", "story", "mainstory", "cm", "legendrace", "holiday", "anniversary"]);

export interface PredictedSchedule {
  month: string;
  year: number;
  events: readonly EventRecord[];
  forecasterImage: string | null;
}

function monthAfter(date: CalendarDate): { year: number; month: number } {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/** The next calendar month, rather than a rolling thirty-day projection. */
export function predictedSchedule(bundle: Bundle, today: CalendarDate): PredictedSchedule {
  const { year, month } = monthAfter(today);
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const events = bundle.all().filter((event) => event.predicted && SCHEDULE_TYPES.has(event.type) && event.start.startsWith(prefix));
  return {
    month: new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1))),
    year,
    events,
    forecasterImage: bundle.character(FORECASTER_ID).icon,
  };
}

function label(event: EventRecord): string {
  if (event.type === "trainee") return "New Trainee Cards";
  if (event.type === "support") return "New Support Cards";
  if (event.type === "cm") return `Champions Meeting${event.name ? `: ${event.name}` : ""}`;
  if (event.type === "story" || event.type === "mainstory") return event.title ?? "Story Event";
  if (event.type === "scenario") return event.title ?? "New Scenario";
  if ("name" in event && event.name) return event.name;
  return event.type.replaceAll(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

function imageUrl(event: EventRecord): string | null {
  // Story/event thumbnails are deliberately tiny; the schedule wants the wide
  // marketing banner whenever the bake has one.
  if ("banner" in event && typeof event.banner === "string" && event.banner) return event.banner;
  if ("image" in event && typeof event.image === "string" && event.image) return event.image;
  return null;
}

function range(event: EventRecord): string {
  const start = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${event.start}T00:00:00Z`));
  const end = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${event.end}T00:00:00Z`));
  return `${start} – ${end} UTC`;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}

function drawContainedImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number): void {
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.drawImage(image, x + (w - width) / 2, y + (h - height) / 2, width, height);
}

function clippedText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let text = value;
  while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  return `${text.trimEnd()}…`;
}

/** Render to a Blob so the caller can download without involving a server. */
export async function renderPredictedSchedule(schedule: PredictedSchedule): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEADER_HEIGHT + Math.max(1, schedule.events.length) * ROW_HEIGHT + PADDING;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser cannot render a schedule preview.");
  const forecaster = schedule.forecasterImage ? await loadImage(schedule.forecasterImage) : null;

  const backdrop = ctx.createLinearGradient(0, 0, WIDTH, canvas.height);
  backdrop.addColorStop(0, "#d8fff0");
  backdrop.addColorStop(0.45, "#fffdf3");
  backdrop.addColorStop(1, "#e8e1ff");
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, WIDTH, canvas.height);
  ctx.fillStyle = "#1d945e";
  ctx.fillRect(0, 0, WIDTH, 18);
  ctx.fillStyle = "#27432f";
  ctx.font = "700 38px system-ui, sans-serif";
  ctx.fillText("Horsetrader", PADDING, 76);
  ctx.fillStyle = "#173a27";
  ctx.font = "800 64px system-ui, sans-serif";
  ctx.fillText(`${schedule.month} ${schedule.year}`, PADDING, 145);
  ctx.font = "800 50px system-ui, sans-serif";
  ctx.fillText("Predicted Schedule", PADDING, 205);
  ctx.fillStyle = "#5d6d63";
  ctx.font = "500 24px system-ui, sans-serif";
  ctx.fillText("Unofficial forecast generated from Horsetrader's current model", PADDING, 233);
  if (forecaster) {
    const size = 194;
    const x = WIDTH - PADDING - size;
    const y = 30;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(forecaster, x, y, size, size);
    ctx.restore();
  }

  if (schedule.events.length === 0) {
    ctx.fillStyle = "#173a27";
    ctx.font = "700 34px system-ui, sans-serif";
    ctx.fillText("No next-month predictions are available yet.", PADDING, HEADER_HEIGHT + 90);
  }

  for (const [index, event] of schedule.events.entries()) {
    const y = HEADER_HEIGHT + index * ROW_HEIGHT;
    const cardX = PADDING;
    const cardWidth = WIDTH - PADDING * 2;
    const imageX = cardX + CARD_INSET;
    const imageY = y + CARD_INSET;
    const imageWidth = cardWidth - CARD_INSET * 2;
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    roundedRect(ctx, cardX, y, cardWidth, ROW_HEIGHT - 28, 20);
    const source = imageUrl(event);
    const image = source ? await loadImage(source) : null;
    if (image) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(imageX, imageY, imageWidth, BANNER_HEIGHT, 14);
      ctx.clip();
      drawContainedImage(ctx, image, imageX, imageY, imageWidth, BANNER_HEIGHT);
      ctx.restore();
    } else {
      ctx.fillStyle = "#b6e9cf";
      roundedRect(ctx, imageX, imageY, imageWidth, BANNER_HEIGHT, 14);
      ctx.fillStyle = "#287a57";
      ctx.font = "800 28px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(event.type.toUpperCase(), WIDTH / 2, imageY + BANNER_HEIGHT / 2 + 10);
      ctx.textAlign = "left";
    }
    const dates = range(event);
    ctx.font = "700 25px system-ui, sans-serif";
    const datesWidth = ctx.measureText(dates).width;
    const footerY = imageY + BANNER_HEIGHT + 43;
    const footerLeft = imageX + 10;
    const footerRight = imageX + imageWidth - 10;
    ctx.fillStyle = "#168451";
    ctx.textAlign = "right";
    ctx.fillText(dates, footerRight, footerY);
    ctx.fillStyle = "#183b29";
    ctx.font = "800 29px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(clippedText(ctx, label(event), imageWidth - datesWidth - 48), footerLeft, footerY);
  }

  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not encode schedule PNG.")), "image/png"));
}

export async function downloadPredictedSchedule(bundle: Bundle, today: CalendarDate): Promise<void> {
  const schedule = predictedSchedule(bundle, today);
  const blob = await renderPredictedSchedule(schedule);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `horsetrader-${schedule.year}-${String(monthAfter(today).month).padStart(2, "0")}-predicted-schedule.png`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
}
