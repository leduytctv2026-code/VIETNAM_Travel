# Homepage motion

The homepage retains the existing content, images, routes and API. Its eight
semantic scenes now use seven independent pinned timelines on desktop.

## Ownership and layout

- `HeritageHome` owns the root ref and initializes `useHomeCinematicScenes` after
  that ref commits. There is no sibling controller racing the root ref.
- `.scene-pin` is stationary. GSAP animates the inner `.scene-stage`, never the
  pin target. The outgoing pin remains for 0.85 viewport of the next entrance.
- Hero uses a 1.85-viewport pin with a zooming camera. Intro covers it. Regions
  have a vertical-scroll-driven horizontal rail. Gallery layers move at distinct
  speeds. Map and memory use camera/mask and split-panel takeovers. Culture uses
  overlapping cards, followed by a native-flow outro.
- `MotionSystem` owns one Lenis instance and one GSAP ticker callback. Homepage
  image/font refreshes belong to the homepage hook, not both controllers.
- Hero load/slideshow and scroll transforms have separate wrappers. Card hover
  transforms likewise do not compete with scene transforms.
- Touch/tablet, short viewports and reduced motion use native document flow.
  Live preference changes, resize, route exit and return clean up pins/listeners.
- Tab focus seeks hidden scenes into view. Scene anchors seek the revealed panel.
  Long history and food panels keep native inner scrolling.

## Reproduce the isolated checks (PowerShell)

The configured Atlas database is never seeded or modified by these checks.
Start the existing isolated QA API in one terminal:

```powershell
$env:QA_PORT='5001'
npx.cmd tsx scripts/qa-server.ts
```

Start a separate frontend in a second terminal:

```powershell
$env:API_INTERNAL_URL='http://127.0.0.1:5001'
$env:NEXT_DIST_DIR='.next-motion-qa'
npm.cmd run dev:web -- --port 3001
```

Then run:

```powershell
node scripts/motion-qa.mjs
node scripts/motion-navigation-qa.mjs
npm.cmd run typecheck
npm.cmd run test:frontend
```

Browser scripts use installed Edge and only read/navigate; they do not submit
forms, delete content, or change accounts. `MOTION_QA_URL` overrides the test URL.
Screenshots and JSON reports are saved under `.local/motion-qa/`.

## Verified / limitations

- Desktop wheel scroll: hero stays at y=0 while the document moves; the regional
  rail travels approximately 1,950px in the sampled interval.
- Seven unique pins, correct start/end ranges, overlapping transitions, distinct
  gallery motion and opposing memory panels were measured and screenshot-reviewed.
- Debug markers were enabled to inspect pin boundaries, then removed from code.
- Desktop 1440×900 and 1100×720, tablet 820×1180, mobile 390×844,
  reduced-motion toggling, keyboard traversal, anchors and route back-navigation.
- Route smoke coverage: home, explore, destinations, specialties, map, community,
  profile, unauthenticated admin, province, destination and specialty details.
- TypeScript, component lint and nine existing frontend unit tests passed.
- Testing uses isolated seeded data because the configured Atlas connection
  returned a TLS connection error. Production data has not been reverified.
- Map camera/markers/controls were checked, but external OpenStreetMap tiles did
  not load in the restricted browser environment. Real-device mid-range frame
  rates and the production build have not been benchmarked here.
