import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initNativeHttpBridge } from "./nativeHttp";

// Bypass WebView CORS on native Android/iOS by routing external API calls through native HTTP
initNativeHttpBridge();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
