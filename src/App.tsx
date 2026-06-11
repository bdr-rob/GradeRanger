import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";


// Public pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import AuthCallback from "./pages/AuthCallback";
import ResetPassword from "./pages/ResetPassword";
import AccountDeletion from '@/pages/AccountDeletion';

// Protected pages
import UserDashboard from "./pages/UserDashboard";
import Profile from "./pages/Profile";
import Watchlist from "./pages/Watchlist";
import SavedSearches from "./pages/SavedSearches";
import Settings from "./pages/Settings";

// Portal
import PortalAuthGate from "./components/portal/PortalAuthGate";
import PortalHome from "./pages/portal/PortalHome";
import GradingDecisionsPage from "./pages/portal/GradingDecisionsPage";
import CardIntake from "./pages/portal/CardIntake";
import CardDetail from "./pages/portal/CardDetail";
import ListingsDashboard from "./pages/portal/ListingsDashboard";
import Admin from "./pages/portal/Admin";
import PortalPortfolio from "./pages/portal/PortalPortfolio";


const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="light">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/auth/reset-password" element={<ResetPassword />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/account/delete" element={<AccountDeletion />} />

              {/* Protected — standalone pages */}
              <Route path="/dashboard" element={
                <ProtectedRoute><UserDashboard /></ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute><Profile /></ProtectedRoute>
              } />
              <Route path="/watchlist" element={
                <ProtectedRoute><Watchlist /></ProtectedRoute>
              } />
              <Route path="/saved-searches" element={
                <ProtectedRoute><SavedSearches /></ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute><Settings /></ProtectedRoute>
              } />

              {/* Portal — all nested under auth gate + portal layout */}
              <Route path="/portal" element={<PortalAuthGate />}>
                <Route index element={<PortalHome />} />
                <Route path="intake" element={<CardIntake />} />
                <Route path="cards/:id" element={<CardDetail />} />
                <Route path="grading" element={<GradingDecisionsPage />} />
                <Route path="listings" element={<ListingsDashboard />} />
                <Route path="portfolio" element={<PortalPortfolio />} />
                <Route path="admin" element={<Admin />} />
                
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
