import { useFrontContext } from "../providers/frontContext";
import { useState } from "react";
import Front from "@frontapp/plugin-sdk";
import PropTypes from "prop-types";
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

function KeyValueRow({ label, children }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <span>{children}</span>
    </div>
  );
}

KeyValueRow.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

function OrderSearch() {
  const context = useFrontContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [orderData, setOrderData] = useState(null);
  const [searchHistory, setSearchHistory] = useState(() => {
    const savedHistory = localStorage.getItem("searchHistory");
    return savedHistory ? JSON.parse(savedHistory) : [];
  });

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

  const [selectedTab, setSelectedTab] = useState("Order Information");
  const tabs = [
    "Order Info",
    "Line Items",
    "Billing & Shipping",
    "Vendor Order",
    "PDF Tools",
  ];

  // Vendor Order state
  const [selectedProducts, setSelectedProducts] = useState({});
  const [vendorOrderData, setVendorOrderData] = useState({
    pmsColors: {},
    inHandDate: "",
    coBrandedLabel: {},
    preProductionSample: {},
    shippingNotes:
      "Ship to: *China order AIR Shipping (Let us know if Express is needed to meet in the date)\n*If this is being shipped from Abroad to the USA make sure the vendor add our Tax ID/EIN # (20-3592623).",
  });

  // PDF Tools state
  const [pdfExtractionData, setPdfExtractionData] = useState({
    quote_pdf_pages: "",
    production_pdf_pages: "",
    proof_pdf_pages: "",
  });
  const [pdfExtractionLoading, setPdfExtractionLoading] = useState({});

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
      (line) =>
        selectedProductIds.includes(line.id) &&
        ((line.fields && line.fields.length > 0) || line.item_type === 25)
    );

    if (selectedOrderLines.length === 0) {
      return "No products selected for vendor order.";
    }

    let emailContent = `We are placing an order. Details below:\n\n`;
    emailContent += `Customer #: ${order.customer_id}\n`;
    emailContent += `PO #: ${order.order_id || "N/A"}\n\n`;

    selectedOrderLines.forEach((line, index) => {
      emailContent += `--- Item ${index + 1} ---\n`;
      emailContent += `Item: ${line.product_name}\n`;
      if (line.product_code)
        emailContent += `Product Code: ${line.product_code}\n`;

      const colorName =
        line.product_color?.name || line.product_freeform_color || "N/A";
      emailContent += `Color: ${colorName}\n`;
      emailContent += `Quantity: ${line.qty} (Ship Exact)\n`;

      // Size breakdown - only for items with fields/options
      if (
        line.fields &&
        line.fields.length > 0 &&
        line.fields[0].options &&
        line.fields[0].options.length > 0
      ) {
        emailContent += `Size Breakdown:\n`;
        line.fields[0].options.forEach((option) => {
          emailContent += `  - ${option.name}: ${option.qty}\n`;
        });
      }

      // Add description for freeform items
      if (line.product_description) {
        emailContent += `Decoration: ${line.product_description}\n`;
      }

      // Add attachment information
      if (line.attachment_urls && line.attachment_urls.length > 0) {
        emailContent += `Attachments: ${line.attachment_urls.length} product image(s) available\n`;
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

      // Pre-production sample
      const preProduction = vendorOrderData.preProductionSample[line.id];
      emailContent += `Pre-production sample/Photo: ${
        preProduction === true ? "Yes" : preProduction === false ? "No" : "N/A"
      }\n\n`;
    });

    // Artwork links
    const driveLinks = order.notes.flatMap((note) =>
      extractDriveLinks(note.content)
    );
    if (driveLinks.length > 0) {
      emailContent += `Artwork and Mocks:\n`;
      driveLinks.forEach((link) => {
        emailContent += `${link.descriptor}: ${link.url}\n`;
      });
      emailContent += `\n`;
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
    if (!orderData?.orders?.[0]) return;

    const emailBody = generateVendorOrderEmail(orderData.orders[0]);

    // Create a new email instead of replying to the current conversation
    context.createDraft({
      content: {
        body: emailBody,
        type: "text",
      },
      // Removed replyOptions to create a new email instead of reply
    });
  };

  // Search functions
  const searchDistributorCentral = (productName, productCode) => {
    const searchQuery = productCode
      ? encodeURIComponent(`${productCode} - ${productName}`)
      : encodeURIComponent(productName);
    const url = `https://www.distributorcentral.com/product/search.cfm?query=${searchQuery}`;

    try {
      if (window.Front && Front.openUrlInTab) {
        Front.openUrlInTab(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error("Error opening DistributorCentral search:", error);
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const searchGoogle = (productName, productCode) => {
    const searchQuery = productCode
      ? encodeURIComponent(`${productCode} ${productName}`)
      : encodeURIComponent(productName);
    const url = `https://www.google.com/search?q=${searchQuery}`;

    try {
      if (window.Front && Front.openUrlInTab) {
        Front.openUrlInTab(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error("Error opening Google search:", error);
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  // Function to download and attach images
  const downloadAttachment = async (attachmentUrl) => {
    try {
      // Open the image URL in a new tab for manual download/viewing
      // Front Plugin SDK provides Front.openUrlInTab for external URLs
      if (window.Front && Front.openUrlInTab) {
        Front.openUrlInTab(attachmentUrl);
      } else {
        // Fallback: use standard window.open
        window.open(attachmentUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error("Error opening attachment:", error);
      // Final fallback: use standard window.open
      window.open(attachmentUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleAttachments = (lineItem) => {
    if (lineItem.attachment_urls && lineItem.attachment_urls.length > 0) {
      lineItem.attachment_urls.forEach((attachment, index) => {
        // Add a small delay between opening multiple popups to avoid popup blockers
        setTimeout(() => {
          downloadAttachment(attachment.image_url);
        }, index * 500);
      });
    }
  };

  // PDF extraction functions
  const handlePdfPageExtraction = async (pdfUrl, pdfType, order) => {
    const pagesString = pdfExtractionData[`${pdfType}_pdf_pages`];

    if (!pagesString.trim()) {
      alert("Please enter page numbers to extract");
      return;
    }

    // Parse page numbers (support formats like "1,3,5" or "1-3,5" or "1 3 5")
    const pages = pagesString
      .split(/[,\s]+/)
      .map((page) => parseInt(page.trim()))
      .filter((page) => !isNaN(page) && page > 0);

    if (pages.length === 0) {
      alert("Please enter valid page numbers (e.g., 1,3,5)");
      return;
    }

    setPdfExtractionLoading((prev) => ({ ...prev, [pdfType]: true }));

    try {
      const response = await fetch("/.netlify/functions/extract-pdf-pages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pdfUrl,
          pages,
          filename: `${order.order_id}_${pdfType}_pages_${pages.join("-")}.pdf`,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Create download link
        const byteCharacters = atob(result.pdfData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        alert(
          `Successfully extracted pages ${result.extractedPages.join(
            ", "
          )} from ${pdfType} PDF`
        );
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error("PDF extraction error:", error);
      alert("Failed to extract PDF pages. Please try again.");
    } finally {
      setPdfExtractionLoading((prev) => ({ ...prev, [pdfType]: false }));
    }
  };

  const handlePdfPageInputChange = (pdfType, value) => {
    setPdfExtractionData((prev) => ({
      ...prev,
      [`${pdfType}_pdf_pages`]: value,
    }));
  };

  const extractBackendOrderId = (order) => {
    const pdfUrls = [
      order?.quote_pdf_url,
      order?.production_pdf_url,
      order?.order_proof_pdf_url,
    ].filter(Boolean);

    for (const url of pdfUrls) {
      const match = url.match(
        /\/download_(?:quote|worksheet|order_proof)\/(\d+)(?:\?|$)/
      );
      if (match?.[1]) {
        return match[1];
      }
    }

    return null;
  };

  return (
    <PluginLayout>
      <div className="App sidebar-shell">
        <div className="sticky-search">
          <form onSubmit={handleSearch}>
            <PluginHeader search={{ query: searchTerm, onChange: setSearchTerm }}>
              Crooked Monkey Order Search
            </PluginHeader>
            <input type="submit" style={{ display: "none" }} />
          </form>
        </div>
        {orderData && orderData.orders && orderData.orders.length > 0 && (
          <>
            <div className="tabs-wrap">
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
            </div>
            {orderData.orders.map((order) => {
              const backendOrderId = extractBackendOrderId(order);
              const backendOrderUrl = backendOrderId
                ? `https://www.crookedmonkey.com/bh/orders?p=2&id=${backendOrderId}`
                : null;

              return (
              <div key={order.order_id} className="content-card">
                {selectedTab === "Order Info" && (
                  <div className="order-info">
                    <header>
                      <h3 className="section-title">Order Info</h3>
                      <div className="order-info">
                        {backendOrderUrl && (
                          <KeyValueRow label="Backend Order">
                              <a
                                href={backendOrderUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Open in Backend
                              </a>
                          </KeyValueRow>
                        )}
                        <KeyValueRow label="Order ID">{order.order_id}</KeyValueRow>
                        {order.created_by && (
                          <KeyValueRow label="Created By">
                            {order.created_by.firstname}
                          </KeyValueRow>
                        )}
                        {order.order_lines.length > 0 &&
                          order.order_lines[0].production_assigned_to &&
                          order.order_lines[0].production_assigned_to.length >
                            0 && (
                            <KeyValueRow label="Production Lead">
                                {
                                  order.order_lines[0].production_assigned_to[0]
                                    .firstname
                                }
                            </KeyValueRow>
                          )}
                        <KeyValueRow label="Job Name">
                          {order.job_name || "—"}
                        </KeyValueRow>
                        {order.billing_details && (
                          <KeyValueRow label="Company Name">
                            {order.billing_details.company}
                          </KeyValueRow>
                        )}
                        <KeyValueRow label="Order Amount">
                          ${order.item_amount}
                        </KeyValueRow>
                        {order.shipping_method && (
                          <KeyValueRow label="Shipping Method">
                            {order.shipping_method.name}
                          </KeyValueRow>
                        )}
                        <OrderStatusBubble status={order.order_status} />
                        <div className="notes-container content-section">
                          <h4 className="section-title">Notes</h4>
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
                              <span className="compact-text">
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
                            <h4 className="section-title">Tracking</h4>
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
                  <div>
                    <h3 className="section-title">Line Items</h3>
                    <Accordion expandMode="multi">
                    {/* Display regular line items first */}
                    {order.order_lines
                      .filter(
                        (lineItem) =>
                          lineItem.fields && lineItem.fields.length > 0
                      )
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
                            {lineItem.fields &&
                              lineItem.fields.length > 0 &&
                              lineItem.fields[0].options &&
                              lineItem.fields[0].options.length > 0 && (
                                <div className="info-row">
                                  <span>SKU:</span>{" "}
                                  <span>
                                    {lineItem.fields[0].options[0].sku}
                                  </span>
                                </div>
                              )}
                            {lineItem.fields &&
                              lineItem.fields.map((field, fieldIndex) => (
                                <div key={fieldIndex} className="info-row">
                                  <span>Sizing:</span>
                                  <span>
                                    {field.options &&
                                      field.options
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
                    {/* Display freeform/custom products */}
                    {order.order_lines
                      .filter(
                        (lineItem) =>
                          lineItem.item_type === 25 &&
                          (!lineItem.fields || lineItem.fields.length === 0)
                      )
                      .map((lineItem, index) => (
                        <AccordionSection
                          key={index}
                          id={`freeform-item-${index}`}
                          title={`${lineItem.product_name}`}
                          className="line-item-freeform"
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
                                  lineItem.product_freeform_color ||
                                  "Custom"}
                              </span>
                            </div>
                            {lineItem.product_description && (
                              <div className="info-row">
                                <span>Decoration:</span>
                                <span>{lineItem.product_description}</span>
                              </div>
                            )}
                          </div>
                        </AccordionSection>
                      ))}
                    {/* Display extra charges (fees/setup costs) last */}
                    {order.order_lines
                      .filter((lineItem) => lineItem.item_type === 12)
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
                  </div>
                )}
                {selectedTab === "Billing & Shipping" && (
                  <div>
                    <h3 className="section-title">Billing & Shipping</h3>
                    {order.shipping_details && (
                      <div>
                        <div className="billing-phone">
                          <KeyValueRow label="Phone">
                            {order.shipping_details.ph_number}
                          </KeyValueRow>
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
                    <div>
                      <h3>Select Products for Vendor Order</h3>

                      {/* Global settings */}
                      <div className="vendor-panel">
                        <h4>Order Details</h4>
                        <div className="content-section">
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
                            className="input-compact"
                          />
                        </div>
                        <div className="content-section">
                          <label>Artwork Links:</label>
                          <div>
                            {order.notes.some(
                              (note) =>
                                extractDriveLinks(note.content).length > 0
                            ) ? (
                              order.notes.flatMap((note, noteIndex) =>
                                extractDriveLinks(note.content).map(
                                  (link, linkIndex) => (
                                    <div
                                      key={`${noteIndex}-${linkIndex}`}
                                    >
                                      <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="link-action"
                                      >
                                        {link.descriptor}
                                      </a>
                                    </div>
                                  )
                                )
                              )
                            ) : (
                              <span className="compact-text">
                                No drive links found in order notes
                              </span>
                            )}
                          </div>
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
                            className="textarea-compact"
                          />
                        </div>
                      </div>

                      {/* Product list - include both regular products and freeform products */}
                      {order.order_lines
                        .filter(
                          (lineItem) =>
                            // Include items with fields (regular products) OR item_type 25 (freeform/custom products)
                            (lineItem.fields && lineItem.fields.length > 0) ||
                            lineItem.item_type === 25
                        )
                        .map((lineItem) => (
                          <div
                            key={lineItem.id}
                            className="vendor-panel"
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
                              {!lineItem.product_code &&
                                lineItem.product_description && (
                                  <span
                                    style={{
                                      marginLeft: "10px",
                                      color: "#666",
                                      fontStyle: "italic",
                                    }}
                                  >
                                    {lineItem.product_description}
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

                                {/* Search buttons */}
                                <div style={{ marginBottom: "10px" }}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      searchDistributorCentral(
                                        lineItem.product_name,
                                        lineItem.product_code
                                      )
                                    }
                                    className="button-muted"
                                  >
                                    🔍 Search DistributorCentral
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      searchGoogle(
                                        lineItem.product_name,
                                        lineItem.product_code
                                      )
                                    }
                                    className="button-muted"
                                  >
                                    🔍 Search Google
                                  </button>
                                  {lineItem.attachment_urls &&
                                    lineItem.attachment_urls.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleAttachments(lineItem)
                                        }
                                        className="button-muted"
                                      >
                                        📎 Download Images (
                                        {lineItem.attachment_urls.length})
                                      </button>
                                    )}
                                </div>

                                {/* Size breakdown - only for items with fields */}
                                {lineItem.fields &&
                                  lineItem.fields.length > 0 &&
                                  lineItem.fields[0].options &&
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
                                    <label>Decoration PMS Colors:</label>
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
                                      className="input-compact"
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
                                      className="select-compact"
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
                                      className="select-compact"
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
                {selectedTab === "PDF Tools" && (
                  <div className="pdf-tools">
                    <div>
                      <h3>PDF Page Extraction</h3>
                      <p className="compact-text">
                        Extract specific pages from order PDFs. Enter page
                        numbers separated by commas (e.g., 1,3,5)
                      </p>

                      {/* Quote PDF */}
                      {order.quote_pdf_url && (
                        <div className="pdf-panel">
                          <h4>Quote PDF</h4>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              marginTop: "10px",
                            }}
                          >
                            <input
                              type="text"
                              value={pdfExtractionData.quote_pdf_pages}
                              onChange={(e) =>
                                handlePdfPageInputChange(
                                  "quote",
                                  e.target.value
                                )
                              }
                              placeholder="Page numbers (e.g., 1,3,5)"
                              className="input-compact"
                            />
                            <button
                              onClick={() =>
                                handlePdfPageExtraction(
                                  order.quote_pdf_url,
                                  "quote",
                                  order
                                )
                              }
                              disabled={pdfExtractionLoading.quote}
                              style={{
                                padding: "6px 12px",
                                backgroundColor: "#007cba",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: pdfExtractionLoading.quote
                                  ? "not-allowed"
                                  : "pointer",
                                opacity: pdfExtractionLoading.quote ? 0.6 : 1,
                              }}
                            >
                              {pdfExtractionLoading.quote
                                ? "Extracting..."
                                : "Extract Pages"}
                            </button>
                            <a
                              href={order.quote_pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link-action"
                            >
                              📄 View Full PDF
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Production PDF */}
                      {order.production_pdf_url && (
                        <div className="pdf-panel">
                          <h4>Production PDF</h4>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              marginTop: "10px",
                            }}
                          >
                            <input
                              type="text"
                              value={pdfExtractionData.production_pdf_pages}
                              onChange={(e) =>
                                handlePdfPageInputChange(
                                  "production",
                                  e.target.value
                                )
                              }
                              placeholder="Page numbers (e.g., 1,3,5)"
                              className="input-compact"
                            />
                            <button
                              onClick={() =>
                                handlePdfPageExtraction(
                                  order.production_pdf_url,
                                  "production",
                                  order
                                )
                              }
                              disabled={pdfExtractionLoading.production}
                              style={{
                                padding: "6px 12px",
                                backgroundColor: "#007cba",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: pdfExtractionLoading.production
                                  ? "not-allowed"
                                  : "pointer",
                                opacity: pdfExtractionLoading.production
                                  ? 0.6
                                  : 1,
                              }}
                            >
                              {pdfExtractionLoading.production
                                ? "Extracting..."
                                : "Extract Pages"}
                            </button>
                            <a
                              href={order.production_pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link-action"
                            >
                              📄 View Full PDF
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Order Proof PDF */}
                      {order.order_proof_pdf_url && (
                        <div className="pdf-panel">
                          <h4>Order Proof PDF</h4>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              marginTop: "10px",
                            }}
                          >
                            <input
                              type="text"
                              value={pdfExtractionData.proof_pdf_pages}
                              onChange={(e) =>
                                handlePdfPageInputChange(
                                  "proof",
                                  e.target.value
                                )
                              }
                              placeholder="Page numbers (e.g., 1,3,5)"
                              className="input-compact"
                            />
                            <button
                              onClick={() =>
                                handlePdfPageExtraction(
                                  order.order_proof_pdf_url,
                                  "proof",
                                  order
                                )
                              }
                              disabled={pdfExtractionLoading.proof}
                              style={{
                                padding: "6px 12px",
                                backgroundColor: "#007cba",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: pdfExtractionLoading.proof
                                  ? "not-allowed"
                                  : "pointer",
                                opacity: pdfExtractionLoading.proof ? 0.6 : 1,
                              }}
                            >
                              {pdfExtractionLoading.proof
                                ? "Extracting..."
                                : "Extract Pages"}
                            </button>
                            <a
                              href={order.order_proof_pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link-action"
                            >
                              📄 View Full PDF
                            </a>
                          </div>
                        </div>
                      )}

                      {!order.quote_pdf_url &&
                        !order.production_pdf_url &&
                        !order.order_proof_pdf_url && (
                          <div className="compact-text">
                            No PDF files available for this order
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>
              );
            })}
          </>
        )}
        <PluginFooter>
          {selectedTab === "Vendor Order" && (
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
