# Use MAUL as a free iPhone Home Screen app

You can use this option from Windows. It uses the existing HTTPS website and does not require Xcode, a Mac, or Apple Developer enrollment.

## Install it on your iPhone now

1. Open **Safari** and go to **https://moddedamong.us**.
2. Tap **Share**. Depending on your Safari layout, you may need to open the page menu first.
3. Scroll down and tap **Add to Home Screen**.
4. If **Open as Web App** appears, leave it enabled.
5. Name it **MAUL**, tap **Add**, and open the MAUL icon from your Home Screen.

These steps already work for the current website. The files in this update add a dedicated app icon, installation metadata, standalone layout adjustments, and offline support after you publish them.

## Publish the website update using your Windows browser

1. Extract **MAUL-Web-App-Update.zip**. Open the extracted folder until you can see `index.html`, `manifest.webmanifest`, `sw.js`, and the `scripts`, `styles`, and `pwa` folders.
2. Open [Sarhadactyl/MAULweb on GitHub](https://github.com/Sarhadactyl/MAULweb) while signed in to your account.
3. Check **Settings → Pages** to see which branch and folder currently publish the website. Keep that publishing configuration.
4. Open that branch and publishing folder in the repository’s **Code** view. Choose **Add file → Upload files**.
5. Drag the **contents** of the extracted update folder into the upload area. Preserve the `scripts/`, `styles/`, and `pwa/icons/` paths. Upload the extracted files, rather than the ZIP or its containing folder.
6. Review the proposed changes. The existing files being updated are `index.html`, `scripts/navbar.js`, `Mauf.html`, and `maua_privacy.html`. The other files are additions.
7. Commit the update with a message such as **Add MAUL Home Screen web app**. If you use a pull request, merge it into the website’s publishing branch after review.
8. Wait for the existing GitHub Pages deployment to finish. Then open [the manifest](https://moddedamong.us/manifest.webmanifest) and confirm it shows MAUL’s app configuration. Add the website to your iPhone Home Screen again if you want the new icon.

The website has not been updated by this chat. These are ready-to-upload files. No Node installation or native iOS build is needed for this update.

## What the update does

- Keeps the current pages, colors, typography, and features.
- Uses the existing MAUL mascot artwork for the Home Screen icon.
- Opens in a standalone app window when installed through Safari.
- Adjusts the menu, text fields, editor width, and safe-area spacing in the installed app.
- Saves Home, Template Editor, Tag Generator, Hex Color Helper, Lobby Templates, and the Regions page after the first online load.
- Shows an offline page when a requested page has not been saved yet.
- Keeps login requests, API responses, and third-party services out of the offline cache. Only explicitly public event/region/catalogue JSON can have an offline copy.

Live lobbies, rankings, Discord, external images/fonts, and new information still need an internet connection. Browser storage can be cleared or evicted by iOS, so offline availability is best-effort. Exports use the browser’s file-download controls. Among Us links still require the game to be installed.

## Quick iPhone check after publishing

Open the Home Screen app once while online and let it finish loading. Check navigation, template downloads, copy buttons, lobby login, and an Among Us region link. Then briefly turn off your connection and reopen Template Editor or Hex Color Helper. Turn your connection back on for lobbies and rankings.

The local checks use a mobile browser on Windows. A real iPhone/Safari installation has not been tested here.

## Future website changes

Normal pages and shared scripts are requested from the network first, with saved copies used when offline. Increase the `VERSION` value in `sw.js` when changing the offline shell, icons, or caching rules. A new service worker waits for old website/app windows to close before taking over.

This update is based on MAULweb commit `e3d7d5a4ac26dc1d110146b6dbae99929f2da854`.

References: [Apple’s Home Screen instructions](https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios), [GitHub file uploads](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository), [GitHub Pages publishing](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
