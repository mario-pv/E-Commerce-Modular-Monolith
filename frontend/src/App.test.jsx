// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import App from "./App";
import Observability from "./Observability";

const liveProducts = [
  {
    id: "FLASH_ITEM",
    name: "Live GPU",
    category: "Flagship GPUs",
    price: 99,
    stock: 2,
    isFlashDeal: true,
    description: "Database catalog",
    specs: ["GPU"],
    image: "",
    rating: 4.8,
  },
  {
    id: "KEYBOARD",
    name: "Live Keyboard",
    category: "Peripherals",
    price: 20,
    stock: 3,
    description: "Database keyboard",
    specs: [],
    image: "",
    rating: 4.5,
  },
];
let catalog;
let orders;
let notifications;
let postHandler;
const response = (data, ok = true) => ({
  ok,
  status: ok ? 200 : 409,
  json: async () => data,
});

beforeEach(() => {
  catalog = structuredClone(liveProducts);
  orders = [];
  notifications = [];
  postHandler = async () => response({ error: "Unexpected mutation" }, false);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options = {}) => {
      if (options.method === "POST")
        return postHandler(url, JSON.parse(options.body || "{}"));
      if (url === "/api/products") return response(catalog);
      if (url.startsWith("/api/orders?")) {
        const query = new URL(url, "http://localhost").searchParams;
        const page = Number(query.get("page"));
        const size = Number(query.get("size"));
        return {
          ...response(orders.slice(page * size, (page + 1) * size)),
          headers: new Headers({
            "X-Page": String(page), "X-Page-Size": String(size),
            "X-Has-More": String((page + 1) * size < orders.length),
          }),
        };
      }
      if (url === "/api/notifications") return response(notifications);
      return response([]);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const product = (name) => screen.getByRole("article", { name });
const mountLive = async () => {
  render(<App />);
  await screen.findByRole("heading", { name: "Live GPU" });
};

test("checks out the whole cart atomically and shows backend order confirmations", async () => {
  const user = userEvent.setup();
  const posted = [];
  postHandler = async (url, body) => {
    posted.push({ url, body });
    const result = body.items.map((item, i) => ({
      ...item,
      id: i + 1,
      orderNumber: `ORDER-${i + 1}`,
      status: "CREATED",
    }));
    catalog = catalog.map((p) => ({ ...p, stock: p.stock - 1 }));
    orders = result;
    return response(result);
  };
  await mountLive();
  await user.click(
    within(product("Live GPU")).getByRole("button", { name: "Add to Cart" }),
  );
  await user.click(
    within(product("Live Keyboard")).getByRole("button", {
      name: "Add to Cart",
    }),
  );
  await user.click(screen.getByRole("button", { name: /^Cart/ }));
  const cart = await screen.findByRole("dialog", { name: "Your cart" });
  expect(within(cart).getByText("$119.00")).toBeInTheDocument();
  expect(within(cart).queryByRole("textbox")).not.toBeInTheDocument();
  await user.click(
    within(cart).getByRole("button", { name: "Confirm checkout" }),
  );
  const confirmation = await screen.findByRole("dialog", {
    name: "Order confirmed",
  });
  expect(within(confirmation).getByText("ORDER-1")).toBeInTheDocument();
  expect(within(confirmation).getByText("ORDER-2")).toBeInTheDocument();
  expect(posted).toEqual([
    {
      url: "/api/orders/checkout",
      body: {
        items: [
          { productCode: "FLASH_ITEM", quantity: 1 },
          { productCode: "KEYBOARD", quantity: 1 },
        ],
        usePessimistic: true,
      },
    },
  ]);
  await user.click(
    within(confirmation).getByRole("button", { name: "Continue shopping" }),
  );
  expect(
    within(product("Live GPU")).getByText("1 in stock"),
  ).toBeInTheDocument();
});

test("observability reads persisted history and honestly labels backend notification simulations", async () => {
  const user = userEvent.setup();
  orders = [
    {
      id: 7,
      orderNumber: "SAVED-ORDER",
      productCode: "FLASH_ITEM",
      quantity: 1,
      status: "CREATED",
    },
  ];
  notifications = [
    {
      orderNumber: "SAVED-ORDER",
      productCode: "FLASH_ITEM",
      quantity: 1,
      status: "SIMULATED_DELIVERY",
      timestamp: "2026-11-06T16:00:00Z",
      processingTimeMs: 1001,
    },
  ];
  await mountLive();
  await user.click(screen.getByRole("button", { name: "Observability" }));
  const history = await screen.findByRole("region", { name: "Order history" });
  expect(await within(history).findByText("SAVED-ORDER")).toBeInTheDocument();
  const feed = screen.getByRole("region", { name: "Notification feed" });
  expect(await within(feed).findByText("SAVED-ORDER")).toBeInTheDocument();
  expect(within(feed).getByText(/Simulated delivery/)).toBeInTheDocument();
  expect(within(feed).getByText(/No email is sent/)).toBeInTheDocument();
  expect(within(feed).getByText("1001 ms")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/api/orders?page=0&size=20", expect.any(Object));
  expect(fetch).toHaveBeenCalledWith("/api/notifications", expect.any(Object));
  notifications = [
    { ...notifications[0], orderNumber: "LATER-EVENT" },
    ...notifications,
  ];
  await user.click(screen.getByRole("button", { name: "Refresh activity" }));
  expect(await within(feed).findByText("LATER-EVENT")).toBeInTheDocument();
});

test("architecture opens an accessible modal, traps focus, and restores its trigger on Escape", async () => {
  const user = userEvent.setup();
  await mountLive();
  const trigger = screen.getByRole("button", { name: "Architecture" });
  await user.click(trigger);
  const architecture = screen.getByRole("dialog", { name: "Architecture" });
  expect(
    within(architecture).getByRole("heading", { name: "Order" }),
  ).toBeInTheDocument();
  expect(
    within(architecture).getByRole("heading", { name: "Inventory" }),
  ).toBeInTheDocument();
  expect(
    within(architecture).getByRole("heading", { name: "Notification" }),
  ).toBeInTheDocument();
  expect(
    within(architecture).getByText(/event_publication/),
  ).toBeInTheDocument();
  await user.tab();
  expect(architecture).toContainElement(document.activeElement);
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test("rush launches ten real single-order requests and reports actual mixed responses", async () => {
  const user = userEvent.setup();
  const requests = [];
  const finish = [];
  postHandler = (url, body) =>
    new Promise((resolve) => {
      requests.push({ url, body });
      finish.push(resolve);
    });
  await mountLive();
  await user.click(
    screen.getByRole("button", { name: "Flash Rush Simulator" }),
  );
  const rush = screen.getByRole("dialog", { name: "Flash Rush Simulator" });
  expect(
    within(rush).getByText(/concurrent HTTP requests/),
  ).toBeInTheDocument();
  await user.click(
    within(rush).getByRole("button", { name: "Launch 10 requests" }),
  );
  expect(requests).toHaveLength(10);
  expect(
    requests.every(
      (r) =>
        r.url === "/api/orders" &&
        r.body.productCode === "FLASH_ITEM" &&
        r.body.quantity === 1 &&
        r.body.usePessimistic === true,
    ),
  ).toBe(true);
  expect(within(rush).getByRole("button", { name: "Running…" })).toBeDisabled();
  await user.keyboard("{Escape}");
  expect(rush).toBeInTheDocument();
  catalog[0].stock = 0;
  finish.forEach((resolve, i) =>
    resolve(
      i < 2
        ? response({
            id: i,
            orderNumber: `RUSH-${i}`,
            productCode: "FLASH_ITEM",
            quantity: 1,
            status: "CREATED",
          })
        : response({ error: "Insufficient stock" }, false),
    ),
  );
  expect(
    await within(rush).findByText("2 accepted · 8 not confirmed"),
  ).toBeInTheDocument();
  expect(within(rush).getByText("RUSH-0")).toBeInTheDocument();
  await user.click(
    within(rush).getByRole("button", { name: "Close Flash Rush Simulator" }),
  );
  expect(
    within(product("Live GPU")).getByRole("button", { name: "Sold Out" }),
  ).toBeDisabled();
});

test("restocks through the reset endpoint and reads the resulting catalog stock", async () => {
  const user = userEvent.setup();
  const posted = [];
  postHandler = async (url, body) => {
    posted.push({ url, body });
    catalog[0].stock = 10;
    return response(catalog);
  };
  await mountLive();
  await user.click(
    screen.getByRole("button", { name: "Restock demo inventory" }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Inventory reset confirmed by backend.",
  );
  expect(posted).toEqual([{ url: "/api/inventory/restock-all", body: {} }]);
  expect(
    within(product("Live GPU")).getByText("10 in stock"),
  ).toBeInTheDocument();
});

test("a lost checkout response keeps the cart and warns that the outcome is unknown", async () => {
  const user = userEvent.setup();
  postHandler = async () => {
    throw new TypeError("Failed to fetch");
  };
  await mountLive();
  await user.click(
    within(product("Live GPU")).getByRole("button", { name: "Add to Cart" }),
  );
  await user.click(screen.getByRole("button", { name: /^Cart/ }));
  await user.click(screen.getByRole("button", { name: "Confirm checkout" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /outcome is unknown.*order history before retrying/i,
  );
  expect(screen.getByRole("dialog", { name: "Your cart" })).toBeInTheDocument();
  expect(screen.getByLabelText("Quantity Live GPU")).toHaveTextContent("1");
  expect(
    screen.queryByRole("dialog", { name: "Order confirmed" }),
  ).not.toBeInTheDocument();
});

test("offline mode shows only preview metadata and never submits purchases or rushes", async () => {
  const user = userEvent.setup();
  fetch.mockRejectedValue(new TypeError("offline"));
  render(<App />);
  expect(
    await screen.findByText(/Backend offline — catalog preview only/),
  ).toBeInTheDocument();
  screen
    .getAllByRole("button", { name: "Add to Cart" })
    .forEach((button) => expect(button).toBeDisabled());
  expect(screen.getAllByRole("article")).toHaveLength(6);
  screen.getAllByRole("article").forEach((card) => {
    expect(within(card).getByText("Stock unavailable")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Simulate Concurrency Rush on this SKU" })).toBeDisabled();
    expect(within(card).getByRole("spinbutton")).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Buy" })).toBeDisabled();
  });
  expect(within(screen.getByRole("region", { name: "Featured flash sale" })).getByRole("button", { name: "Quick Add to Cart" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Flash Rush Simulator" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Restock demo inventory" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: /^Cart/ }));
  expect(screen.getByText(/Your cart is empty/)).toBeInTheDocument();
  expect(
    fetch.mock.calls.every(([, options]) => options.method !== "POST"),
  ).toBe(true);
});

test("quantity controls cap at live stock and remove the line when decreased to zero", async () => {
  const user = userEvent.setup();
  await mountLive();
  const add = within(product("Live GPU")).getByRole("button", {
    name: "Add to Cart",
  });
  await user.click(add);
  await user.click(add);
  await user.click(add);
  await user.click(screen.getByRole("button", { name: "Cart (2)" }));
  expect(screen.getByLabelText("Quantity Live GPU")).toHaveTextContent("2");
  expect(
    screen.getByRole("button", { name: "Increase Live GPU" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Decrease Live GPU" }));
  await user.click(screen.getByRole("button", { name: "Decrease Live GPU" }));
  expect(screen.getByText(/Your cart is empty/)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Confirm checkout" }),
  ).not.toBeInTheDocument();
});

test("failed atomic checkout preserves both cart lines and reflects fresh stock", async () => {
  const user = userEvent.setup();
  postHandler = async () => {
    catalog[0].stock = 0;
    return response({ error: "Insufficient stock" }, false);
  };
  await mountLive();
  await user.click(
    within(product("Live GPU")).getByRole("button", { name: "Add to Cart" }),
  );
  await user.click(
    within(product("Live Keyboard")).getByRole("button", {
      name: "Add to Cart",
    }),
  );
  await user.click(screen.getByRole("button", { name: /^Cart/ }));
  await user.click(screen.getByRole("button", { name: "Confirm checkout" }));
  expect(await screen.findByText("Insufficient stock")).toBeInTheDocument();
  expect(screen.getByLabelText("Quantity Live GPU")).toHaveTextContent("1");
  expect(screen.getByLabelText("Quantity Live Keyboard")).toHaveTextContent(
    "1",
  );
  expect(
    screen.getByRole("button", { name: "Confirm checkout" }),
  ).toBeDisabled();
  expect(screen.getByText(/Stock changed/)).toBeInTheDocument();
});

test("category filters and search show an explicit empty result", async () => {
  const user = userEvent.setup();
  await mountLive();
  await user.click(screen.getByRole("button", { name: "Peripherals" }));
  expect(
    screen.queryByRole("article", { name: "Live GPU" }),
  ).not.toBeInTheDocument();
  expect(product("Live Keyboard")).toBeInTheDocument();
  await user.type(
    screen.getByRole("textbox", { name: "Search products" }),
    "missing",
  );
  expect(
    screen.getByText("No products match your search."),
  ).toBeInTheDocument();
});

test("pending checkout cannot be duplicated or dismissed", async () => {
  const user = userEvent.setup();
  let finish;
  let calls = 0;
  postHandler = () =>
    new Promise((resolve) => {
      calls++;
      finish = resolve;
    });
  await mountLive();
  await user.click(
    within(product("Live GPU")).getByRole("button", { name: "Add to Cart" }),
  );
  await user.click(screen.getByRole("button", { name: /^Cart/ }));
  await user.dblClick(screen.getByRole("button", { name: "Confirm checkout" }));
  expect(calls).toBe(1);
  await user.keyboard("{Escape}");
  expect(screen.getByRole("dialog", { name: "Your cart" })).toBeInTheDocument();
  await act(async () =>
    finish(
      response([
        {
          orderNumber: "ONCE",
          productCode: "FLASH_ITEM",
          quantity: 1,
          status: "CREATED",
        },
      ]),
    ),
  );
  expect(
    await screen.findByRole("dialog", { name: "Order confirmed" }),
  ).toBeInTheDocument();
});

test("rush sends the explicitly selected optimistic mode without inventing retries", async () => {
  const user = userEvent.setup();
  const requests = [];
  postHandler = async (url, body) => {
    requests.push({ url, body });
    return response({ error: "Optimistic conflict" }, false);
  };
  await mountLive();
  await user.click(
    screen.getByRole("button", { name: "Flash Rush Simulator" }),
  );
  await user.click(
    screen.getByRole("radio", { name: "Optimistic" }),
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Target product" }),
    "KEYBOARD",
  );
  await user.click(screen.getByRole("button", { name: "Launch 10 requests" }));
  expect(
    await screen.findByText("0 accepted · 10 not confirmed"),
  ).toBeInTheDocument();
  expect(requests).toHaveLength(10);
  expect(
    requests.every(
      (r) =>
        r.body.usePessimistic === false && r.body.productCode === "KEYBOARD",
    ),
  ).toBe(true);
});

test("observability polls new backend events and stops polling after unmount", async () => {
  vi.useFakeTimers();
  let view;
  await act(async () => {
    view = render(<Observability connected />);
  });
  notifications = [
    {
      orderNumber: "POLL-EVENT",
      productCode: "FLASH_ITEM",
      quantity: 1,
      status: "RECEIVED_FROM_OUTBOX",
      timestamp: "2026-11-06T16:00:00Z",
      processingTimeMs: 0,
    },
  ];
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(screen.getByText("POLL-EVENT")).toBeInTheDocument();
  view.unmount();
  const requests = fetch.mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  expect(fetch.mock.calls).toHaveLength(requests);
});

test("history endpoint failure is visible while the independent notification feed remains usable", async () => {
  const user = userEvent.setup();
  const normal = fetch.getMockImplementation();
  fetch.mockImplementation((url, options) =>
    url.startsWith("/api/orders?")
      ? Promise.resolve(response({ error: "Unavailable" }, false))
      : normal(url, options),
  );
  notifications = [
    {
      orderNumber: "FEED-ONLY",
      productCode: "FLASH_ITEM",
      quantity: 1,
      status: "SIMULATED_DELIVERY",
      timestamp: "2026-11-06T16:00:00Z",
      processingTimeMs: 1000,
    },
  ];
  await mountLive();
  await user.click(screen.getByRole("button", { name: "Observability" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Order history unavailable",
  );
  expect(screen.getByText("FEED-ONLY")).toBeInTheDocument();
  expect(screen.queryByText("No orders yet.")).not.toBeInTheDocument();
});

test("Buy reviews only the selected quantity and preserves unrelated cart items", async () => {
  const user = userEvent.setup();
  const posted = [];
  postHandler = async (url, body) => {
    posted.push({ url, body });
    return response(body.items.map((item) => ({ ...item, orderNumber: "DIRECT-ORDER" })));
  };
  await mountLive();
  await user.click(within(product("Live Keyboard")).getByRole("button", { name: "Add to Cart" }));
  const gpu = within(product("Live GPU"));
  const quantity = gpu.getByRole("spinbutton", { name: "Units to add for Live GPU" });
  await user.clear(quantity);
  await user.type(quantity, "2");
  await user.click(gpu.getByRole("button", { name: "Buy" }));
  const review = within(screen.getByRole("dialog", { name: "Review purchase" }));
  expect(review.getByText("Live GPU", { selector: "p" })).toBeInTheDocument();
  expect(review.getByLabelText("Quantity Live GPU")).toHaveTextContent("2");
  expect(review.queryByText("Live Keyboard")).not.toBeInTheDocument();
  expect(review.getByText(/Your existing cart is not included/)).toBeInTheDocument();
  expect(posted).toHaveLength(0);
  await user.click(review.getByRole("button", { name: "Confirm checkout" }));
  expect(await screen.findByText("DIRECT-ORDER")).toBeInTheDocument();
  expect(posted).toEqual([{ url: "/api/orders/checkout", body: {
    items: [{ productCode: "FLASH_ITEM", quantity: 2 }], usePessimistic: true,
  } }]);
  await user.click(screen.getByRole("button", { name: "Continue shopping" }));
  await user.click(screen.getByRole("button", { name: "Cart (1)" }));
  const cart = within(screen.getByRole("dialog", { name: "Your cart" }));
  expect(cart.getByText("Live Keyboard", { selector: "p" })).toBeInTheDocument();
  expect(cart.queryByText("Live GPU")).not.toBeInTheDocument();
});

test("cancelling Buy neither places an order nor changes the existing cart", async () => {
  const user = userEvent.setup();
  await mountLive();
  await user.click(within(product("Live Keyboard")).getByRole("button", { name: "Add to Cart" }));
  await user.click(within(product("Live GPU")).getByRole("button", { name: "Buy" }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cart (1)" })).toBeInTheDocument();
  expect(fetch.mock.calls.every(([, options]) => options.method !== "POST")).toBe(true);
});

test("Buy failure retains its review and never confirms or empties the cart", async () => {
  const user = userEvent.setup();
  postHandler = async () => response({ error: "Insufficient stock" }, false);
  await mountLive();
  await user.click(within(product("Live Keyboard")).getByRole("button", { name: "Add to Cart" }));
  await user.click(within(product("Live GPU")).getByRole("button", { name: "Buy" }));
  await user.click(screen.getByRole("button", { name: "Confirm checkout" }));
  expect(await screen.findByText("Insufficient stock")).toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "Review purchase" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "Order confirmed" })).not.toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("button", { name: "Cart (1)" })).toBeInTheDocument();
});

test("featured flash sale uses live prices, stock and shortcuts instead of a countdown", async () => {
  const user = userEvent.setup();
  catalog[0].originalPrice = 125;
  await mountLive();
  const featured = within(screen.getByRole("region", { name: "Featured flash sale" }));
  expect(featured.getByText("#FLASH_ITEM")).toBeInTheDocument();
  expect(featured.getByText("Live GPU")).toBeInTheDocument();
  expect(featured.getByText("$125.00").tagName).toBe("DEL");
  expect(featured.getByText("$99.00")).toBeInTheDocument();
  expect(featured.getByText("2 in stock")).toBeInTheDocument();
  expect(screen.queryByText(/sale ends|guaranteed/i)).not.toBeInTheDocument();
  await user.click(featured.getByRole("button", { name: "Quick Add to Cart" }));
  expect(screen.getByRole("button", { name: "Cart (1)" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Configure Flash Rush" }));
  expect(screen.getByRole("combobox", { name: "Target product" })).toHaveValue("FLASH_ITEM");
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "View Bounded Contexts" }));
  expect(screen.getByRole("dialog", { name: "Architecture" })).toBeInTheDocument();
});

test("product-specific rush targets the selected SKU and sold-out products cannot launch", async () => {
  const user = userEvent.setup();
  catalog[0].stock = 0;
  await mountLive();
  expect(within(product("Live GPU")).getByRole("button", { name: "Simulate Concurrency Rush on this SKU" })).toBeDisabled();
  expect(within(product("Live GPU")).getByRole("button", { name: "Buy" })).toBeDisabled();
  await user.click(within(product("Live Keyboard")).getByRole("button", { name: "Simulate Concurrency Rush on this SKU" }));
  expect(screen.getByRole("combobox", { name: "Target product" })).toHaveValue("KEYBOARD");
  await user.selectOptions(screen.getByRole("combobox", { name: "Target product" }), "FLASH_ITEM");
  expect(screen.getByRole("button", { name: "Launch 10 requests" })).toBeDisabled();
});

test.each([
  [5, "Optimistic", false], [10, "Optimistic", false], [20, "Optimistic", false],
  [5, "Pessimistic", true], [10, "Pessimistic", true], [20, "Pessimistic", true],
])("rush submits exactly %s requests in %s mode with chosen units, without stock clamping", async (count, mode, usePessimistic) => {
  const user = userEvent.setup();
  const requests = [];
  const finish = [];
  postHandler = (url, body) => new Promise((resolve) => { requests.push({ url, body }); finish.push(resolve); });
  await mountLive();
  await user.click(screen.getByRole("button", { name: "Flash Rush Simulator" }));
  const rush = within(screen.getByRole("dialog", { name: "Flash Rush Simulator" }));
  await user.click(rush.getByRole("radio", { name: mode, exact: true }));
  await user.click(rush.getByRole("radio", { name: `${count} requests`, exact: true }));
  const units = rush.getByRole("spinbutton", { name: "Units per request" });
  await user.clear(units);
  await user.type(units, "7");
  expect(rush.getByText(`Estimated total requested units: ${count * 7}`)).toBeInTheDocument();
  await user.click(rush.getByRole("button", { name: `Launch ${count} requests` }));
  expect(requests).toEqual(Array.from({ length: count }, () => ({ url: "/api/orders", body: {
    productCode: "FLASH_ITEM", quantity: 7, usePessimistic,
  } })));
  rush.getAllByRole("radio").forEach((control) => expect(control).toBeDisabled());
  expect(rush.getByRole("combobox", { name: "Target product" })).toBeDisabled();
  expect(units).toBeDisabled();
  await act(async () => finish.forEach((resolve) => resolve(response({ error: "Insufficient stock" }, false))));
  expect(await rush.findByText(`0 accepted · ${count} not confirmed`)).toBeInTheDocument();
  expect(rush.getAllByText("Insufficient stock")).toHaveLength(count);
});

test.each(["0", "-1", "1.5", "101", "9007199254740992", ""])("rush rejects invalid units %s without sending requests", async (value) => {
  const user = userEvent.setup();
  await mountLive();
  await user.click(screen.getByRole("button", { name: "Flash Rush Simulator" }));
  const rush = within(screen.getByRole("dialog", { name: "Flash Rush Simulator" }));
  const units = rush.getByRole("spinbutton", { name: "Units per request" });
  await user.clear(units);
  if (value) await user.type(units, value);
  expect(units).toHaveAttribute("aria-invalid", "true");
  expect(rush.getByRole("button", { name: "Launch 10 requests" })).toBeDisabled();
  expect(rush.queryByText(/Estimated total requested units: [0-9]/)).not.toBeInTheDocument();
  expect(fetch.mock.calls.every(([, options]) => options.method !== "POST")).toBe(true);
});

test("adds chosen quantities and rejects the whole addition above the existing-cart stock cap", async () => {
  const user = userEvent.setup();
  catalog[0].stock = 5;
  const posted = [];
  postHandler = async (url, body) => {
    posted.push({ url, body });
    return response(body.items.map((item) => ({ ...item, orderNumber: "QUANTITY-ORDER" })));
  };
  await mountLive();
  const gpu = within(product("Live GPU"));
  const quantity = gpu.getByRole("spinbutton", { name: "Units to add for Live GPU" });
  await user.clear(quantity);
  await user.type(quantity, "3");
  await user.click(gpu.getByRole("button", { name: "Add to Cart" }));
  expect(screen.getByRole("button", { name: "Cart (3)" })).toBeInTheDocument();
  expect(gpu.getByRole("button", { name: "Add to Cart" })).toBeDisabled();
  expect(gpu.getByText(/Only 2 more units available.*Nothing added/)).toBeInTheDocument();
  await user.click(gpu.getByRole("button", { name: "Add to Cart" }));
  expect(screen.getByRole("button", { name: "Cart (3)" })).toBeInTheDocument();
  await user.clear(quantity);
  await user.type(quantity, "2");
  await user.click(gpu.getByRole("button", { name: "Add to Cart" }));
  await user.click(screen.getByRole("button", { name: "Cart (5)" }));
  await user.click(screen.getByRole("button", { name: "Confirm checkout" }));
  await screen.findByRole("dialog", { name: "Order confirmed" });
  expect(posted).toEqual([{ url: "/api/orders/checkout", body: {
    items: [{ productCode: "FLASH_ITEM", quantity: 5 }], usePessimistic: true,
  } }]);
});

test.each(["0", "-1", "1.5", "9007199254740992", ""])("rejects invalid catalog quantity %s without adding units", async (value) => {
  const user = userEvent.setup();
  await mountLive();
  const gpu = within(product("Live GPU"));
  const quantity = gpu.getByRole("spinbutton", { name: "Units to add for Live GPU" });
  await user.clear(quantity);
  if (value) await user.type(quantity, value);
  expect(quantity).toHaveAttribute("aria-invalid", "true");
  expect(gpu.getByRole("alert")).toHaveTextContent(/positive whole number/);
  expect(gpu.getByRole("button", { name: "Buy" })).toBeDisabled();
  expect(gpu.getByRole("button", { name: "Add to Cart" })).toBeDisabled();
  await user.click(gpu.getByRole("button", { name: "Add to Cart" }));
  expect(screen.getByRole("button", { name: "Cart (0)" })).toBeInTheDocument();
});

test("sale pricing derives the struck-through original and savings from the live catalog", async () => {
  catalog[0].originalPrice = 125;
  await mountLive();
  const gpu = within(product("Live GPU"));
  expect(gpu.getByText("$125.00").tagName).toBe("DEL");
  expect(gpu.getByText("$99.00")).toBeInTheDocument();
  expect(gpu.getByText("Save $26.00 (21%)")).toBeInTheDocument();
  expect(product("Live Keyboard").querySelector("del")).toBeNull();
  expect(screen.queryByText("20% OFF")).not.toBeInTheDocument();
});

test.each([20, 10, null])("does not invent a discount for original price %s", async (originalPrice) => {
  catalog[1].originalPrice = originalPrice;
  await mountLive();
  expect(product("Live Keyboard").querySelector("del")).toBeNull();
  expect(within(product("Live Keyboard")).queryByText(/Save/)).not.toBeInTheDocument();
});

test("loads live product metadata and stock from the catalog endpoint", async () => {
  await mountLive();
  expect(
    within(product("Live GPU")).getByText("2 in stock"),
  ).toBeInTheDocument();
  expect(within(product("Live GPU")).getByText("$99.00")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/api/products", expect.any(Object));
  expect(screen.queryByText(/Quantum RTX/)).not.toBeInTheDocument();
});
