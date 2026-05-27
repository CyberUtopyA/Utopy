import React from "react";
import { Outlet } from "react-router-dom";
import MarketFalconSwitch from "./Marketfalconslide";

export default function AppShell() {
  return (
    <div className="min-h-screen">
      <Outlet />
      <MarketFalconSwitch />
    </div>
  );
}