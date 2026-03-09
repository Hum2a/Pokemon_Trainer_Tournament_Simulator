# Contributing to Pokemon Trainer Tournament Simulator

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. **Fork and clone** the repository:
   ```bash
   git clone --recursive https://github.com/cRz-Shadows/Pokemon_Trainer_Tournament_Simulator.git
   cd Pokemon_Trainer_Tournament_Simulator
   ```

2. **Set up the environment** (see [README.md](README.md#requirements)):
   - Python 3.10+ with `pip install -r requirements.txt`
   - Node.js 20+ for frontend and Pokemon Showdown
   - Build Pokemon Showdown: `cd pokemon-showdown && npm install && node build`
   - Build frontend: `cd frontend && npm install && npm run build`

3. **Run development mode**:
   ```bash
   npm run dev
   ```
   This starts Flask (port 5000) and Vite (port 5173) concurrently.

4. **Optional**: Install [pre-commit](https://pre-commit.com/) for automatic linting:
   ```bash
   pip install pre-commit && pre-commit install
   ```
   Use `make install` for a one-command full setup (requires Make).

## Code Style

- **Python**: PEP 8, max line 100. Use type hints for public functions. See `.cursor/rules/python-backend.mdc`.
- **TypeScript/React**: 2-space indent, camelCase for variables/functions, PascalCase for components. See `.cursor/rules/frontend-react.mdc`.
- **Security**: Use `src/security.py` helpers for path validation and config validation. Never bypass these.

## Project Structure

- `app.py` – Flask entry point
- `src/` – Backend (config, security, services, routes)
- `frontend/` – React + Vite + Tailwind SPA
- `Data/` – Simulation scripts, inputs, outputs
- `pokemon-showdown/` – Modified sim submodule (do not modify except for documented changes)

## Submitting Changes

1. Create a branch for your feature or bugfix: `git checkout -b feature/your-feature-name`
2. Make your changes, following the code style above.
3. Test locally: run the Web UI and any affected flows.
4. Commit with clear messages: `git commit -m "Add short description"`
5. Push and open a Pull Request against `main`.
6. Fill out the PR template. Link related issues if applicable.

## Pull Request Guidelines

- Keep PRs focused and reasonably sized.
- Ensure CI passes (Python + Node build, frontend build).
- Update documentation if you change behavior or add features.
- Do not introduce breaking changes to existing APIs or config without updating consumers.

## Reporting Bugs

Use the [Bug Report](https://github.com/cRz-Shadows/Pokemon_Trainer_Tournament_Simulator/issues/new?template=bug_report.md) template. Include:

- OS, Python version, Node version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots or logs if relevant

## Feature Requests

Use the [Feature Request](https://github.com/cRz-Shadows/Pokemon_Trainer_Tournament_Simulator/issues/new?template=feature_request.md) template. Describe the problem and proposed solution clearly.

## Questions?

- **Discord**: https://discord.gg/Wupx8tHRVS
- **Reddit**: https://www.reddit.com/r/PokemonLegacy

Thank you for contributing!
