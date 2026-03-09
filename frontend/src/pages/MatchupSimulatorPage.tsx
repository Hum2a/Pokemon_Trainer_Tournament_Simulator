import { MatchupSimulator } from "../components/MatchupSimulator";
import { Log } from "../components/Log";
import { Outputs } from "../components/Outputs";

export function MatchupSimulatorPage() {
  return (
    <main className="space-y-0">
      <MatchupSimulator />
      <Log />
      <Outputs />
    </main>
  );
}
