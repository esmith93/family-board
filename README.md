# Killing the Apps Script banner

Google injects that bar into the page it serves. No script setting removes it.
The fix is to host one small page yourself and embed the app in an iframe — the
banner belongs to the outer page, so it never loads. `Code.gs` already sets
`XFrameOptionsMode.ALLOWALL`, which is what makes embedding possible.

You also get a real app icon and true fullscreen out of it.

---

## 1. Change the deployment access — important

**Deploy → Manage deployments → pencil → Who has access → `Anyone`**
(not "Anyone with Google account"), then deploy a new version.

This matters more than it looks. Signed-in access needs Google's cookies, and
inside a cross-origin iframe those are third-party cookies — blocked by default
in Safari, being phased out in Chrome. Leave it on "Anyone with Google account"
and the embed will likely show a sign-in loop instead of your app.

The URL becomes the only thing protecting it. That's fine for a chore list: it's
long, random, and unguessable, and the script only touches this one Sheet and
one Drive folder. Don't post it publicly. As a bonus, Hazel and Sage no longer
have to be signed into Google on the iPads.

## 2. Paste your URL

Open `index.html`, find the marked line, replace the placeholder `src` with your
full `/exec` URL.

## 3. Put it online

**GitHub Pages** is the simplest option that works away from home:

1. New repo, e.g. `family-board`. Public is fine — the repo holds no secrets
   beyond the URL, so keep it private if that bothers you.
2. Upload all five files to the root.
3. **Settings → Pages → Source: Deploy from branch → `main` / root**
4. Wait a minute, then open `https://YOURNAME.github.io/family-board/`

Your Pi could serve these instead, if you'd rather — drop the folder in your
Express static directory. It just won't work when you're away from the house.

## 4. Add to Home Screen

Open the Pages URL on your phone → share sheet → **Add to Home Screen**.

Launches fullscreen with the sage checkmark icon and no browser chrome. Same on
the girls' iPads.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | The wrapper. Only file you edit. |
| `manifest.webmanifest` | Name, icon, standalone display |
| `icon-192.png` / `icon-512.png` | Home screen icon |
| `icon-maskable.png` | Extra padding for Android's icon crop |

## Notes

The wrapper carries the safe-area padding, not the app. Inset values resolve to
zero inside a cross-origin iframe, so if the app were left to handle it the dock
would sit under the home indicator. Don't remove the `padding` rule on `body`.

Changing the app itself is unchanged: edit in Apps Script, deploy a new version.
The wrapper points at the same URL and needs no updating.

If you ever redeploy as a **New deployment** rather than a new version, the URL
changes and you'll need to update the `src` here.
