import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import RequireAuth from "./components/RequireAuth";
import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import LeagueDetail from "./pages/LeagueDetail";
import Join from "./pages/Join";
import ImportSleeper from "./pages/ImportSleeper";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RequireAuth><Layout><Index /></Layout></RequireAuth>} />
            <Route path="/leagues/:id" element={<RequireAuth><Layout><LeagueDetail /></Layout></RequireAuth>} />
            <Route path="/join" element={<RequireAuth><Layout><Join /></Layout></RequireAuth>} />
            <Route path="/import/sleeper" element={<RequireAuth><Layout><ImportSleeper /></Layout></RequireAuth>} />
            <Route path="/auth" element={<Auth />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
