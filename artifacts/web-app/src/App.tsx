import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { ArrowRight, Code2, Cpu, Database, Blocks, TerminalSquare, Github, LayoutTemplate, Layers, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient();

function Home() {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[60%] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute top-[20%] left-[60%] w-[30%] h-[30%] rounded-full bg-primary/5 blur-[80px]" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto px-6 py-20 w-full relative z-10">
        <div className="w-full flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
          
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-medium mb-8">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Workspace Ready
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6 font-sans">
            Your new <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">React</span> stack
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-12">
            A production-ready foundation built with modern tools. Scalable, type-safe, and designed for developer happiness. Start building your next idea.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl mb-16">
            {[
              { label: "React 19", icon: <Layers className="w-5 h-5" /> },
              { label: "TypeScript", icon: <Code2 className="w-5 h-5" /> },
              { label: "Tailwind CSS", icon: <LayoutTemplate className="w-5 h-5" /> },
              { label: "Vite", icon: <Cpu className="w-5 h-5" /> }
            ].map((stack, i) => (
              <div 
                key={stack.label} 
                className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card shadow-sm hover-elevate transition-all duration-300 animate-in fade-in zoom-in-95 fill-mode-both"
                style={{ animationDelay: `${200 + i * 100}ms` }}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  {stack.icon}
                </div>
                <span className="font-semibold text-sm">{stack.label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500 fill-mode-both">
            <Button size="lg" className="h-12 px-8 rounded-full gap-2 text-base shadow-lg shadow-primary/20">
              <TerminalSquare className="w-5 h-5" />
              Open Terminal
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 rounded-full gap-2 text-base bg-background/50 backdrop-blur-sm">
              <Database className="w-5 h-5" />
              Database Schema
            </Button>
          </div>
        </div>

        <div className="mt-24 w-full grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-700 fill-mode-both">
          <div className="p-6 rounded-2xl border border-border bg-card/50 backdrop-blur-md">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Configured & Ready
            </h3>
            <ul className="space-y-3 text-muted-foreground text-sm mt-4 font-mono">
              <li className="flex items-center gap-3"><span className="text-primary">→</span> API Client & Zod Schemas</li>
              <li className="flex items-center gap-3"><span className="text-primary">→</span> Drizzle ORM Setup</li>
              <li className="flex items-center gap-3"><span className="text-primary">→</span> Shadcn UI Components</li>
              <li className="flex items-center gap-3"><span className="text-primary">→</span> React Query configured</li>
            </ul>
          </div>
          
          <div className="p-6 rounded-2xl border border-border bg-card/50 backdrop-blur-md">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Blocks className="w-5 h-5 text-primary" />
              Next Steps
            </h3>
            <ul className="space-y-3 text-muted-foreground text-sm mt-4">
              <li className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span> Define your schema in <code className="text-xs bg-muted px-1.5 py-0.5 rounded">lib/db/src/schema</code></li>
              <li className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</span> Build routes in <code className="text-xs bg-muted px-1.5 py-0.5 rounded">artifacts/api-server</code></li>
              <li className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</span> Generate API client hooks</li>
              <li className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">4</span> Build UI in <code className="text-xs bg-muted px-1.5 py-0.5 rounded">artifacts/web-app</code></li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
