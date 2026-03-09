/**
 * Pokemon Battle Simulator - Main entry point
 */

const App = {
  init() {
    Logger.init();

    document.querySelectorAll('[data-toggle]').forEach(el => {
      el.addEventListener('click', () => {
        const panel = el.closest('.panel');
        if (panel) panel.classList.toggle('collapsed');
      });
    });

    Config.load();
    FileEditor.init();
    Actions.init();
    Outputs.init();
    TeamBuilder.init();
    Outputs.refresh();
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
