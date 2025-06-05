import { useFrontContext } from "../providers/frontContext";
import { useState, useEffect } from "react";
import {
  PluginFooter,
  Button,
  PluginHeader,
  PluginLayout,
  TabGroup,
  Tab,
  Accordion,
  AccordionSection,
} from "@frontapp/ui-kit";
import OrderStatusBubble from "./OrderStatus";

function OrderSearch() {
  const context = useFrontContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [orderData, setOrderData] = useState(null);
  const [latestMessageId, setLatestMessageId] = useState(undefined);
  const [searchHistory, setSearchHistory] = useState(() => {
    const savedHistory = localStorage.getItem("searchHistory");
    return savedHistory ? JSON.parse(savedHistory) : [];
  });

  useEffect(() => {
    context.listMessages().then((response) => {
      if (response.results.length > 0) {
        const latestMessageIndex = response.results.length - 1;
        setLatestMessageId(response.results[latestMessageIndex].id);
      } else {
        setLatestMessageId(undefined);
      }
    });
  }, [context]);

  const handleSearch = async (e, searchString) => {
    if (e) e.preventDefault(); // Prevent the default form submit action

    const searchQuery = searchString || searchTerm;

    let modifiedSearchTerm = searchTerm;
    setSelectedTab("Order Info");
    if (!searchTerm.toLowerCase().startsWith("order-")) {
      modifiedSearchTerm = "Order-" + searchTerm;
    }

    const username = context.teammate ? context.teammate.name : "anonymous";

    const serverUrl = `/.netlify/functions/search?searchTerm=${encodeURIComponent(
      modifiedSearchTerm
    )}&username=${encodeURIComponent(username)}`;

    setSearchHistory((prevHistory) => {
      const newHistory = [
        searchQuery,
        ...prevHistory.filter((term) => term !== searchQuery),
      ].slice(0, 7);
      localStorage.setItem("searchHistory", JSON.stringify(newHistory));
      return newHistory;
    });

    try {
      const response = await fetch(serverUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setOrderData(data); // Saving the data to state

      // Process and log the data
      if (data.orders && data.orders.length > 0) {
        data.orders.forEach((order) => {
          if (order.notes && order.notes.length > 0) {
            order.notes.forEach((note) => console.log("Note:", note));
          }

          if (order.shipments && order.shipments.length > 0) {
            order.shipments.forEach((shipment) =>
              console.log("Shipment:", shipment)
            );
          }
        });
      }
    } catch (error) {
      console.error("There was an error fetching the order data:", error);
    }
  };

  const handleReselectSearchTerm = (term) => {
    setSearchTerm(term);
    handleSearch(null, term); // Pass null for the event and term as searchString
  };

  const onCreateDraftClick = () => {
    if (!latestMessageId) return;

    const messageBody = `
        Hey Team,
    
        We are sending this project over Test update.
    
        Order number: ${orderData.order_id}
        Ship by date: ${orderData.date_due}
    
        Order proof file: ${orderData.order_proof_pdf_url}
    
        The artwork and production files should be attached.
      `;

    if (typeof context.conversation.draftId !== "undefined") {
      context.updateDraft(context.conversation.draftId, {
        updateMode: "insert",
        content: {
          body: messageBody,
          type: "text",
        },
      });
    } else {
      context.createDraft({
        content: {
          body: messageBody,
          type: "text",
        },
        replyOptions: {
          type: "replyAll",
          originalMessageId: latestMessageId,
        },
      });
    }
  };

  const [selectedTab, setSelectedTab] = useState("Order Information");
  const tabs = [
    "Order Info",
    "Line Items",
    "Billing & Shipping",
    "Vendor Order",
  ];

  // Vendor Order state
  const [selectedProducts, setSelectedProducts] = useState({});
  const [vendorOrderData, setVendorOrderData] = useState({
    pmsColors: {},
    inHandDate: "",
    coBrandedLabel: {},
    preProductionSample: {},
    artworkLinks: "",
    shippingNotes:
      "Ship to: *China order AIR Shipping (Let us know if Express is needed to meet in the date)\n*If this is being shipped from Abroad to the USA make sure the vendor add our Tax ID/EIN # (20-3592623).",
  });

  // CSS for clickable terms
  const clickableStyle = {
    color: "blue",
    textDecoration: "underline",
    cursor: "pointer",
    marginRight: "5px",
  };

  function extractDriveLinks(content) {
    const segments = content.split(/\s+/);
    const links = [];

    for (let i = 0; i < segments.length; i++) {
      if (
        segments[i].startsWith("https://drive.google.com/drive/") ||
        segments[i].startsWith("https://docs.google.com/")
      ) {
        // Assume the preceding word is the descriptor, if it exists
        const descriptor =
          i > 0 ? segments[i - 1].replace(":", "") : "Drive Link";
        links.push({ descriptor, url: segments[i] });
      }
    }

    return links;
  }

  // Vendor Order helper functions
  const handleProductSelection = (productId, isSelected) => {
    setSelectedProducts((prev) => ({
      ...prev,
      [productId]: isSelected,
    }));
  };

  const handleVendorOrderDataChange = (field, productId, value) => {
    setVendorOrderData((prev) => ({
      ...prev,
      [field]: productId
        ? {
            ...prev[field],
            [productId]: value,
          }
        : value,
    }));
  };

  const generateVendorOrderEmail = (order) => {
    const selectedProductIds = Object.keys(selectedProducts).filter(
      (id) => selectedProducts[id]
    );
    const selectedOrderLines = order.order_lines.filter(
      (line) => selectedProductIds.includes(line.id) && line.fields.length > 0
    );

    if (selectedOrderLines.length === 0) {
      return "No products selected for vendor order.";
    }

    let emailContent = `We are placing an order. Details below:\n\n`;
    emailContent += `Customer #: ${order.customer_id}\n`;
    emailContent += `PO #: ${order.customer_po_number || "N/A"}\n\n`;

    selectedOrderLines.forEach((line, index) => {
      emailContent += `--- Item ${index + 1} ---\n`;
      emailContent += `Item: ${line.product_name}\n`;
      if (line.product_code)
        emailContent += `Product Code: ${line.product_code}\n`;

      const colorName =
        line.product_color?.name || line.product_freeform_color || "N/A";
      emailContent += `Color: ${colorName}\n`;
      emailContent += `Quantity: ${line.qty} (Ship Exact)\n`;

      // Size breakdown
      if (line.fields.length > 0 && line.fields[0].options.length > 0) {
        emailContent += `Size Breakdown:\n`;
        line.fields[0].options.forEach((option) => {
          emailContent += `  - ${option.name}: ${option.qty}\n`;
        });
      }

      // PMS Colors
      const pmsColor = vendorOrderData.pmsColors[line.id] || "";
      if (pmsColor) {
        emailContent += `Imprint PMS Colors: ${pmsColor}\n`;
      }

      // Co-branded label
      const coBranded = vendorOrderData.coBrandedLabel[line.id];
      emailContent += `Co-Branded CM Label: ${
        coBranded === true ? "Yes" : coBranded === false ? "No" : "N/A"
      }\n`;

      emailContent += `Pricing per unit Net: $${line.unit_price}\n`;

      // Pre-production sample
      const preProduction = vendorOrderData.preProductionSample[line.id];
      emailContent += `Pre-production sample/Photo: ${
        preProduction === true ? "Yes" : preProduction === false ? "No" : "N/A"
      }\n\n`;
    });

    // Artwork links
    if (vendorOrderData.artworkLinks) {
      emailContent += `Artwork and Mocks: ${vendorOrderData.artworkLinks}\n\n`;
    }

    // In-hand date
    if (vendorOrderData.inHandDate) {
      emailContent += `In-hand date: ${vendorOrderData.inHandDate}\n\n`;
    }

    emailContent += `Please use our UPS Account for shipping:\nX4R511 / Zip: 20817\n\n`;
    emailContent += vendorOrderData.shippingNotes;
    emailContent += `\n\nPlease, let me know if you have any questions.\n\nRegards.`;

    return emailContent;
  };

  const onCreateVendorOrderDraft = () => {
    if (!latestMessageId || !orderData?.orders?.[0]) return;

    const emailBody = generateVendorOrderEmail(orderData.orders[0]);

    if (typeof context.conversation.draftId !== "undefined") {
      context.updateDraft(context.conversation.draftId, {
        updateMode: "insert",
        content: {
          body: emailBody,
          type: "text",
        },
      });
    } else {
      context.createDraft({
        content: {
          body: emailBody,
          type: "text",
        },
        replyOptions: {
          type: "replyAll",
          originalMessageId: latestMessageId,
        },
      });
    }
  };

  return (
    <PluginLayout>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          backgroundColor: "#fff",
        }}
      >
        <form onSubmit={handleSearch}>
          <PluginHeader search={{ query: searchTerm, onChange: setSearchTerm }}>
            Crooked Monkey Order Search
          </PluginHeader>
          <input type="submit" style={{ display: "none" }} />{" "}
          {/* Hidden submit button */}
        </form>
      </div>
      <div className="App">
        {orderData && orderData.orders && orderData.orders.length > 0 && (
          <>
            <TabGroup>
              {tabs.map((tab) => (
                <Tab
                  key={tab}
                  name={tab}
                  isSelected={tab === selectedTab}
                  onClick={() => setSelectedTab(tab)}
                />
              ))}
            </TabGroup>
            {orderData.orders.map((order) => (
              <div key={order.order_id}>
                {selectedTab === "Order Info" && (
                  <div className="order-info">
                    <header className="App-header">
                      <div className="order-info">
                        <div className="info-row">
                          <span>Order ID:</span> <span>{order.order_id}</span>
                        </div>
                        {order.created_by && (
                          <div className="info-row">
                            <span>Created By:</span>{" "}
                            <span>{order.created_by.firstname}</span>
                          </div>
                        )}
                        {order.order_lines.length > 0 &&
                          order.order_lines[0].production_assigned_to &&
                          order.order_lines[0].production_assigned_to.length >
                            0 && (
                            <div className="info-row">
                              <span>Production Lead:</span>
                              <span>
                                {
                                  order.order_lines[0].production_assigned_to[0]
                                    .firstname
                                }
                              </span>
                            </div>
                          )}
                        <div className="info-row">
                          <span>Job Name:</span> <span>{order.job_name}</span>
                        </div>
                        {order.billing_details && (
                          <div className="info-row">
                            <span>Company Name:</span>
                            <span>{order.billing_details.company}</span>
                          </div>
                        )}
                        <div className="info-row">
                          <span>Order Amount:</span>{" "}
                          <span>${order.item_amount}</span>
                        </div>
                        {order.shipping_method && (
                          <div className="info-row">
                            <span>Shipping Method:</span>
                            <span>{order.shipping_method.name}</span>
                          </div>
                        )}
                        <OrderStatusBubble status={order.order_status} />
                        <div className="notes-container">
                          <Accordion expandMode="multi">
                            {order.notes.map((note, index) => (
                              <AccordionSection
                                key={index}
                                id={`note-${index}`}
                                title={`${note.note_type}`}
                                className="note"
                              >
                                <div>{note.content}</div>
                              </AccordionSection>
                            ))}
                          </Accordion>
                          <div className="section-container">
                            <div>
                              <span>
                                {order.notes.some(
                                  (note) =>
                                    extractDriveLinks(note.content).length > 0
                                )
                                  ? "Drive Links from Notes:"
                                  : "No Drive Links Found"}
                              </span>
                            </div>
                            {order.notes.flatMap((note, noteIndex) =>
                              extractDriveLinks(note.content).map(
                                (link, linkIndex) => (
                                  <div key={`${noteIndex}-${linkIndex}`}>
                                    <a
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {link.descriptor}
                                    </a>
                                  </div>
                                )
                              )
                            )}
                          </div>
                        </div>
                        {order.shipments && (
                          <div className="section-container">
                            {order.shipments.map((shipment, index) => (
                              <div key={index}>
                                <p>
                                  Tracking:{" "}
                                  {shipment.tracking_number.startsWith("1Z") ? (
                                    <a
                                      href={`https://www.ups.com/track?tracknum=${
                                        shipment.tracking_number.split(" ")[0]
                                      }`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {shipment.tracking_number}
                                    </a>
                                  ) : shipment.tracking_number.startsWith(
                                      "78"
                                    ) ? (
                                    <a
                                      href={`https://www.fedex.com/apps/fedextrack/?tracknumbers=${shipment.tracking_number}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {shipment.tracking_number}
                                    </a>
                                  ) : (
                                    shipment.tracking_number
                                  )}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </header>
                  </div>
                )}
                {selectedTab === "Line Items" && (
                  <Accordion expandMode="multi">
                    {/* Display regular line items first */}
                    {order.order_lines
                      .filter((lineItem) => lineItem.fields.length > 0)
                      .map((lineItem, index) => (
                        <AccordionSection
                          key={index}
                          id={`line-item-${index}`}
                          title={`${lineItem.product_name}`}
                          className="line-item-main"
                        >
                          <div className="line-item-details">
                            <div className="info-row">
                              <span>Quantity:</span> <span>{lineItem.qty}</span>
                            </div>
                            <div className="info-row">
                              <span>Unit Price:</span>{" "}
                              <span>${lineItem.unit_price}</span>
                            </div>
                            <div className="info-row">
                              <span>Product Color:</span>
                              <span>
                                {lineItem.product_color?.name ||
                                  lineItem.product_freeform_color}
                              </span>
                            </div>
                            {lineItem.fields.length > 0 &&
                              lineItem.fields[0].options.length > 0 && (
                                <div className="info-row">
                                  <span>SKU:</span>{" "}
                                  <span>
                                    {lineItem.fields[0].options[0].sku}
                                  </span>
                                </div>
                              )}
                            {lineItem.fields.map((field, fieldIndex) => (
                              <div key={fieldIndex} className="info-row">
                                <span>Sizing:</span>
                                <span>
                                  {field.options
                                    .map(
                                      (option) =>
                                        `${option.code} x ${option.qty}`
                                    )
                                    .join(", ")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </AccordionSection>
                      ))}
                    {/* Display extra charges (empty fields) last */}
                    {order.order_lines
                      .filter((lineItem) => lineItem.fields.length === 0)
                      .map((lineItem, index) => (
                        <AccordionSection
                          key={index}
                          id={`extra-charge-${index}`}
                          title={`${lineItem.product_name}`}
                          className="line-item-extra"
                        >
                          <div className="line-item-details">
                            <div className="info-row">
                              <span>Quantity:</span> <span>{lineItem.qty}</span>
                            </div>
                            <div className="info-row">
                              <span>Unit Price:</span>{" "}
                              <span>${lineItem.unit_price}</span>
                            </div>
                          </div>
                        </AccordionSection>
                      ))}
                  </Accordion>
                )}
                {selectedTab === "Billing & Shipping" && (
                  <div>
                    {order.shipping_details && (
                      <div>
                        <div className="billing-phone">
                          <div className="info-row">
                            <span>Phone:</span>{" "}
                            <span>{order.shipping_details.ph_number}</span>
                          </div>
                        </div>
                        <div className="shipping-section">
                          <div className="info-row">
                            <span>Shipping Address:</span>
                            <span>
                              {order.shipping_details.firstname}{" "}
                              {order.shipping_details.lastname}
                              <br />
                              {order.shipping_details.street}
                              <br />
                              {order.shipping_details.city},{" "}
                              {order.shipping_details.state}{" "}
                              {order.shipping_details.postcode},{" "}
                              {order.shipping_details.country_code}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {order.billing_details && (
                      <div>
                        <div className="billing-section">
                          <div className="info-row">
                            <span>Billing Address:</span>
                            <span>
                              {order.billing_details.firstname}{" "}
                              {order.billing_details.lastname}
                              <br />
                              {order.billing_details.street}
                              <br />
                              {order.billing_details.city},{" "}
                              {order.billing_details.state} <br></br>
                              {order.billing_details.postcode},{" "}
                              {order.billing_details.country_code}
                            </span>
                          </div>
                        </div>
                        {/* Include other billing details as needed */}
                      </div>
                    )}
                  </div>
                )}
                {selectedTab === "Vendor Order" && (
                  <div className="vendor-order">
                    <div style={{ marginBottom: "20px" }}>
                      <h3>Select Products for Vendor Order</h3>

                      {/* Global settings */}
                      <div
                        style={{
                          marginBottom: "15px",
                          padding: "10px",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                        }}
                      >
                        <h4>Order Details</h4>
                        <div style={{ marginBottom: "10px" }}>
                          <label>In-hand Date:</label>
                          <input
                            type="date"
                            value={vendorOrderData.inHandDate}
                            onChange={(e) =>
                              handleVendorOrderDataChange(
                                "inHandDate",
                                null,
                                e.target.value
                              )
                            }
                            style={{ marginLeft: "10px", padding: "4px" }}
                          />
                        </div>
                        <div style={{ marginBottom: "10px" }}>
                          <label>Artwork Links:</label>
                          <input
                            type="text"
                            value={vendorOrderData.artworkLinks}
                            onChange={(e) =>
                              handleVendorOrderDataChange(
                                "artworkLinks",
                                null,
                                e.target.value
                              )
                            }
                            placeholder="https://drive.google.com/..."
                            style={{
                              marginLeft: "10px",
                              padding: "4px",
                              width: "300px",
                            }}
                          />
                        </div>
                        <div>
                          <label>Shipping Notes:</label>
                          <textarea
                            value={vendorOrderData.shippingNotes}
                            onChange={(e) =>
                              handleVendorOrderDataChange(
                                "shippingNotes",
                                null,
                                e.target.value
                              )
                            }
                            style={{
                              marginLeft: "10px",
                              padding: "4px",
                              width: "400px",
                              height: "60px",
                            }}
                          />
                        </div>
                      </div>

                      {/* Product list */}
                      {order.order_lines
                        .filter((lineItem) => lineItem.fields.length > 0)
                        .map((lineItem) => (
                          <div
                            key={lineItem.id}
                            style={{
                              marginBottom: "15px",
                              padding: "10px",
                              border: "1px solid #ddd",
                              borderRadius: "4px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                marginBottom: "10px",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedProducts[lineItem.id] || false}
                                onChange={(e) =>
                                  handleProductSelection(
                                    lineItem.id,
                                    e.target.checked
                                  )
                                }
                                style={{ marginRight: "10px" }}
                              />
                              <strong>{lineItem.product_name}</strong>
                              {lineItem.product_code && (
                                <span
                                  style={{ marginLeft: "10px", color: "#666" }}
                                >
                                  ({lineItem.product_code})
                                </span>
                              )}
                            </div>

                            {selectedProducts[lineItem.id] && (
                              <div style={{ marginLeft: "20px" }}>
                                <div style={{ marginBottom: "8px" }}>
                                  <span>Quantity: {lineItem.qty}</span>
                                  <span style={{ marginLeft: "20px" }}>
                                    Color:{" "}
                                    {lineItem.product_color?.name ||
                                      lineItem.product_freeform_color ||
                                      "N/A"}
                                  </span>
                                  <span style={{ marginLeft: "20px" }}>
                                    Price: ${lineItem.unit_price}
                                  </span>
                                </div>

                                {/* Size breakdown */}
                                {lineItem.fields.length > 0 &&
                                  lineItem.fields[0].options.length > 0 && (
                                    <div style={{ marginBottom: "8px" }}>
                                      <strong>Sizes: </strong>
                                      {lineItem.fields[0].options
                                        .map(
                                          (option) =>
                                            `${option.name}: ${option.qty}`
                                        )
                                        .join(", ")}
                                    </div>
                                  )}

                                <div
                                  style={{
                                    display: "flex",
                                    gap: "15px",
                                    flexWrap: "wrap",
                                    marginTop: "10px",
                                  }}
                                >
                                  <div>
                                    <label>PMS Colors:</label>
                                    <input
                                      type="text"
                                      value={
                                        vendorOrderData.pmsColors[
                                          lineItem.id
                                        ] || ""
                                      }
                                      onChange={(e) =>
                                        handleVendorOrderDataChange(
                                          "pmsColors",
                                          lineItem.id,
                                          e.target.value
                                        )
                                      }
                                      placeholder="e.g., 345, 186C"
                                      style={{
                                        marginLeft: "5px",
                                        padding: "4px",
                                        width: "120px",
                                      }}
                                    />
                                  </div>

                                  <div>
                                    <label>Co-Branded CM Label:</label>
                                    <select
                                      value={
                                        vendorOrderData.coBrandedLabel[
                                          lineItem.id
                                        ] ?? ""
                                      }
                                      onChange={(e) =>
                                        handleVendorOrderDataChange(
                                          "coBrandedLabel",
                                          lineItem.id,
                                          e.target.value === "true"
                                            ? true
                                            : e.target.value === "false"
                                            ? false
                                            : ""
                                        )
                                      }
                                      style={{
                                        marginLeft: "5px",
                                        padding: "4px",
                                      }}
                                    >
                                      <option value="">Select...</option>
                                      <option value="true">Yes</option>
                                      <option value="false">No</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label>Pre-production Sample:</label>
                                    <select
                                      value={
                                        vendorOrderData.preProductionSample[
                                          lineItem.id
                                        ] ?? ""
                                      }
                                      onChange={(e) =>
                                        handleVendorOrderDataChange(
                                          "preProductionSample",
                                          lineItem.id,
                                          e.target.value === "true"
                                            ? true
                                            : e.target.value === "false"
                                            ? false
                                            : ""
                                        )
                                      }
                                      style={{
                                        marginLeft: "5px",
                                        padding: "4px",
                                      }}
                                    >
                                      <option value="">Select...</option>
                                      <option value="true">Yes</option>
                                      <option value="false">No</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
        <PluginFooter>
          {latestMessageId && (
            <Button type="primary" onClick={onCreateDraftClick}>
              Reply
            </Button>
          )}
          {latestMessageId && selectedTab === "Vendor Order" && (
            <Button type="secondary" onClick={onCreateVendorOrderDraft}>
              Create Vendor Order
            </Button>
          )}
          <Accordion expandMode="multi">
            <AccordionSection id="search-history" title="Recent Searches">
              <div>
                {searchHistory.map((term, index) => (
                  <span
                    key={index}
                    onClick={() => handleReselectSearchTerm(term)}
                    style={clickableStyle}
                  >
                    {term}
                    {index < searchHistory.length - 1 ? ", " : ""}
                  </span>
                ))}
              </div>
            </AccordionSection>
          </Accordion>
        </PluginFooter>
      </div>
    </PluginLayout>
  );
}

export default OrderSearch;
