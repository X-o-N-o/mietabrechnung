import "@fontsource-variable/inter";
import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Route, Router, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "@/lib/api";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import CostsPage from "@/pages/costs";
import RentPage from "@/pages/rent";
import StatsPage from "@/pages/stats";
import SettlementPage from "@/pages/settlement";
import SettingsPage from "@/pages/settings";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Hash-Routing: funktioniert ohne Server-Konfiguration hinter dem HA-Ingress */}
      <Router hook={useHashLocation}>
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/nebenkosten" component={CostsPage} />
            <Route path="/miete" component={RentPage} />
            <Route path="/statistik" component={StatsPage} />
            <Route path="/endabrechnung" component={SettlementPage} />
            <Route path="/einstellungen" component={SettingsPage} />
            <Route component={Dashboard} />
          </Switch>
        </Layout>
      </Router>
      <Toaster
        position="top-center"
        toastOptions={{
          className: "!bg-raised !text-fg !border-line !rounded-xl !font-sans",
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
);
