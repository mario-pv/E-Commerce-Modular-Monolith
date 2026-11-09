// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { fetchOrders } from "./client";

const order = { id: 42, orderNumber: "SAVED", productCode: "FLASH_ITEM", quantity: 1, status: "CREATED" };
const response = (headers) => ({
  ok: true,
  status: 200,
  headers: new Headers(headers),
  json: async () => [order],
});

afterEach(() => vi.unstubAllGlobals());

test.each([
  {},
  { "X-Page": "0", "X-Page-Size": "20" },
  { "X-Page": "0", "X-Page-Size": "20", "X-Has-More": "maybe" },
  { "X-Page": "1", "X-Page-Size": "20", "X-Has-More": "false" },
  { "X-Page": "0", "X-Page-Size": "100", "X-Has-More": "false" },
  { "X-Page": "not-a-page", "X-Page-Size": "20", "X-Has-More": "false" },
])("rejects missing, malformed or mismatched metadata instead of silently hiding older history: %j", async (headers) => {
  vi.stubGlobal("fetch", vi.fn(async () => response(headers)));
  await expect(fetchOrders()).rejects.toThrow("Invalid order history pagination response");
});

test("defaults to the first twenty orders and reads a final-page flag", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => response({
    "X-Page": "0", "X-Page-Size": "20", "X-Has-More": "false",
  })));
  await expect(fetchOrders()).resolves.toMatchObject({ page: 0, size: 20, hasMore: false });
  expect(fetch).toHaveBeenCalledWith("/api/orders?page=0&size=20", expect.any(Object));
});

test("reads array-compatible order history and explicit page metadata from headers", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => response({
    "X-Page": "2", "X-Page-Size": "10", "X-Has-More": "true",
  })));
  await expect(fetchOrders(2, 10)).resolves.toEqual({
    orders: [order], page: 2, size: 10, hasMore: true,
  });
  expect(fetch).toHaveBeenCalledWith("/api/orders?page=2&size=10", expect.any(Object));
});
