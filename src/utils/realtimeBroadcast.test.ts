import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type BroadcastHandler = (payload?: unknown) => void;
type StatusHandler = (status: string) => void;

type FakeChannel = {
  topic: string;
  options: unknown;
  event: string | null;
  broadcast: BroadcastHandler | null;
  status: StatusHandler | null;
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
};

const setAuth = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const removeChannel = vi.hoisted(() => vi.fn(() => Promise.resolve("ok" as const)));
const channel = vi.hoisted(() => vi.fn());

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    channel,
    removeChannel,
    realtime: { setAuth },
  },
  supabaseUrl: "https://example.supabase.co",
}));

import {
  subscribeToAdminSubmissions,
  subscribeToSeasonState,
} from "../../services/supabase";

const created: FakeChannel[] = [];

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  created.length = 0;
  vi.useFakeTimers();
  setAuth.mockReset();
  setAuth.mockImplementation(() => Promise.resolve());
  removeChannel.mockReset();
  removeChannel.mockImplementation(() => Promise.resolve("ok"));
  channel.mockReset();
  channel.mockImplementation((topic: string, options: unknown) => {
    const fake: FakeChannel = {
      topic,
      options,
      event: null,
      broadcast: null,
      status: null,
      on: vi.fn(),
      subscribe: vi.fn(),
    };
    fake.on.mockImplementation(
      (_type: string, filter: { event: string }, handler: BroadcastHandler) => {
        fake.event = filter.event;
        fake.broadcast = handler;
        return fake;
      }
    );
    fake.subscribe.mockImplementation((handler: StatusHandler) => {
      fake.status = handler;
      return fake;
    });
    created.push(fake);
    return fake;
  });
});

afterEach(async () => {
  await vi.runAllTimersAsync();
  vi.useRealTimers();
});

describe("subscribeToSeasonState", () => {
  it("subscribes to the public season topic and ignores the payload", async () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToSeasonState(" traitors-new-blood-s1 ", onChange);

    expect(setAuth).not.toHaveBeenCalled();
    expect(created).toHaveLength(1);
    expect(created[0].topic).toBe("season:traitors-new-blood-s1:state");
    expect(created[0].options).toEqual({ config: { private: false } });
    expect(created[0].event).toBe("season_state_changed");

    created[0].broadcast?.({ payload: { email: "secret@example.com", picks: ["A"] } });
    await vi.advanceTimersByTimeAsync(299);
    expect(onChange).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]).toEqual([]);

    unsubscribe();
  });

  it("coalesces a burst of signals into one refresh", async () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToSeasonState("traitors-new-blood-s1", onChange);

    created[0].broadcast?.({ payload: { email: "one@example.com" } });
    await vi.advanceTimersByTimeAsync(100);
    created[0].broadcast?.({ payload: { email: "two@example.com" } });
    await vi.advanceTimersByTimeAsync(299);
    expect(onChange).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("does not refresh when the subscription fails", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToSeasonState("traitors-new-blood-s1", onChange);

    created[0].status?.("CHANNEL_ERROR");
    created[0].status?.("TIMED_OUT");
    expect(onChange).not.toHaveBeenCalled();

    unsubscribe();
  });

  it("reuses one channel across a strict-mode resubscribe and removes it on unmount", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeToSeasonState("traitors-new-blood-s1", first);
    unsubscribeFirst();
    const unsubscribeSecond = subscribeToSeasonState("traitors-new-blood-s1", second);

    expect(channel).toHaveBeenCalledTimes(1);
    created[0].broadcast?.();
    await vi.advanceTimersByTimeAsync(300);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(removeChannel).not.toHaveBeenCalled();

    unsubscribeSecond();
    await vi.advanceTimersByTimeAsync(0);
    expect(removeChannel).toHaveBeenCalledTimes(1);
    expect(removeChannel).toHaveBeenCalledWith(created[0]);
  });

  it("waits for an in-flight removal before opening the topic again", async () => {
    let resolveRemoval: (value: "ok") => void = () => {};
    removeChannel.mockImplementation(
      () =>
        new Promise<"ok">((resolve) => {
          resolveRemoval = resolve;
        })
    );

    const unsubscribe = subscribeToSeasonState("traitors-new-blood-s1", vi.fn());
    unsubscribe();
    await vi.advanceTimersByTimeAsync(0);
    expect(removeChannel).toHaveBeenCalledTimes(1);

    const resubscribe = subscribeToSeasonState("traitors-new-blood-s1", vi.fn());
    await flushMicrotasks();
    expect(channel).toHaveBeenCalledTimes(1);

    resolveRemoval("ok");
    await flushMicrotasks();
    expect(channel).toHaveBeenCalledTimes(2);
    expect(created[1].topic).toBe("season:traitors-new-blood-s1:state");
    expect(created[1].options).toEqual({ config: { private: false } });

    removeChannel.mockImplementation(() => Promise.resolve("ok"));
    resubscribe();
  });

  it("does not open a channel when the season id is blank", () => {
    const unsubscribe = subscribeToSeasonState("   ", vi.fn());
    expect(channel).not.toHaveBeenCalled();
    expect(setAuth).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("shares one channel between listeners and keeps it until the last one leaves", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeToSeasonState("traitors-new-blood-s1", first);
    const unsubscribeSecond = subscribeToSeasonState("traitors-new-blood-s1", second);

    expect(channel).toHaveBeenCalledTimes(1);
    created[0].broadcast?.();
    await vi.advanceTimersByTimeAsync(300);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    await vi.advanceTimersByTimeAsync(0);
    expect(removeChannel).not.toHaveBeenCalled();

    unsubscribeSecond();
    await vi.advanceTimersByTimeAsync(0);
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });
});

describe("subscribeToAdminSubmissions", () => {
  it("sets the session auth before joining the private admin topic", async () => {
    const order: string[] = [];
    setAuth.mockImplementation(() => {
      order.push("auth");
      return Promise.resolve();
    });
    channel.mockImplementation((topic: string, options: unknown) => {
      order.push("channel");
      const fake: FakeChannel = {
        topic,
        options,
        event: null,
        broadcast: null,
        status: null,
        on: vi.fn(),
        subscribe: vi.fn(),
      };
      fake.on.mockImplementation(
        (_type: string, filter: { event: string }, handler: BroadcastHandler) => {
          fake.event = filter.event;
          fake.broadcast = handler;
          return fake;
        }
      );
      fake.subscribe.mockImplementation((handler: StatusHandler) => {
        fake.status = handler;
        return fake;
      });
      created.push(fake);
      return fake;
    });

    const onChange = vi.fn();
    const unsubscribe = subscribeToAdminSubmissions(onChange);
    expect(order).toEqual(["auth"]);
    expect(channel).not.toHaveBeenCalled();

    await flushMicrotasks();
    expect(order).toEqual(["auth", "channel"]);
    expect(created[0].topic).toBe("admin:submissions");
    expect(created[0].options).toEqual({ config: { private: true } });
    expect(created[0].event).toBe("submission_changed");

    created[0].broadcast?.({ payload: { email: "secret@example.com" } });
    await vi.advanceTimersByTimeAsync(300);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]).toEqual([]);

    unsubscribe();
  });

  it("still subscribes when setAuth fails, without forwarding the error", async () => {
    setAuth.mockImplementation(() => Promise.reject(new Error("access-token-secret")));
    const onChange = vi.fn();
    const unsubscribe = subscribeToAdminSubmissions(onChange);

    await flushMicrotasks();
    expect(channel).toHaveBeenCalledTimes(1);
    expect(created[0].options).toEqual({ config: { private: true } });
    expect(onChange).not.toHaveBeenCalled();

    unsubscribe();
  });

  it("opens one private channel when subscribe is cancelled and restored in the same turn", async () => {
    const unsubscribeFirst = subscribeToAdminSubmissions(vi.fn());
    unsubscribeFirst();
    const unsubscribeSecond = subscribeToAdminSubmissions(vi.fn());

    await flushMicrotasks();
    expect(setAuth).toHaveBeenCalledTimes(1);
    expect(channel).toHaveBeenCalledTimes(1);
    expect(created[0].options).toEqual({ config: { private: true } });

    unsubscribeSecond();
    await vi.advanceTimersByTimeAsync(0);
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it("does not refresh on CHANNEL_ERROR or TIMED_OUT", async () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToAdminSubmissions(onChange);
    await flushMicrotasks();

    created[0].status?.("CHANNEL_ERROR");
    created[0].status?.("TIMED_OUT");
    await vi.advanceTimersByTimeAsync(300);
    expect(onChange).not.toHaveBeenCalled();

    unsubscribe();
  });
});
