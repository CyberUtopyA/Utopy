import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import AppRecoveryBoundary from './components/AppRecoveryBoundary';
import "./index.css";
import "./components/utopyUI.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppRecoveryBoundary><App /></AppRecoveryBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
