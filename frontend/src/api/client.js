// Offline preview metadata only: never used as live stock or persisted orders.

export const INITIAL_PRODUCTS = [
  {
    id: "FLASH_ITEM",
    name: "Quantum RTX Titan 5090 (24GB GDDR7)",
    category: "Flagship GPUs",
    price: 1999.0,
    originalPrice: 2499.0,
    stock: 10,
    initialStock: 10,
    isFlashDeal: true,
    tag: "⚡ FLASH DEAL - 20% OFF",
    description:
      "The ultimate high-concurrency flagship GPU with next-gen tensor accelerators and 32,000 CUDA cores. Target of our pessimistic write-lock flash sale test.",
    image:
      "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=800&q=80",
    specs: [
      "Blackwell Architecture",
      "24GB GDDR7 VRAM",
      "32,000 CUDA Cores",
      "DLSS 4.0 Neural Render",
    ],
    rating: 4.9,
    reviewCount: 482,
  },
  {
    id: "MECH_KEYBOARD",
    name: "CyberForge Pro 75% Magnetic Switch Keyboard",
    category: "Peripherals",
    price: 189.0,
    originalPrice: 229.0,
    stock: 25,
    initialStock: 25,
    isFlashDeal: false,
    tag: "🔥 Best Seller",
    description:
      "Magnetic hall-effect switches with 0.1mm - 4.0mm adjustable rapid trigger actuation and anodized CNC aluminum chassis.",
    image:
      "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=800&q=80",
    specs: [
      "Hall-Effect Magnetic Switches",
      "8000Hz Hyper-Polling",
      "Anodized Aluminum Body",
      "RGB Per-Key",
    ],
    rating: 4.8,
    reviewCount: 315,
  },
  {
    id: "OLED_DISPLAY",
    name: 'AeroView 34" Curved QD-OLED UltraWide',
    category: "Displays",
    price: 849.0,
    originalPrice: 999.0,
    stock: 8,
    initialStock: 8,
    isFlashDeal: true,
    tag: "⚡ Flash Deal",
    description:
      "Next-generation Quantum Dot OLED panel with pure infinite blacks, 240Hz refresh rate, and near-instant 0.03ms response time.",
    image:
      "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80",
    specs: [
      "3440 x 1440 UWQHD",
      "240Hz Refresh Rate",
      "0.03ms GtG Response",
      "Quantum Dot OLED",
    ],
    rating: 4.9,
    reviewCount: 198,
  },
  {
    id: "AUDIO_PRO",
    name: "SonicStream Studio Pro Wireless ANC",
    category: "Audio",
    price: 299.0,
    originalPrice: 349.0,
    stock: 15,
    initialStock: 15,
    isFlashDeal: false,
    tag: "Hi-Res Audio",
    description:
      "Reference-grade planar magnetic drivers with hybrid Active Noise Cancellation, LDAC lossless codec, and 45h battery.",
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
    specs: [
      "Planar Magnetic Drivers",
      "Hybrid Dual-Mic ANC",
      "Lossless LDAC Codec",
      "45-Hour Battery Life",
    ],
    rating: 4.7,
    reviewCount: 240,
  },
  {
    id: "SMART_HUB",
    name: "Nexus Monolith AI Edge Gateway",
    category: "Smart Tech",
    price: 149.0,
    originalPrice: 179.0,
    stock: 20,
    initialStock: 20,
    isFlashDeal: false,
    tag: "Zero-Cloud Privacy",
    description:
      "Private local AI orchestration hub with multi-protocol Zigbee 3.0, Thread, and Matter support with on-device NPU.",
    image:
      "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=800&q=80",
    specs: [
      "On-Device Local NPU",
      "Thread & Matter Native",
      "Hardware Encrypted",
      "Zero Cloud Reliance",
    ],
    rating: 4.6,
    reviewCount: 142,
  },
  {
    id: "MOUSE_TITAN",
    name: "ViperStrike 8K Ultralight Wireless Mouse",
    category: "Peripherals",
    price: 129.0,
    originalPrice: 149.0,
    stock: 30,
    initialStock: 30,
    isFlashDeal: false,
    tag: "Ultralight 36g",
    description:
      "Magnesium skeleton shell weighing only 36 grams, optical Gen-3 switches, and true 8000Hz polling rate for esports competitors.",
    image:
      "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80",
    specs: [
      "36g Magnesium Shell",
      "Focus Pro 30K Sensor",
      "8000Hz Wireless Polling",
      "Gen-3 Optical Switches",
    ],
    rating: 4.8,
    reviewCount: 289,
  },
];

async function request(path, options = {}, parse = (data) => data) {
  let res;
  try {
    res = await fetch(path, {
      ...options,
      signal: AbortSignal.timeout(10000),
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch {
    throw new Error(
      options.method === "POST"
        ? "Connection lost or timed out. Request outcome is unknown; check order history before retrying."
        : "Backend unavailable. Retry the connection.",
    );
  }
  const data = await res.json().catch(() => null);
  if (!res.ok)
    throw new Error(
      data?.error ||
        data?.message ||
        `Request failed (${res.status}). Refresh before retrying.`,
    );
  if (data === null)
    throw new Error("Invalid server response. Refresh before retrying.");
  return parse(data, res);
}

export async function fetchProducts() {
  const data = await request("/api/products");
  if (!Array.isArray(data)) throw new Error("Invalid catalog response");
  return data;
}

export async function fetchOrders(page = 0, size = 20) {
  return request(`/api/orders?page=${page}&size=${size}`, {}, (data, res) => {
    if (!Array.isArray(data)) throw new Error("Invalid order history response");
    const responsePage = res.headers.get("X-Page");
    const responseSize = res.headers.get("X-Page-Size");
    const hasMore = res.headers.get("X-Has-More");
    if (
      responsePage !== String(page) ||
      responseSize !== String(size) ||
      !["true", "false"].includes(hasMore)
    ) {
      throw new Error("Invalid order history pagination response");
    }
    return {
      orders: data,
      page: Number(responsePage),
      size: Number(responseSize),
      hasMore: hasMore === "true",
    };
  });
}

export async function fetchNotifications() {
  const data = await request("/api/notifications");
  if (!Array.isArray(data))
    throw new Error("Invalid notification feed response");
  return data;
}

export async function placeOrder(productCode, quantity, usePessimistic = true) {
  const data = await request("/api/orders", {
    method: "POST",
    body: JSON.stringify({ productCode, quantity, usePessimistic }),
  });
  if (!data.orderNumber)
    throw new Error(
      "Unexpected order response. Check order history before retrying.",
    );
  return data;
}

export const restockAll = () =>
  request("/api/inventory/restock-all", { method: "POST" });

export async function checkout(items) {
  const data = await request("/api/orders/checkout", {
    method: "POST",
    body: JSON.stringify({ items, usePessimistic: true }),
  });
  if (
    !Array.isArray(data) ||
    data.length !== items.length ||
    data.some((order) => !order.orderNumber)
  ) {
    throw new Error(
      "Unexpected checkout response. Check order history before retrying.",
    );
  }
  return data;
}
