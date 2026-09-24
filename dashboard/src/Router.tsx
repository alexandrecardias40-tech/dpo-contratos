import { Route, Switch, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import App from "./App";
import GraficosPage from "./GraficosPage";
import ComparativosPage from "./ComparativosPage";
import LandingPage from "./LandingPage";
import SimulatorPage from "./SimulatorPage";

export default function Router() {
  return (
    <WouterRouter hook={useHashLocation}>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/dashboard" component={App} />
        <Route path="/graficos" component={GraficosPage} />
        <Route path="/comparisons" component={ComparativosPage} />
        <Route path="/simulador" component={SimulatorPage} />
        <Route component={LandingPage} />
      </Switch>
    </WouterRouter>
  );
}
