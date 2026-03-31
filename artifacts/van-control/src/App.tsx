import { Switch, Route, Router as WouterRouter } from "wouter";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import Dashboard from "@/pages/Dashboard";
import Lighting from "@/pages/Lighting";
import Power from "@/pages/Power";
import Climate from "@/pages/Climate";
import { SimulationProvider } from "@/hooks/useSimulatedData";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/lighting" component={Lighting} />
      <Route path="/power" component={Power} />
      <Route path="/climate" component={Climate} />
      <Route>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Not Found</div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <SimulationProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        {/* Fullscreen app container sized exactly to 1024x600 for Raspberry Pi 7" display */}
        <div className="w-screen h-screen min-w-[1024px] min-h-[600px] max-w-[1024px] max-h-[600px] overflow-hidden bg-background text-foreground flex flex-col mx-auto shadow-2xl relative font-sans">
          <TopBar />
          
          <main className="flex-1 relative overflow-y-auto no-scrollbar pb-24 px-6 pt-4">
            <Router />
          </main>

          <BottomNav />
        </div>
      </WouterRouter>
    </SimulationProvider>
  );
}

export default App;
