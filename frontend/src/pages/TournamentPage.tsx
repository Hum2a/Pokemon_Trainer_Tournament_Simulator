import { Settings } from "../components/Settings";
import { FileEditor } from "../components/FileEditor";
import { TeamBuilder } from "../components/TeamBuilder";
import { Actions } from "../components/Actions";
import { Log } from "../components/Log";
import { Outputs } from "../components/Outputs";

export function TournamentPage() {
  return (
    <main className="space-y-0">
      <Settings />
      <FileEditor />
      <TeamBuilder />
      <Actions />
      <Log />
      <Outputs />
    </main>
  );
}
