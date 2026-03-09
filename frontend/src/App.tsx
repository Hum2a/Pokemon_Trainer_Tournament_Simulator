import { AppProvider } from "./context/AppContext";
import { Header } from "./components/Header";
import { Settings } from "./components/Settings";
import { FileEditor } from "./components/FileEditor";
import { TeamBuilder } from "./components/TeamBuilder";
import { Actions } from "./components/Actions";
import { Log } from "./components/Log";
import { Outputs } from "./components/Outputs";

export default function App() {
  return (
    <AppProvider>
      <div className="max-w-[960px] mx-auto p-6">
        <Header />
        <main className="space-y-0">
          <Settings />
          <FileEditor />
          <TeamBuilder />
          <Actions />
          <Log />
          <Outputs />
        </main>
      </div>
    </AppProvider>
  );
}
