const isBlankQuantity = (quantity) =>
  quantity === undefined || quantity === null || quantity === "";

export function getOutstandingQuantity(qtyOrdered = 0, qtyReceived = 0) {
  return Math.max(Number(qtyOrdered) - Number(qtyReceived), 0);
}

function normalizePositiveQuantity(quantity, fallbackQuantity, contextLabel) {
  const parsedQuantity = isBlankQuantity(quantity)
    ? fallbackQuantity
    : Number(quantity);

  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
    throw new Error(`${contextLabel} must be greater than zero`);
  }

  return parsedQuantity;
}

function findSelection(selections, workflowItemId) {
  return selections.find(
    (selection) => Number(selection.workflowItemId) === Number(workflowItemId)
  );
}

export function buildReceiveStockPayloads({ purchaseOrders, selections }) {
  if (!Array.isArray(purchaseOrders) || purchaseOrders.length === 0) {
    throw new Error("No purchase orders were found for the selected items");
  }

  if (!Array.isArray(selections) || selections.length === 0) {
    throw new Error("No workflow items were selected");
  }

  const payloads = [];

  for (const purchaseOrder of purchaseOrders) {
    const lineItems = [];

    for (const poLine of purchaseOrder.purchase_order_lines || []) {
      const customerOrderLines = [];

      for (const customerLine of poLine.customer_order_lines || []) {
        const selection = findSelection(
          selections,
          customerLine.workflow_item_id
        );

        if (!selection) continue;

        const outstandingQuantity = getOutstandingQuantity(
          customerLine.qty_ordered,
          customerLine.qty_received
        );
        const qtyReceived = normalizePositiveQuantity(
          selection.quantity,
          outstandingQuantity,
          `Receive quantity for workflow item ${customerLine.workflow_item_id}`
        );

        if (qtyReceived > outstandingQuantity) {
          throw new Error(
            `Receive quantity for workflow item ${customerLine.workflow_item_id} exceeds outstanding quantity`
          );
        }

        customerOrderLines.push({
          workflow_item_id: customerLine.workflow_item_id,
          qty_received: qtyReceived,
        });
      }

      if (customerOrderLines.length > 0) {
        const lineItem = {
          id: poLine.id,
          customer_order_lines: customerOrderLines,
        };

        if (poLine.unit_price !== undefined && poLine.unit_price !== null) {
          lineItem.unit_price = poLine.unit_price;
        }

        lineItems.push(lineItem);
      }
    }

    if (lineItems.length > 0) {
      payloads.push({
        id: purchaseOrder.id,
        line_items: lineItems,
      });
    }
  }

  if (payloads.length === 0) {
    throw new Error("No selected workflow items matched purchase order lines");
  }

  return payloads;
}

export function buildUpdateOrderStatusBody({
  orderId,
  newStatus,
  trackingNumber,
  selections,
}) {
  if (!orderId) {
    throw new Error("Order id is required");
  }

  if (![2, 3].includes(Number(newStatus))) {
    throw new Error("New status must be 2 (Produced) or 3 (Shipped)");
  }

  if (!Array.isArray(selections) || selections.length === 0) {
    throw new Error("No workflow items were selected");
  }

  if (Number(newStatus) === 3 && !trackingNumber) {
    throw new Error("Tracking number is required when marking items shipped");
  }

  const body = new URLSearchParams();

  selections.forEach((selection, index) => {
    const changeIndex = index + 1;
    body.set(`changes[${changeIndex}][order_id]`, String(orderId));
    body.set(
      `changes[${changeIndex}][order_line_id]`,
      String(selection.orderLineId)
    );
    body.set(
      `changes[${changeIndex}][workflow_item_id]`,
      String(selection.workflowItemId)
    );
    body.set(`changes[${changeIndex}][new_status]`, String(newStatus));
    body.set(`changes[${changeIndex}][contact_customer]`, "false");

    if (!isBlankQuantity(selection.quantity)) {
      body.set(`changes[${changeIndex}][qty]`, String(selection.quantity));
    }

    if (Number(newStatus) === 3) {
      body.set(
        `changes[${changeIndex}][shipping_tracking_code]`,
        trackingNumber
      );
    }
  });

  return body;
}
