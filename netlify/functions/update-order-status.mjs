import fetch from "node-fetch";
import process from "process";
import { buildUpdateOrderStatusBody } from "../lib/decoPayloads.mjs";

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

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    ensureCredentials();

    const { action, orderId, selections, trackingNumber } = JSON.parse(
      event.body || "{}"
    );
    const newStatus = action === "ship" ? 3 : 2;

    if (!["produce", "ship"].includes(action)) {
      return jsonResponse(400, {
        error: "Action must be either produce or ship",
      });
    }

    const body = buildUpdateOrderStatusBody({
      orderId,
      newStatus,
      trackingNumber,
      selections,
    });

    body.set("username", process.env.API_USERNAME);
    body.set("password", process.env.API_PASSWORD);

    const response = await fetch(
      `${DECO_BASE_URL}/manage_orders/update_order_status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      }
    );
    const data = await response.json();

    if (!response.ok || data.response_status?.severity === "ERROR") {
      throw new Error(
        data.response_status?.description || "Failed to update order status"
      );
    }

    return jsonResponse(200, {
      success: true,
      message:
        action === "ship"
          ? "Tracking added and selected items marked shipped."
          : "Selected items marked produced.",
      result: data,
    });
  } catch (error) {
    console.error("Update order status error:", error);
    return jsonResponse(500, {
      error: "Failed to update order status",
      details: error.message,
    });
  }
}
