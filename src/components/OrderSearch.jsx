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
import ReactGA from "react-ga4";

function OrderSearch() {
  const context = useFrontContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [orderData, setOrderData] = useState(null);
  const [latestMessageId, setLatestMessageId] = useState(undefined);

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

  useEffect(() => {
    ReactGA.send({ hitType: "pageview", page: window.location.pathname });
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault(); // Prevent the default form submit action

    let modifiedSearchTerm = searchTerm;
    setSelectedTab("Order Info");
    if (!searchTerm.toLowerCase().startsWith("order-")) {
      modifiedSearchTerm = "Order-" + searchTerm;
    }

    const serverUrl = `/.netlify/functions/search?searchTerm=${encodeURIComponent(
      modifiedSearchTerm
    )}`;

    ReactGA.event({
      category: "Search",
      action: "Performed a search",
      label: searchTerm,
      nonInteraction: true,
      dimension1: context.teammate ? context.teammate.id : "anonymous", // Example
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

  const onCreateDraftClick = () => {
    if (!latestMessageId) return;

    const messageBody = `
        Hey Team,
    
        We are sending this project over.
    
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
  const tabs = ["Order Info", "Line Items", "Billing & Shipping"];

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
        </PluginFooter>
      </div>
    </PluginLayout>
  );
}

export default OrderSearch;
