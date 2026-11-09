// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import Observability from "./Observability";

const order = (id) => ({ id, orderNumber: `ORDER-${id}`, productCode: "FLASH_ITEM", quantity: 1, status: "CREATED" });
const pages = [Array.from({ length: 20 }, (_, index) => order(25 - index)),
  Array.from({ length: 5 }, (_, index) => order(5 - index))];
const response = (orders, page, hasMore = false) => ({
  ok: true,
  status: 200,
  headers: new Headers({ "X-Page": String(page), "X-Page-Size": "20", "X-Has-More": String(hasMore) }),
  json: async () => orders,
});
let historyRequest;
beforeEach(() => {
  historyRequest = async (page) => response(pages[page] || [], page, page === 0);
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    const path = new URL(url, "http://localhost");
    if (path.pathname === "/api/orders") return historyRequest(Number(path.searchParams.get("page")));
    return { ok: true, json: async () => [] };
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const history = () => within(screen.getByRole("region", { name: "Order history" }));

test("a failed older page does not label the pending newer page as failed", async () => {
  const user = userEvent.setup();
  render(<Observability connected />);
  await history().findByText("ORDER-25");
  historyRequest = async () => { throw new Error("offline"); };
  await user.click(history().getByRole("button", { name: "Next" }));
  await history().findByRole("alert");
  let finish;
  historyRequest = () => new Promise((resolve) => { finish = resolve; });
  await user.click(history().getByRole("button", { name: "Previous" }));
  expect(history().getByText("Page 1")).toBeInTheDocument();
  expect(history().queryByRole("alert")).not.toBeInTheDocument();
  expect(history().getByText("Loading order history…")).toBeInTheDocument();
  await act(async () => finish(response(pages[0], 0, true)));
});

test("failed page navigation can be retried without mislabeling older snapshots", async () => {
  const user = userEvent.setup();
  render(<Observability connected />);
  await history().findByText("ORDER-25");
  historyRequest = async () => { throw new Error("offline"); };
  await user.click(history().getByRole("button", { name: "Next" }));
  expect(await history().findByRole("alert")).toHaveTextContent("Order history unavailable");
  expect(history().getByText("Page 2")).toBeInTheDocument();
  expect(history().queryByText("ORDER-25")).not.toBeInTheDocument();
  expect(history().getByRole("button", { name: "Previous" })).toBeEnabled();
  expect(history().getByRole("button", { name: "Next" })).toBeDisabled();
  historyRequest = async (page) => response(pages[page], page);
  await user.click(screen.getByRole("button", { name: "Refresh activity" }));
  expect(await history().findByText("ORDER-1")).toBeInTheDocument();
  expect(history().queryByRole("alert")).not.toBeInTheDocument();
  historyRequest = async () => { throw new Error("offline"); };
  await user.click(screen.getByRole("button", { name: "Refresh activity" }));
  expect(await history().findByRole("alert")).toHaveTextContent("last successful refresh");
  expect(history().getByText("ORDER-1")).toBeInTheDocument();
  expect(history().getByText("Page 2")).toBeInTheDocument();
});

test("an empty older page stays navigable back to newer history", async () => {
  const user = userEvent.setup();
  render(<Observability connected />);
  await history().findByText("ORDER-25");
  historyRequest = async (page) => response([], page);
  await user.click(history().getByRole("button", { name: "Next" }));
  expect(await history().findByText("No orders on this page.")).toBeInTheDocument();
  expect(history().getByText("Page 2")).toBeInTheDocument();
  expect(history().getByRole("button", { name: "Previous" })).toBeEnabled();
  expect(history().getByRole("button", { name: "Next" })).toBeDisabled();
});

test("polls the selected older page without overlapping requests and stops after unmount", async () => {
  vi.useFakeTimers();
  let view;
  await act(async () => { view = render(<Observability connected />); });
  await act(async () => { fireEvent.click(history().getByRole("button", { name: "Next" })); });
  expect(history().getByText("ORDER-1")).toBeInTheDocument();
  const requestedPages = [];
  let finish;
  historyRequest = (page) => new Promise((resolve) => { requestedPages.push(page); finish = resolve; });
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(requestedPages).toEqual([1]);
  await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
  expect(requestedPages).toEqual([1]);
  await act(async () => finish(response(pages[1], 1)));
  expect(history().queryByText("Loading order history…")).not.toBeInTheDocument();
  view.unmount();
  const requests = fetch.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
  expect(fetch).toHaveBeenCalledTimes(requests);
});

test("StrictMode effect cleanup invalidates its first pending response", async () => {
  let finishFirst;
  let requests = 0;
  historyRequest = () => {
    requests++;
    return requests === 1 ? new Promise((resolve) => { finishFirst = resolve; })
      : Promise.resolve(response([order(88)], 0, true));
  };
  render(<React.StrictMode><Observability connected /></React.StrictMode>);
  expect(await history().findByText("ORDER-88")).toBeInTheDocument();
  await act(async () => finishFirst(response([order(99)], 0, false)));
  expect(history().getByText("ORDER-88")).toBeInTheDocument();
  expect(history().queryByText("ORDER-99")).not.toBeInTheDocument();
  expect(history().getByRole("button", { name: "Next" })).toBeEnabled();
});

test("disconnect invalidates pending activity and clears loading until reconnect", async () => {
  const user = userEvent.setup();
  const view = render(<Observability connected />);
  await history().findByText("ORDER-25");
  let finish;
  historyRequest = () => new Promise((resolve) => { finish = resolve; });
  await user.click(screen.getByRole("button", { name: "Refresh activity" }));
  expect(history().getByText("Loading order history…")).toBeInTheDocument();
  view.rerender(<Observability connected={false} />);
  expect(history().queryByText("Loading order history…")).not.toBeInTheDocument();
  expect(screen.getByText("Backend unavailable. Activity cannot be loaded.")).toBeInTheDocument();
  expect(history().getByRole("button", { name: "Next" })).toBeDisabled();
  await act(async () => finish(response([order(99)], 0, true)));
  expect(history().getByText("ORDER-25")).toBeInTheDocument();
  expect(history().queryByText("ORDER-99")).not.toBeInTheDocument();
  historyRequest = async () => response([order(77)], 0);
  view.rerender(<Observability connected />);
  expect(await history().findByText("ORDER-77")).toBeInTheDocument();
});

test("Previous starts a fresh request immediately and late older-page responses cannot overwrite it", async () => {
  const user = userEvent.setup();
  let firstPageRequests = 0;
  let finishOlder;
  historyRequest = (page) => {
    if (page === 1) return new Promise((resolve) => { finishOlder = resolve; });
    firstPageRequests++;
    return Promise.resolve(response(firstPageRequests === 1 ? pages[0] : [order(99)], 0, true));
  };
  render(<Observability connected />);
  await history().findByText("ORDER-25");
  await user.click(history().getByRole("button", { name: "Next" }));
  expect(history().getByText("Loading order history…")).toBeInTheDocument();
  await user.click(history().getByRole("button", { name: "Previous" }));
  expect(await history().findByText("ORDER-99")).toBeInTheDocument();
  await act(async () => finishOlder(response(pages[1], 1, false)));
  expect(history().getByText("Page 1")).toBeInTheDocument();
  expect(history().getByText("ORDER-99")).toBeInTheDocument();
  expect(history().queryByText("ORDER-1")).not.toBeInTheDocument();
  expect(history().queryByText("Loading order history…")).not.toBeInTheDocument();
  expect(history().getByRole("button", { name: "Next" })).toBeEnabled();
});

test("navigates older and newer pages without hiding history, with explicit navigation loading", async () => {
  const user = userEvent.setup();
  render(<Observability connected />);
  expect(await history().findByText("ORDER-25")).toBeInTheDocument();
  expect(history().getAllByRole("article")).toHaveLength(20);
  expect(history().getByText("Page 1")).toBeInTheDocument();
  expect(history().getByRole("button", { name: "Previous" })).toBeDisabled();
  const requests = historyRequest;
  let finish;
  historyRequest = (page) => page === 1 ? new Promise((resolve) => { finish = resolve; }) : requests(page);
  await user.click(history().getByRole("button", { name: "Next" }));
  expect(history().getByText("Page 2")).toBeInTheDocument();
  expect(history().getByText("Loading order history…")).toBeInTheDocument();
  expect(history().queryByText("ORDER-25")).not.toBeInTheDocument();
  expect(history().getByRole("button", { name: "Next" })).toBeDisabled();
  await act(async () => finish(response(pages[1], 1)));
  expect(await history().findByText("ORDER-1")).toBeInTheDocument();
  expect(history().getByRole("button", { name: "Next" })).toBeDisabled();
  await user.click(history().getByRole("button", { name: "Previous" }));
  expect(await history().findByText("ORDER-25")).toBeInTheDocument();
  expect(history().getByText("Page 1")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/api/orders?page=1&size=20", expect.any(Object));
});
