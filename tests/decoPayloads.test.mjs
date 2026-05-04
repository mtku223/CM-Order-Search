import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildReceiveStockPayloads,
  buildUpdateOrderStatusBody,
  getOutstandingQuantity,
} from "../netlify/lib/decoPayloads.mjs";

describe("Deco payload helpers", () => {
  it("calculates outstanding quantities without going below zero", () => {
    assert.equal(getOutstandingQuantity(8, 3), 5);
    assert.equal(getOutstandingQuantity(3, 8), 0);
  });

  it("groups receive stock payloads by purchase order and defaults to outstanding quantities", () => {
    const payloads = buildReceiveStockPayloads({
      purchaseOrders: [
        {
          id: 101,
          po_number: "PO-1001",
          purchase_order_lines: [
            {
              id: 501,
              unit_price: 12.5,
              customer_order_lines: [
                {
                  workflow_item_id: 9001,
                  qty_ordered: 8,
                  qty_received: 3,
                },
              ],
            },
          ],
        },
        {
          id: 102,
          po_number: "PO-1002",
          purchase_order_lines: [
            {
              id: 601,
              unit_price: 7,
              customer_order_lines: [
                {
                  workflow_item_id: 9002,
                  qty_ordered: 2,
                  qty_received: 0,
                },
              ],
            },
          ],
        },
      ],
      selections: [
        { workflowItemId: 9001 },
        { workflowItemId: 9002, quantity: "" },
      ],
    });

    assert.deepEqual(payloads, [
      {
        id: 101,
        line_items: [
          {
            id: 501,
            unit_price: 12.5,
            customer_order_lines: [
              {
                workflow_item_id: 9001,
                qty_received: 5,
              },
            ],
          },
        ],
      },
      {
        id: 102,
        line_items: [
          {
            id: 601,
            unit_price: 7,
            customer_order_lines: [
              {
                workflow_item_id: 9002,
                qty_received: 2,
              },
            ],
          },
        ],
      },
    ]);
  });

  it("rejects receive quantities that exceed outstanding customer order quantities", () => {
    assert.throws(
      () =>
        buildReceiveStockPayloads({
          purchaseOrders: [
            {
              id: 101,
              po_number: "PO-1001",
              purchase_order_lines: [
                {
                  id: 501,
                  customer_order_lines: [
                    {
                      workflow_item_id: 9001,
                      qty_ordered: 4,
                      qty_received: 2,
                    },
                  ],
                },
              ],
            },
          ],
          selections: [{ workflowItemId: 9001, quantity: 3 }],
        }),
      /exceeds outstanding quantity/
    );
  });

  it("builds multi-change form payloads for produced workflow items", () => {
    const body = buildUpdateOrderStatusBody({
      orderId: "Order-1234",
      newStatus: 2,
      selections: [
        { orderLineId: 11, workflowItemId: 9001, quantity: 5 },
        { orderLineId: 12, workflowItemId: 9002, quantity: "" },
      ],
    });

    assert.equal(body.get("changes[1][order_id]"), "Order-1234");
    assert.equal(body.get("changes[1][order_line_id]"), "11");
    assert.equal(body.get("changes[1][workflow_item_id]"), "9001");
    assert.equal(body.get("changes[1][qty]"), "5");
    assert.equal(body.get("changes[1][new_status]"), "2");
    assert.equal(body.get("changes[2][qty]"), null);
  });

  it("adds tracking codes to shipped workflow item changes", () => {
    const body = buildUpdateOrderStatusBody({
      orderId: "Order-1234",
      newStatus: 3,
      trackingNumber: "1Z999",
      selections: [{ orderLineId: 11, workflowItemId: 9001 }],
    });

    assert.equal(body.get("changes[1][new_status]"), "3");
    assert.equal(body.get("changes[1][shipping_tracking_code]"), "1Z999");
  });
});
