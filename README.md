# Space Frame Architects — Premium Redesign

A complete visual rebuild of the Space Frame Architects website (Chennai, Tamil Nadu).
All business content is carried over word for word from the original site; only the
design, layout, motion and interaction are new.

The project is **self-contained static HTML/CSS/JS**. There is no build step and no
runtime dependency outside this folder (GSAP is vendored in `js/vendor/`). Web fonts
load from Google Fonts with system-font fallbacks.

## Run it

Any static file server works. Pick one:

```bash
npx --yes serve@14.2.4 -l 5173 .
```

```bash
python -m http.server 5173
```

Windows with no Node or Python installed:

```bash
powershell -ExecutionPolicy Bypass -File tools/serve.ps1 -Port 5173
```

Then open http://localhost:5173. Opening `index.html` straight from disk also works
(all scripts are classic scripts), but a server is better for testing.

To deploy, upload the folder as-is to any static host (Netlify, Vercel, GitHub Pages,
S3, cPanel…). `index.html` is the entry point.

## Structure

```
index.html              All markup and content (single page)
css/main.css            Design tokens, layout, components, responsive rules
js/main.js              Motion system + interactions (menu, works, gallery, lightbox…)
js/frame3d.js           Decorative 3D "space frame" lattice (canvas, no WebGL)
js/vendor/              GSAP 3.12.5 + ScrollTrigger (vendored)
assets/logo/            Original logo marks (unchanged) + favicon
assets/img/works/       Renders, resized to 1920 px and 960 px JPEGs
assets/img/gallery/     Construction (18) and Interior (26) photos, 1600 px + 640 px thumbs
tools/optimize-images.ps1  Re-generates web images from originals (Windows, no extra tools)
tools/serve.ps1         Tiny static server for Windows
```

### Adding gallery photos

1. Resize the photo:
   `powershell -ExecutionPolicy Bypass -File tools/optimize-images.ps1 -Source "photo.jpg" -Dest "assets/img/gallery/interior/interior-27" -Sizes 1600,640`
2. Add the 640 px thumbnail's `WIDTHxHEIGHT` (printed by the script) to the
   matching `dims` list in `GALLERY` near the bottom of `js/main.js`. Counts update automatically.

## Visual features

- **Opening (plays first)** – pure CSS keyframes, as on the original site, so it starts on the first paint and never waits for JavaScript. The finalised logo and tagline sit on a drafting sheet. Grid lines
  draw in, and each logo stroke traces with its own duration and delay (taken from the
  inline `animation-duration` / `animation-delay` styles in the logo markup). The tagline words
  drop in from −50px on their own delays, then the rule and wordmark appear. The sheet then
  lifts away and the home page animates in. It runs on every page load (about 4 seconds),
  can be skipped with "Skip intro" or Escape, and is never shown with reduced motion.
- **Hero** – oversized display type beside a small framed photograph (JEEVA render) and an animated 3D space-frame lattice following the pointer. On desktop the hero pins: scrolling cross-fades the small photo away while a second, full-bleed photograph (opt 3) grows out of the same frame to fill the screen, the type lifts away and the lattice camera pulls in.
- **Our Story (About)**:
  - **Structural column grid:** dash-dot centre lines with grid bubbles A–E and 1–3, as on a structural plan. It assembles on entry and drifts slower than the content. A "drafting lamp" shows fine graph paper around the pointer.
  - **Headline:** the characters flip up in 3D. The italic "Breathes & Endures" line opens out and then settles as you scroll.
  - **Labels:** "Our Story" and "Est. 2015" decode from random glyphs.
  - **"2015":** drawn first as an outline, like a plan, then filled solid from the bottom, like a finished building, tied to scroll.
  - **Lead paragraph:** lights up word by word as it is read.
  - **Images:** each one appears first as a drafting placeholder (a box with crossed diagonals). A gold scan line then reveals the photograph. The images have depth parallax and a 3D tilt that follows the pointer.
  - **Pillars:** stand up in 3D. Hovering redraws the icon and shows a graph-paper grid.
  - **Statistics:** roll in like an odometer. Screen readers get the plain number.
- **Services** – the dark panel opens out of the light section. Numbered editorial
  rows sit beside a sticky stage that swaps images with clip-path wipes, and an
  animated plan drawing for Approval. Every service's full list is always visible
  (no flip cards or hover-only content).
- **Selected Work** – a pinned horizontal sequence on desktop: alternating image
  scales, perspective swing-in, inner image parallax, a progress rail and counter.
  Each project opens a full-screen case view (prev/next, Escape, focus return).
  Tablets and phones get a natural vertical layout.
- **Gallery** – Construction/Interior tabs (arrow-key navigation), masonry layout
  with clip reveals, "View all" expansion, and a lightbox with keyboard, swipe,
  counter and preloading.
- **Testimonials**:
  - **Backdrop:** a perspective floor grid rolls toward you as you scroll, and the outlined words "Kind Words" drift sideways. Drafting lines draw in.
  - **Card:** each review sits on a "drawing sheet" with registration corners and a "Sheet 01 / 04" title block. The card stands up in 3D on entry and tilts with the pointer.
  - **Client index (desktop):** names act as tabs with a gliding gold marker, and the active name fills a progress line while the slide is shown.
  - **On each slide:** the quote mark flips and is drawn, then filled. The words rise out of a blur, and the avatar's dashed ring spins in. The name wipes in, and the project label decodes from random glyphs.
  - **Stars:** each SVG star draws its outline, pops in with a gold fill and a spark burst, and then a shine sweeps across it. The label still reads "5 out of 5 stars".
  - **Behaviour:** the counter rolls. Auto-advance (8 s) pauses on hover, on focus and when off-screen. Previous/next buttons, the index, dots (phones) and swipe all work.
- **Contact & footer** – kinetic headline, drafting-grid backdrop, contact details as
  real `tel:`/`mailto:` links, WhatsApp/Instagram tiles, oversized outline wordmark.
- **Interface** – full-screen menu with image previews, a nav that changes colour per
  section and hides on scroll down, a scroll progress line, magnetic buttons and a
  custom cursor on fine-pointer devices.

## Hero name

"SPACE / FRAME / ARCHITECTS" is set as three lines at one size. `fitBrand()` in `js/main.js` solves each word's variable width axis (Archivo `wdth` 62–125) so all three lines end on the same edge. Short words also get letter-spacing to make up the rest. ARCHITECTS is gold. On load each word expands from fully condensed to its fitted width, and a light sweeps across ARCHITECTS. A dimension line then draws under the block. On desktop the three lines drift with the pointer and slide apart in alternating directions as the hero photo opens on scroll. The fit is recalculated on resize.

## Phones (under 768px)

- **Hero:** no photograph. Instead there is a dark drafting sheet: grid lines draw in, there are "Sec. A–A" and "Space frame · Axonometric" labels, and the 3D space frame assembles above the title. The hero image is not downloaded on phones at all.
- **Our Expertise:** every service has a numbered image plate. Approval gets the animated plan drawing, the plates wipe in, and the service in view lights up gold.
- **Our Work:** a swipeable snap rail with the next project peeking in. The project in view is highlighted, with a progress line, a counter and a "Swipe" hint. This replaces six full-height stacked blocks.
- **Gallery:** smaller section titles, and the two tabs sit in equal columns with the photo count under each name.

## Accessibility & performance

- `prefers-reduced-motion` turns off the intro, pinning, horizontal scroll, parallax and
  auto-advance. Content shows immediately. For QA you can force this with `?motion=off`.
- Without JavaScript the page is a complete static document.
- Semantic landmarks, skip link, visible focus styles, labelled controls. Dialogs
  (menu, case view, lightbox) trap focus, close on Escape and return focus.
- Images are about 15 MB in total, down from about 100 MB of originals. They are lazy-loaded
  below the fold and have intrinsic sizes, so the layout does not shift as they load. The hero
  image is preloaded.
- The lattice canvas pauses when off-screen or when the tab is hidden, and caps
  the device pixel ratio.

## Content notes for the owner

Text was carried over exactly. A few things in the original copy may be worth
confirming. They were **not** changed:

- The project is titled "The Sathish Residence", the testimonial project says
  "Satish Illam", and the image alt says "Sathish ILLAM".
- The project is titled "The Yuvraj Residence", but its image file is named "YUVARAJ".
- One testimonial attribution reads "Suresh , Chennai" (space before the comma).
- The intro tagline omits "Better" ("Build Your Dream Home from Concept to Completion"),
  as it did in the original splash. The hero and footer include it.

Some alt texts in the original described unrelated projects (for example
"Arunachala Retreat… Tiruvannamalai" on the Vinoth Residence image). These were
template leftovers, so they were replaced with neutral descriptions of what each image shows.

Two renders from the original `img/` folder were not linked to a named project or
shown on the original site: `opt 3` (now the hero image) and `VIEW 1` (Architecture
service visual). They appear only as unlabelled imagery and are never presented as a
named project. The About collage reuses renders the original About section already
showed (SAKTHIVEL, SATHYA, RAGHURAM 2). BALAJI, JEEVA, MURUGAN and RAGHURAM are not used.

No canonical URL is set because the production domain isn't known. Add
`<link rel="canonical" href="https://your-domain/">` and an absolute `og:image` URL
in `index.html` once it is.
