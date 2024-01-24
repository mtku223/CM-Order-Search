import PropTypes from "prop-types";

// OrderStatusBubble.js
const statusColors = {
  1: "#ffd700", // Ready for Production - Gold
  2: "#87ceeb", // Ready for Shipping - SkyBlue
  3: "#32cd32", // Shipped - LimeGreen
  4: "#ff4500", // Cancelled - OrangeRed
  6: "#808080", // Deleted - Grey
  7: "#ff69b4", // On Hold / Not Approved - HotPink
  8: "#00bfff", // Awaiting Purchase Order - DeepSkyBlue
  9: "#ffa500", // Awaiting Stock - Orange
  10: "#6a5acd", // Awaiting Artwork - SlateBlue
};

const statusText = {
  1: "Ready for Production",
  2: "Ready for Shipping",
  3: "Shipped",
  4: "Cancelled",
  6: "Deleted",
  7: "Not Approved / On Hold",
  8: "Awaiting Purchase Order",
  9: "Items Ordered Awaiting Stock",
  10: "Awaiting Artwork",
};

const OrderStatusBubble = ({ status }) => {
  const bubbleStyle = {
    display: "inline-block",
    padding: "0.25em 0.6em",
    fontSize: "75%",
    fontWeight: "700",
    lineHeight: "1",
    textAlign: "center",
    whiteSpace: "nowrap",
    verticalAlign: "baseline",
    borderRadius: "0.375em",
    color: "white",
    backgroundColor: statusColors[status] || "#000", // Fallback color
  };

  return (
    <div style={bubbleStyle}>
      {statusText[status] || "Unknown Status"} ({status})
    </div>
  );
};

OrderStatusBubble.propTypes = {
  status: PropTypes.number.isRequired,
};

export default OrderStatusBubble;
