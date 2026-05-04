import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { FrontContextProvider } from "./providers/frontContext";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <FrontContextProvider>
      <App />
    </FrontContextProvider>
  </React.StrictMode>
);
