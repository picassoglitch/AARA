# design

the site is a room, not a page. a private vault inside an old estate: one work on the wall, low light, nobody explaining anything. the family has always been here. the space energy is the light it is lit by.

read with `docs/VOICE.md` (words) and `docs/ORIGIN.md` (tone). where this file and the voice guide disagree, the voice guide wins.

reference register: private gallery viewing rooms, high-fashion lookbooks shown one image per screen, old jewellery houses' archive pages, estate auction catalogues. not: crypto/NFT drops, "aztec" themed restaurants, dark-mode SaaS.

## principles

1. **one thing at a time.** one artwork, one line, one field. anything that is not the work earns its place by being nearly invisible.
2. **inheritance, not decoration.** heritage shows up as one crest, one word and a sense of proportion. no pyramids, sun stones, serpents, step-fret borders, codex patterns or "tribal" type.
3. **slowness is the luxury.** nothing snaps. nothing bounces. motion is light changing in a room.
4. **dark, not dim.** mystery comes from restraint, not from text the reader cannot see. every word that exists must be readable.
5. **no interface showing.** no nav, footer, about, logo bar, cookie banner, social icons, buttons or boxes on public pages.

## palette

| role | value | use |
|---|---|---|
| ground | `#0b0a09` | page background. warm near-black, never pure `#000` |
| ground, lifted | `#12100e` | radial light behind the artwork (5–8% lift, centred on the work) |
| bone | `#e8e2d6` | primary text, at 100% for the queue number, 72% for the placard |
| ash | `#e8e2d6` @ 44% | labels, secondary text. minimum contrast 4.5:1 on ground |
| gold | `#b08d57` | hairlines, crest, caret, focus. never a fill, never a large area |
| copper | `#9a6b45` | hover/active state of gold only |
| hairline | gold @ 35% | underlines, the mat line, dividers |

grain: a 2–3% opacity monochrome noise layer (tiled png or svg `feTurbulence`, under 20 kb) fixed over the whole page so the black reads as material, not screen. vignette: a soft radial falloff to `#070605` at the corners.

`<meta name="theme-color" content="#0b0a09">` so mobile browser chrome matches. dark scrollbars. override chrome autofill (`-webkit-box-shadow: 0 0 0 1000px #0b0a09 inset; -webkit-text-fill-color: #e8e2d6`).

## typography

- **display:** cormorant garamond, 300/400, for the queue number, crest word and stub lines.
- **text:** eb garamond, 400 with small caps (`font-variant-caps: all-small-caps`) for the placard and labels.
- self-host woff2 in `public/fonts/`, subset to latin, `font-display: swap`, preload the two files the homepage uses. no google fonts cdn (keeps csp strict and the site off third-party logs).
- lowercase throughout per the voice guide. small caps tracked `0.18em` for tiny labels. body tracking `0.01em`.
- scale (fluid, `clamp`): placard 12–13px, label 11–12px, input 16px (prevents ios zoom), queue number 64–120px, stub line 18–22px.
- numerals: oldstyle (`font-variant-numeric: oldstyle-nums`) except in the queue number, which uses lining figures.

## layout

- full viewport, no scroll on desktop for the homepage. on mobile the request field may sit just below the fold.
- artwork centred, max `min(78vw, 78vh * aspect)`, with at least 10vh of breathing room top and bottom. it should feel hung, not fitted.
- optional mat: a single 1px gold hairline at 35% opacity, offset 24–32px outside the image. no shadows, no rounded corners, no heavy frame.
- placard beneath the work, 4–6vh gap: `2026.10.01 · untitled` in tracked small caps. use a middle dot or a thin space, not an em dash.
- crest: the word `ixiptla` in cormorant at 6–8% opacity, or one thin geometric seal (inline svg, gold 1px stroke). pick one, never both. place it once, off-axis: bottom-left corner or set vertically along one edge, about 11px tall. it is a watermark you notice on the second visit.

## motion

- artwork entrance: opacity 0 → 1 and scale 1.02 → 1 over 2000ms, `cubic-bezier(.2,.6,.2,1)`, starting only after the image has decoded (`img.decode()`). the placard follows 600ms later, the field 400ms after that.
- loading: a 1px gold hairline 48px wide that slowly breathes (opacity .2 → .6, 3s, infinite), or the crest doing the same. never a dot, spinner or the word "loading".
- crest: optional very slow opacity drift (8–12s cycle, 4% ↔ 8%).
- hover and focus transitions take 600–900ms. nothing under 400ms on public pages.
- page leave to the queue page: fade the room to ground over 800ms before navigating.
- `prefers-reduced-motion: reduce` turns off all of it. content just appears.

## homepage components

**artwork.** `<img>` with real `alt` from the admin (default to the title). `decoding="async"`, explicit width/height from metadata to avoid layout shift. serve a 2400px long edge from blob. no right-click blocking or overlays (both read as insecure).

**placard.** one line. date and title only. no price, no medium, no "sold", no edition text.

**request field (the invitation).**
- no visible box and no button. one 1px hairline, 220–280px wide, with the label `request` in tracked small caps beneath it at 44% (a placard, not a form label above an input). keep `<label for>` for accessibility.
- `type="text"` with `inputmode="email"` and `autocomplete="email"`, and validate in js. this avoids the browser's default validation bubbles, which break the room.
- on focus the hairline warms from 35% to 70% gold and a small gold `→` or the seal fades in at the right end. enter submits, and tapping the glyph also submits on mobile.
- errors replace the label in place, in voice: `not quite.` then return to `request` after 4s. never red.
- after submit: the field fades, then the room fades to the queue page.
- honeypot and `ref` stay as they are.

**empty and failure states.** no artwork: the room stays lit, with the hairline loader replaced by `nothing hangs here today.` api failure: `closed.` both use cormorant at 18px.

## queue page

- same ground, grain and crest.
- `#14` centred, cormorant 300, lining figures, bone at 100%. no space between `#` and the number. it fades in slowly like the artwork.
- beneath it, after 1.2s: `you will be contacted.` in small caps at 44%.
- nothing else. no share button, no "back", no explanation of position. a whitelisted visitor sees the identical page, because status is never displayed.
- invalid or expired token: `not here.`

## stubs and 404

`/i/:code`, `/verify/:id`, `/t/:id` and unknown paths use the same room, one line of cormorant, crest present. the 404 is `not here.`; nfc and qr stubs carry their single word from the voice guide.

## admin

the admin is a working tool. atmosphere is secondary to legibility.

- same ground and fonts, but text at 85–100% bone, a 14–15px base and normal letter-spacing for data.
- serif for headings only. use a tabular system sans or the garamond in lining tabular figures for tables, scores and timestamps.
- gold for primary actions as outlined hairline buttons. copper on hover. destructive actions get a muted oxblood outline (`#7a3b34`), always with a confirm step.
- visible focus rings (2px gold), proper hit targets (44px), keyboard reachable.
- sections: current work (with preview and set-current), upload, waitlist (sortable, with inline engagement score), campaigns (create, copy link, clicks, whitelisted count).
- `noindex`, no crest animation, no grain (it hurts table legibility).

## meta and polish

- `<title>ara</title>`. one meta description from the voice guide. og image = current artwork on ground, with no text burned in.
- favicon: the seal or a single gold point on near-black. no letter "a".
- no analytics scripts that set cookies. no cookie banner needed if nothing is set.
- performance target: homepage under 150 kb before the artwork, lcp is the artwork itself.

## what in the first build fights this

- pure `#000` background reads as a screen, not a room.
- system sans-serif font is generic saas, not an estate.
- gray text at `#444`–`#666` on black is below readable contrast and reads as broken rather than withheld.
- the lone `.` loading state looks like an error.
- the `request` label sits above the input like a form, and the 240px input is plain.
- `type="email"` triggers browser validation bubbles. chrome autofill turns the field yellow or blue.
- there's no entrance motion, so the work just pops in.
- the placard uses an em dash, and the queue page renders `# 14` with a space.
- `error.` and `closed.` are terse to the point of feeling unfinished. use the voice-guide states above.
- no `theme-color`, so mobile browser chrome stays white around a black site.
- the admin is unstyled defaults.
- the queue redirect puts `wl=0` in the url, which leaks whitelist status. drop it and look up status server-side only.
