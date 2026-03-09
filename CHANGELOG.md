# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Professional repository setup: LICENSE, CONTRIBUTING.md, CODE_OF_CONDUCT.md
- GitHub Actions CI workflow (Python 3.10–3.12, Node 20/22)
- Issue templates (bug report, feature request)
- Pull request template
- Dependabot configuration for pip, npm, GitHub Actions
- SECURITY.md for vulnerability reporting
- .editorconfig for consistent formatting
- pyproject.toml for Python project metadata

## [1.0.0] - 2024

### Added

- Web UI for running simulations (Flask + React + Vite + Tailwind)
- Matchup Simulator: head-to-head and matrix modes for 1v1 Pokemon battles
- Pool filters: evolution stage, type, category, region, BST, role, tags, etc.
- Smogon presets support (gen9ou, gen9uu, etc.)
- Matchup Analytics: win rates, dominance scores, heatmaps, searchable matchup table
- Trainer Tournament: build battles from team files, run simulations, parse to PNG/CSV
- Team Builder with dex data fetch
- File Editor and Settings panel
- Outputs panel for downloading results (matchup_results.json, matchup_matrix.csv, etc.)
- Security: path validation, config validation, security headers
- Command-line support (see manual.md)

### Modified

- Pokemon Showdown submodule with custom AI heuristics and extended battle stream data

[Unreleased]: https://github.com/cRz-Shadows/Pokemon_Trainer_Tournament_Simulator/compare/main...HEAD
[1.0.0]: https://github.com/cRz-Shadows/Pokemon_Trainer_Tournament_Simulator/releases/tag/v1.0.0
