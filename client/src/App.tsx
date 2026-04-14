import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/lib/auth";
import Home from "@/pages/Home";
import CreatePersona from "@/pages/CreatePersona";
import PersonaDashboard from "@/pages/PersonaDashboard";
import MemoryIntake from "@/pages/MemoryIntake";
import Chat from "@/pages/Chat";
import Interview from "@/pages/Interview";
import LifeStory from "@/pages/LifeStory";
import EditPersona from "@/pages/EditPersona";
import JoinEcho from "@/pages/JoinEcho";
import Contribute from "@/pages/Contribute";
import ContributorSettings from "@/pages/ContributorSettings";
import Milestones from "@/pages/Milestones";
import FamilySharing from "@/pages/FamilySharing";
import Journal from "@/pages/Journal";
import DocumentLibrary from "@/pages/DocumentLibrary";
import UploadGuidance from "@/pages/UploadGuidance";
import Pricing from "@/pages/Pricing";
import Account from "@/pages/Account";
import Reactivate from "@/pages/Reactivate";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Faq from "@/pages/Faq";
import NotFound from "@/pages/not-found";

// Redirect to login if not authenticated, or to reactivate if cancelled
function ProtectedRoute({ component: Component, allowCancelled }: { component: React.ComponentType<any>; allowCancelled?: boolean }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  // Redirect cancelled users to reactivation page
  if (user.status === "cancelled" && !allowCancelled) {
    navigate("/reactivate");
    return null;
  }

  return <Component />;
}

function AppRoutes() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        {/* Public routes */}
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/faq" component={Faq} />
        <Route path="/join" component={JoinEcho} />
        <Route path="/persona/:id/chat" component={Chat} />
        <Route path="/persona/:id/contribute" component={Contribute} />
        <Route path="/persona/:id/contributor-settings" component={ContributorSettings} />

        {/* Protected routes */}
        <Route path="/">{() => <ProtectedRoute component={Home} />}</Route>
        <Route path="/create">{() => <ProtectedRoute component={CreatePersona} />}</Route>
        <Route path="/persona/:id">{() => <ProtectedRoute component={PersonaDashboard} />}</Route>
        <Route path="/persona/:id/memories">{() => <ProtectedRoute component={MemoryIntake} />}</Route>
        <Route path="/persona/:id/upload-guidance">{() => <ProtectedRoute component={UploadGuidance} />}</Route>
        <Route path="/persona/:id/interview">{() => <ProtectedRoute component={Interview} />}</Route>
        <Route path="/persona/:id/life-story">{() => <ProtectedRoute component={LifeStory} />}</Route>
        <Route path="/persona/:id/edit">{() => <ProtectedRoute component={EditPersona} />}</Route>
        <Route path="/persona/:id/milestones">{() => <ProtectedRoute component={Milestones} />}</Route>
        <Route path="/persona/:id/family">{() => <ProtectedRoute component={FamilySharing} />}</Route>
        <Route path="/persona/:id/journal">{() => <ProtectedRoute component={Journal} />}</Route>
        <Route path="/persona/:id/documents">{() => <ProtectedRoute component={DocumentLibrary} />}</Route>
        <Route path="/account">{() => <ProtectedRoute component={Account} />}</Route>
        <Route path="/reactivate">{() => <ProtectedRoute component={Reactivate} allowCancelled />}</Route>

        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
