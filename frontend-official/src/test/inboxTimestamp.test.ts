import { describe, expect, it } from "vitest";
import { formatConversationTimestamp } from "@/pages/Inbox/utils";

describe("formatConversationTimestamp", () => {
  it("formats messages from today with time HH:mm", () => {
    const now = new Date();
    const timeToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 27).toISOString();
    const result = formatConversationTimestamp(timeToday);
    expect(result).toMatch(/^\d{2}:\d{2}$/);
    expect(result).toBe(new Date(timeToday).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  });

  it("formats messages from yesterday as 'Ontem'", () => {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 15, 30).toISOString();
    expect(formatConversationTimestamp(yesterday)).toBe("Ontem");
  });

  it("formats messages from 2 to 6 days ago as weekday name without confusing with today", () => {
    const now = new Date();
    const threeDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3, 14, 0).toISOString();
    const result = formatConversationTimestamp(threeDaysAgo);
    const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    expect(weekdays).toContain(result);
  });

  it("formats messages from 7 or more days ago as date DD/MM or DD/MM/YYYY and never repeats today's weekday", () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 10, 0).toISOString();
    const result = formatConversationTimestamp(sevenDaysAgo);
    const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    expect(weekdays).not.toContain(result);
    expect(result).toMatch(/^\d{2}\/\d{2}/);
  });

  it("handles numeric timestamps in milliseconds or seconds", () => {
    const now = Date.now();
    const result = formatConversationTimestamp(now);
    expect(result).toMatch(/^\d{2}:\d{2}$/);

    const seconds = Math.floor(now / 1000);
    const resultSec = formatConversationTimestamp(seconds);
    expect(resultSec).toMatch(/^\d{2}:\d{2}$/);
  });
});
