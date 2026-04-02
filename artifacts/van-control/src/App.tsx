import { Switch, Route, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import Dashboard from "@/pages/Dashboard";
import Lighting from "@/pages/Lighting";
import Power from "@/pages/Power";
import Climate from "@/pages/Climate";
import { SimulationProvider } from "@/hooks/useSimulatedData";
import { HardwareProvider } from "@/hooks/useHardware";
import { IdleOverlay } from "@/components/IdleOverlay";
import { VanNameContext, useVanNameState } from "@/hooks/useVanName";

const isFileProtocol =
  typeof window !== "undefined" && window.location.protocol === "file:";

function Routes() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/lighting" component={Lighting} />
      <Route path="/power" component={Power} />
      <Route path="/climate" component={Climate} />
      <Route>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Not Found
        </div>
      </Route>
    </Switch>
  );
}

function AppShell() {
  const vanNameValue = useVanNameState();

  return (
    <VanNameContext.Provider value={vanNameValue}>
      {isFileProtocol ? (
        <WouterRouter hook={useHashLocation}>
          <div className="w-screen h-screen overflow-hidden bg-background text-foreground flex flex-col relative font-sans">
            <TopBar />
            <main className="flex-1 relative overflow-hidden px-5 pt-3">
              <Routes />
            </main>
            <BottomNav />
            <IdleOverlay />
          </div>
        </WouterRouter>
      ) : (
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""}>
          <div className="w-screen h-screen min-w-[1024px] min-h-[600px] overflow-hidden bg-background text-foreground flex flex-col mx-auto relative font-sans">
            <TopBar />
            <main className="flex-1 relative overflow-hidden px-5 pt-3">
              <Routes />
            </main>
            <BottomNav />
            <IdleOverlay />
          </div>
        </WouterRouter>
      )}
    </VanNameContext.Provider>
  );
}

function App() {
  return (
    <HardwareProvider>
      <SimulationProvider>
        <AppShell />
      </SimulationProvider>
    </HardwareProvider>
  );
}

export default App;
