import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppProvider, useApp } from "./context/AppContext";
import { Modal } from "./components/Modal";
import { AuthModal } from "./components/AuthModal";
import { OpenAuthModalContext } from "./context/AuthModalContext";
import { TournamentPage } from "./pages/TournamentPage";
import { MatchupSimulatorPage } from "./pages/MatchupSimulatorPage";
import { MySimulationsPage } from "./pages/MySimulationsPage";
import { UploadResultsPage } from "./pages/UploadResultsPage";
import { AdminPanelPage } from "./pages/AdminPanelPage";
import { PokedexPage } from "./pages/PokedexPage";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

function UserMenu({ onSignInClick }: { onSignInClick: () => void }) {
  const { user, signOut } = useAuth();
  if (user) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <span
          className="text-xs text-[var(--text-muted)] truncate max-w-[120px] sm:max-w-[140px]"
          title={user.email ?? ""}
        >
          {user.email}
        </span>
        <button
          onClick={() => signOut()}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors whitespace-nowrap"
        >
          Sign out
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onSignInClick}
      className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
    >
      Sign in
    </button>
  );
}

function AppContent() {
  const { status, modal, hideModal } = useApp();
  const { role } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  return (
    <OpenAuthModalContext.Provider value={() => setAuthModalOpen(true)}>
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => setAuthModalOpen(false)}
      />
      {modal && (
        <Modal
          isOpen
          onClose={hideModal}
          onConfirm={modal.onConfirm}
          title={modal.title}
          message={modal.message}
          confirmLabel={modal.confirmLabel}
          cancelLabel={modal.cancelLabel}
          variant={modal.variant}
          alertOnly={modal.alertOnly}
        />
      )}
      <BrowserRouter>
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-[1000px] mx-auto"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <header className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-[var(--border)] backdrop-blur-sm">
            <div className="flex items-center gap-4 min-w-0 shrink">
              <NavLink
                to="/"
                className="text-xl sm:text-2xl font-display font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[var(--accent)] via-[var(--primary)] to-[var(--amber)] no-underline whitespace-nowrap shrink-0"
              >
                Pokemon Battle Simulator
              </NavLink>
              <nav className="flex items-center gap-1 flex-wrap">
                <NavLink
                  to="/simulations"
                  className={({ isActive }) =>
                    `px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5"
                    }`
                  }
                >
                  Simulations
                </NavLink>
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5"
                    }`
                  }
                >
                  Matchup
                </NavLink>
                <NavLink
                  to="/tournament"
                  className={({ isActive }) =>
                    `px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5"
                    }`
                  }
                >
                  Tournament
                </NavLink>
                <NavLink
                  to="/upload-results"
                  className={({ isActive }) =>
                    `px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5"
                    }`
                  }
                >
                  Upload
                </NavLink>
                <NavLink
                  to="/pokedex"
                  className={({ isActive }) =>
                    `px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5"
                    }`
                  }
                >
                  Pokedex
                </NavLink>
                {(role === "admin" || role === "developer") && (
                  <NavLink
                    to="/admin"
                    className={({ isActive }) =>
                      `px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5"
                      }`
                    }
                  >
                    Admin
                  </NavLink>
                )}
              </nav>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-[var(--bg-panel)] border border-[var(--border)]">
                <span className={`w-2 h-2 rounded-full shrink-0 ${status.running ? "bg-[var(--accent)]" : "bg-[var(--success)]"}`} />
                <span className="text-xs font-medium">{status.text}</span>
              </div>
              <UserMenu onSignInClick={() => setAuthModalOpen(true)} />
            </div>
          </header>
            <main>
              <Routes>
                <Route path="/" element={<MatchupSimulatorPage />} />
                <Route path="/tournament" element={<TournamentPage />} />
                <Route path="/simulations" element={<MySimulationsPage />} />
                <Route path="/upload-results" element={<UploadResultsPage />} />
                <Route path="/admin" element={<AdminPanelPage />} />
                <Route path="/pokedex" element={<PokedexPage />} />
              </Routes>
            </main>
          </motion.div>
        </div>
      </BrowserRouter>
    </OpenAuthModalContext.Provider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}
