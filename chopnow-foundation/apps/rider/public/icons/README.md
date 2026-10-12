# Icon assets needed

This directory needs three real PNG icons before the PWA manifest is
fully functional (installability works without them in most browsers,
but the install prompt/home-screen icon will look wrong):

- icon-192.png (192x192, any purpose)
- icon-512.png (512x512, any purpose)
- icon-maskable-512.png (512x512, maskable — safe-zone padding for
  Android's adaptive icon masks)

Generate these from the ChopNow logo mark using any PWA icon generator,
e.g. https://realfavicongenerator.net or `npx pwa-asset-generator`.
