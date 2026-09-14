import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import Blog from "./pages/Blog";
import BlogArticle from "./pages/BlogArticle";
import AdminLogin from "./pages/AdminLogin";
import AdminRegister from "./pages/AdminRegister";
import AdminResetPassword from "./pages/AdminResetPassword";
import AuthSSO from "./pages/AuthSSO";
import AdminArticles from "./pages/AdminArticles";
import AdminArticleEditor from "./pages/AdminArticleEditor";
import AdminCategories from "./pages/AdminCategories";
import AdminNewsletter from "./pages/AdminNewsletter";
import AdminUsers from "./pages/AdminUsers";
import AppLayout from "./pages/AppLayout";
import MarketingDashboard from "./pages/MarketingDashboard";
import PostsList from "./pages/PostsList";
import PostNew from "./pages/PostNew";
import PostEdit from "./pages/PostEdit";
import PostReview from "./pages/PostReview";
import Calendar from "./pages/Calendar";
import Analytics from "./pages/Analytics";
import AIInsights from "./pages/AIInsights";
import Gallery from "./pages/Gallery";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";
import AgendaEditorial from "./pages/AgendaEditorial";
import ProtectedRoute from "./components/ProtectedRoute";
import ExternalReview from "./pages/ExternalReview";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogArticle />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/register" element={<AdminRegister />} />
                <Route path="/admin/reset-password" element={<AdminResetPassword />} />
                <Route path="/auth/sso" element={<AuthSSO />} />
                
                {/* Redirects from old /admin routes */}
                <Route path="/admin" element={<Navigate to="/app" replace />} />
                <Route path="/admin/articles" element={<Navigate to="/app/articles" replace />} />
                <Route path="/admin/articles/:id" element={<Navigate to="/app/articles/:id" replace />} />
                <Route path="/admin/categories" element={<Navigate to="/app/categories" replace />} />
                <Route path="/admin/newsletter" element={<Navigate to="/app/newsletter" replace />} />
                
                {/* Protected App Routes - requires auth + admin role */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/app" element={<AppLayout />}>
                    {/* Marketing */}
                    <Route index element={<MarketingDashboard />} />
                    <Route path="posts" element={<PostsList />} />
                    <Route path="posts/new" element={<PostNew />} />
                    <Route path="posts/:id" element={<PostEdit />} />
                    <Route path="posts/:id/review" element={<PostReview />} />
                    <Route path="calendar" element={<Calendar />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="ai-insights" element={<AIInsights />} />
                    <Route path="gallery" element={<Gallery />} />
                    <Route path="agenda-editorial" element={<AgendaEditorial />} />
                    
                    {/* Blog */}
                    <Route path="articles" element={<AdminArticles />} />
                    <Route path="articles/:id" element={<AdminArticleEditor />} />
                    <Route path="categories" element={<AdminCategories />} />
                    
                    {/* Newsletter */}
                    <Route path="newsletter" element={<AdminNewsletter />} />
                    
                    {/* Users */}
                    <Route path="users" element={<AdminUsers />} />
                    
                    {/* Settings */}
                    <Route path="settings" element={<Settings />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="account" element={<Account />} />
                  </Route>
                </Route>
                
                <Route path="/approve/:token" element={<ExternalReview />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </HelmetProvider>
);

export default App;
