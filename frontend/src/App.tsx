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
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--text-muted)] truncate max-w-[100px]" title={user.email ?? ""}>
          {user.email}
        </span>
        <button
          onClick={() => signOut()}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
        >
          Sign out
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onSignInClick}
      className="text-sm text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
    >
      Sign in
    </button>
  );
}

function AppContent() {
  const { status, modal, hideModal } = useApp();
  const { user } = useAuth();
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
          <header className="flex items-center justify-between mb-8 pb-6 border-b border-[var(--border)] backdrop-blur-sm">
            <div className="flex items-center gap-6">
              <NavLink to="/" className="text-2xl font-display font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[var(--accent)] via-[var(--primary)] to-[var(--amber)] no-underline">
                Pokemon Battle Simulator
              </NavLink>
              <nav className="flex gap-2">
                <NavLink
                  to="/simulations"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5"
                    }`
                  }
                >
                  My Simulations
                </NavLink>
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5"
                    }`
                  }
                >
                  Matchup Simulator
                </NavLink>
                <NavLink
                  to="/tournament"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5"
                    }`
                  }
                >
                  Trainer Tournament
                </NavLink>
                <NavLink
                  to="/upload-results"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5"
                    }`
                  }
                >
                  Upload Results
                </NavLink>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-[var(--bg-panel)] border border-[var(--border)]">
                <span className={`w-3 h-3 rounded-full ${status.running ? "bg-[var(--accent)]" : "bg-[var(--success)]"}`} />
                <span className="text-sm font-medium">{status.text}</span>
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
