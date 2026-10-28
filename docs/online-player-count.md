# Cloudflare Portable online count

Home displays anonymous active browsers, including signed-in visitors and guests. The Cloudflare hostname alone enables the UI and endpoint; GitHub and GitLab are unchanged.

A random localStorage ID is shared across tabs and retained through login/logout. Browser Web Locks serialize pulses across tabs. The backend stores only its SHA-256 hash and last activity, with an indexed active-window count. One pulse per minute while visible; visitors expire after 150 seconds. The existing hourly cleanup removes expired rows. Different devices/private browser profiles count separately; this is an approximate audience count, not verified unique humans. Storage-restricted browsers fall back to a tab-local ID.

Apply account-service/visitors-schema.sql before deploying the Worker. No new service or paid binding. Failed counts display unavailable rather than zero. Online presence continues while browsing other sections or playing in the site.
