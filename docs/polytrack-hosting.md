# Poly Track hosting

The game is served from library/polytrack/index.html on both site hosts. Imported from Civil-Civix/newcargame at ec6208f054df98ca9009cc4b598d2f9045ec27d4, preserving the game credits and leaderboard adapter. Runtime files are copied; development tests and Git metadata are excluded.

The same account Worker, track IDs and records are retained. The parent replay launcher resolves the relative game URL against document.baseURI. Local game settings and progress are browser-origin specific; moving from the old GitHub-hosted game to the Cloudflare copy does not transfer them. Server leaderboard records remain available.

Keep the source repository available as a rollback source. Future game updates must also update this vendored copy.
