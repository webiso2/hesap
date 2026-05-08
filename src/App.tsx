import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import TrackingPage from "./pages/TrackingPage";

import { queryClient } from "@/lib/react-query";


import { useEffect } from "react";
import { getSettings } from "@/utils/settingsUtils";

const App = () => {
  useEffect(() => {
    const applyTheme = () => {
      const settings = getSettings();
      const theme = settings.theme || 'modern-dark';
      document.body.className = `theme-${theme}`;
    };

    applyTheme(); // Initial application

    window.addEventListener('settings-updated', applyTheme);
    return () => window.removeEventListener('settings-updated', applyTheme);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Ana Sayfa (Yönetim Paneli) */}
            <Route path="/" element={<Index />} />

            {/* Müşteri Takip Ekranı (Herkese Açık) */}
            <Route path="/takip" element={<TrackingPage />} />

            {/* Bulunamayan Sayfalar */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;