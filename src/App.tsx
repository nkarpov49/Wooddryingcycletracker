import React from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import ServerHealthCheck from "./components/ServerHealthCheck";

export default function App() {
  return (
    <ServerHealthCheck>
      <RouterProvider router={router} />
    </ServerHealthCheck>
  );
}