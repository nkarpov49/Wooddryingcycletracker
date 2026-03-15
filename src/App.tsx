import React from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import ServerHealthCheck from "./components/ServerHealthCheck";
import PasswordGate from "./components/PasswordGate";

export default function App() {
  return (
    <PasswordGate>
      <ServerHealthCheck>
        <RouterProvider router={router} />
      </ServerHealthCheck>
    </PasswordGate>
  );
}