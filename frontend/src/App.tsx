import { motion } from "framer-motion";
import { AppProvider } from "./context/AppContext";
import { Header } from "./components/Header";
import { Settings } from "./components/Settings";
import { FileEditor } from "./components/FileEditor";
import { TeamBuilder } from "./components/TeamBuilder";
import { Actions } from "./components/Actions";
import { Log } from "./components/Log";
import { Outputs } from "./components/Outputs";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function App() {
  return (
    <AppProvider>
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-[1000px] mx-auto"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={item}>
            <Header />
          </motion.div>
          <main className="space-y-0 mt-2">
            <motion.div variants={item}><Settings /></motion.div>
            <motion.div variants={item}><FileEditor /></motion.div>
            <motion.div variants={item}><TeamBuilder /></motion.div>
            <motion.div variants={item}><Actions /></motion.div>
            <motion.div variants={item}><Log /></motion.div>
            <motion.div variants={item}><Outputs /></motion.div>
          </main>
        </motion.div>
      </div>
    </AppProvider>
  );
}
