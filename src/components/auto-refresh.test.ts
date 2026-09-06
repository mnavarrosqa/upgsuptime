import { afterEach, expect, it, vi } from "vitest";

const { refresh, effects } = vi.hoisted(() => ({
  refresh: vi.fn(),
  effects: [] as (() => (() => void))[],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("react", () => ({ useEffect: (effect: () => (() => void)) => effects.push(effect) }));
import { AutoRefresh } from "./auto-refresh";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  refresh.mockClear();
  effects.length = 0;
});

it("pauses hidden refreshes, refreshes on return, and cleans up", () => {
  vi.useFakeTimers();
  const document = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("document", document);
  AutoRefresh({});
  const cleanup = effects[0]();
  expect(refresh).not.toHaveBeenCalled();
  vi.advanceTimersByTime(60_000);
  expect(refresh).toHaveBeenCalledTimes(2);
  document.visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  vi.advanceTimersByTime(300_000);
  expect(refresh).toHaveBeenCalledTimes(2);
  document.visibilityState = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  expect(refresh).toHaveBeenCalledTimes(3);
  vi.advanceTimersByTime(30_000);
  expect(refresh).toHaveBeenCalledTimes(4);
  cleanup();
  document.dispatchEvent(new Event("visibilitychange"));
  vi.advanceTimersByTime(60_000);
  expect(refresh).toHaveBeenCalledTimes(4);
});
