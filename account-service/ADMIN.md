# Owner tools

WackyBen is the sole owner. The server checks the stored owner flag for every admin request; profile roles are labels only. Registration and profile editing cannot grant ownership.

Open Account Settings > Admin tools, or Manage on another public profile.

- Mute: block sending text and photos in the main room and DMs for the selected duration. Reading remains available.
- Suspend: block signed-in account features for the selected duration. Existing sessions are checked on every request.
- Ban: block signed-in account features until unbanned. These are account restrictions, not IP/device bans; public guest games remain public.
- Reverse actions: Unmute, Lift suspension, Unban. The owner account is protected.
- Roles: up to five colored profile labels. Add/remove labels, then Save roles.
- Popularity: set an additive bonus per game. Set 0 to remove it. Regular 30-day play totals remain unchanged. The public frontend adds the server-provided bonus; existing visitors refresh rankings on the next normal refresh.
- AI: owner bypasses account/browser daily quotas, but provider quotas, timeouts, and one-request-at-a-time protection still apply. Regular accounts retain 10 daily responses.
- Every admin change records actor, target, reason, before/after values, and time in admin_log. Reasons are admin-only.

Deployment: admin-schema.sql adds profile/moderation fields and admin_log/game_boosts tables. New installations include these in schema.sql. No new secrets or bindings are needed. Keep admin.mjs with the Worker modules.

Profile banner colors save with Save profile. Status changes save immediately. Uploaded profile images are separate from banners.
