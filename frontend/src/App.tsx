import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Overview from "./pages/Overview";
import WarehouseEnvironment from "./pages/WarehouseEnvironment";
import ForkliftMonitor from "./pages/ForkliftMonitor";
import InventoryManagement from "./pages/InventoryManagement";
import PathTracking from "./pages/PathTracking";
import RealAlerts from "./pages/RealAlerts";
import RSSIMonitoring from "./pages/RSSIMonitoring";
import WarehouseLayoutReal from "./pages/WarehouseLayoutReal";
import NotFound from "./pages/NotFound";

// Optimized for Raspberry Pi - longer cache, no retries
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      gcTime: 300000, // 5 minutes
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delayDuration={700}>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/environment" element={<WarehouseEnvironment />} />
          <Route path="/forklifts" element={<ForkliftMonitor />} />
          <Route path="/inventory" element={<InventoryManagement />} />
          <Route path="/tracking" element={<PathTracking />} />
          <Route path="/alerts" element={<RealAlerts />} />
          <Route path="/rssi" element={<RSSIMonitoring />} />
          <Route path="/warehouse" element={<WarehouseLayoutReal />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
