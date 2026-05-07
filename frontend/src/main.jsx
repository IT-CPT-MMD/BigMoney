import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);

// Load the existing business logic after React has mounted the same DOM IDs/classes.
setTimeout(() => {
  import("./legacyApp.js").catch((error) => {
    console.error("BM Core legacy logic failed to load", error);
  });
}, 0);
