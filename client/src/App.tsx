import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Home from "@/pages/Home";
import CreatePersona from "@/pages/CreatePersona";
import PersonaDashboard from "@/pages/PersonaDashboard";
import MemoryIntake from "@/pages/MemoryIntake";
import Chat from "@/pages/Chat";
import NotFound from "@/pages/not-found";

function AppRoutes() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/create" component={CreatePersona} />
        <Route path="/persona/:id" component={PersonaDashboard} />
        <Route path="/persona/:id/memories" component={MemoryIntake} />
        <Route path="/persona/:id/chat" component={Chat} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
      <Toaster />
    </QueryClientProvider>
  );
}
