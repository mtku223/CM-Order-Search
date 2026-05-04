import fetch from "node-fetch";
import process from "process";
import { buildReceiveStockPayloads } from "../lib/decoPayloads.mjs";

const DECO_BASE_URL = "https://www.crookedmonkey.com/api/json";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

function ensureCredentials() {
  if (!process.env.API_USERNAME || !process.env.API_PASSWORD) {
    throw new Error("Deco API credentials are not configured");
  }
}

function getSelectedPoNumbers(selections) {
  return [
    ...new Set(
      selections
        .flatMap((selection) => selection.poNumbers || [])
        .map((poNumber) => String(poNumber).trim())
        .filter(Boolean)
    ),
  ];
}

async function findPurchaseOrder(poNumber) {
  const params = new URLSearchParams({
    "conditions[1][field]": "4",
    "conditions[1][condition]": "1",
    "conditions[1][string]": poNumber,
    limit: "100",
    offset: "0",
    sortby: "1",
    username: process.env.API_USERNAME,
    password: process.env.API_PASSWORD,
  });

  const response = await fetch(
    `${DECO_BASE_URL}/manage_purchase_orders/find?${params.toString()}`
  );
  const data = await response.json();

  if (!response.ok || data.response_status?.severity === "ERROR") {
    throw new Error(
      data.response_status?.description ||
        `Failed to find purchase order ${poNumber}`
    );
  }

  return data.purchase_orders || [];
}

async function receiveStock(payload) {
  const params = new URLSearchParams({
    username: process.env.API_USERNAME,
    password: process.env.API_PASSWORD,
  });

  const response = await fetch(
    `${DECO_BASE_URL}/manage_purchase_orders/receive_stock?${params.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  const data = await response.json();

  if (!response.ok || data.response_status?.severity === "ERROR") {
    throw new Error(
      data.response_status?.description ||
        `Failed to receive stock for purchase order ${payload.id}`
    );
  }

  return data;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    ensureCredentials();

    const { selections } = JSON.parse(event.body || "{}");

    if (!Array.isArray(selections) || selections.length === 0) {
      return jsonResponse(400, { error: "No workflow items were selected" });
    }

    const poNumbers = getSelectedPoNumbers(selections);

    if (poNumbers.length === 0) {
      return jsonResponse(400, {
        error: "Selected workflow items do not include purchase order numbers",
      });
    }

    const purchaseOrderGroups = await Promise.all(poNumbers.map(findPurchaseOrder));
    const purchaseOrders = purchaseOrderGroups.flat();
    const receivePayloads = buildReceiveStockPayloads({
      purchaseOrders,
      selections,
    });
    const results = [];

    for (const payload of receivePayloads) {
      results.push(await receiveStock(payload));
    }

    return jsonResponse(200, {
      success: true,
      message: `Received stock for ${receivePayloads.length} purchase order${
        receivePayloads.length === 1 ? "" : "s"
      }.`,
      purchaseOrderCount: receivePayloads.length,
      results,
    });
  } catch (error) {
    console.error("Receive stock error:", error);
    return jsonResponse(500, {
      error: "Failed to receive stock",
      details: error.message,
    });
  }
}
