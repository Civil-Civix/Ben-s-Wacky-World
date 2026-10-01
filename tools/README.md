# Maintenance tools

Run from the repository root, for example `node tools/check-ui.cjs` or `python tools/verify-library.py`. JavaScript tools resolve the repository root automatically; Python tools derive it from their file location.

- `check-*.cjs`: focused browser checks from earlier work. Some expect the local server, a specific browser/runtime location, or older UI details; review a check before relying on it.
- `audit-games.cjs`, `finalize-game-audit.cjs`: game loading audit and review-data generation.
- `import_games.py`, `inspect_sources.py`: import utilities using the original local ZIP archives.
- `clean-game-*.py`, `verify-library.py`: game-file maintenance. These can modify game/catalog files; read them before running.

Saved reports are in `reports/`, historical previews in `docs/previews/`, and scratch screenshots in the ignored `.audit-evidence/` folder. The regular preview server stays at `server.cjs` in the repository root so **Start Local.cmd** continues to work.
