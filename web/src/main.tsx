import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { SolidclawApp } from "./solidclaw-app";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <SolidclawApp />
    </React.StrictMode>
  );
}
