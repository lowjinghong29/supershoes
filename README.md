# SUPERSHOES — Scroll Animation Landing Page

A premium product landing page for a fictional running shoe brand, featuring a scroll-driven frame-by-frame animation engine built entirely with vanilla HTML, CSS, and JavaScript. No external libraries.

**Live site:** [lowjinghong29.github.io/supershoes](https://lowjinghong29.github.io/supershoes/)

---

## How the Scroll Animation Works

The hero section plays a video-like animation as the user scrolls. Instead of an actual `<video>` element (which can't be scrubbed smoothly), we extract individual JPEG frames from the source videos and draw them to an HTML5 `<canvas>` element based on scroll position.

### Frame Extraction

Two source videos (`video1.mp4` and `video2.mp4`) are converted into sequential JPEG frames using ffmpeg:

```bash
ffmpeg -i video1.mp4 -vf "fps=24,scale=1280:-1" -q:v 2 frames1/frame_%04d.jpg
ffmpeg -i video2.mp4 -vf "fps=24,scale=1280:-1" -q:v 2 frames2/frame_%04d.jpg
```

- `fps=24` — extracts 24 frames per second
- `scale=1280:-1` — scales to 1280px wide, maintaining aspect ratio
- `-q:v 2` — high-quality JPEG encoding (lower number = higher quality)

This produces 121 frames per video, 242 frames total. Both frame sequences are treated as one continuous sequence (0-241).

### Scroll-to-Frame Mapping

The animation section is 600vh tall (6x the viewport height). A sticky container keeps the canvas fixed at the top of the viewport while the user scrolls through this tall section:

```
progress = scrollDistanceIntoSection / (sectionHeight - viewportHeight)
frameIndex = Math.floor(progress * (totalFrames - 1))
```

- `progress` ranges from 0.0 (top) to 1.0 (bottom)
- `frameIndex` maps linearly to frame 0 through frame 241
- Canvas redraws ONLY when the frame index changes (no redundant draws)

### Canvas Rendering

- Canvas resolution matches `window.innerWidth * devicePixelRatio` for retina sharpness
- Images are drawn using cover-fit math (fills canvas while maintaining aspect ratio)
- `imageSmoothingQuality = 'high'` for best upscaling from 720p source
- Opaque canvas context (`alpha: false`) for faster compositing

### Frame Preloading

All 242 frames are loaded before the page becomes interactive:

1. **Priority batch** — first 30 frames load immediately (for instant hero display)
2. **Background chunks** — remaining frames load in batches of 20
3. **Pre-decode** — each frame calls `img.decode()` after loading, ensuring the JPEG is decoded and GPU-ready before it's needed (prevents decode jank during scroll)
4. A loading screen with animated wordmark and progress bar shows during this process

### Performance Optimizations

- **requestAnimationFrame only** — scroll events never directly draw to canvas. The scroll handler sets a flag, and `rAF` does the work
- **Passive scroll listener** — `{ passive: true }` prevents scroll-blocking
- **Dirty-check all DOM writes** — hero overlay opacity, 4 overlay text opacities, progress bar width, and nav scroll state are all tracked. Style properties only update when values actually change
- **Cached DOM references** — all `querySelector` calls happen once at init, never in the hot path
- **`will-change: opacity`** on animated overlays for GPU-composited layer promotion

### Mobile Fallback

On screens <= 768px, scroll-scrubbing is disabled. Instead, `video1.mp4` plays on loop inside the hero section with `autoplay muted playsinline`.

---

## Page Sections

| Section | Description |
|---------|-------------|
| **Hero + Scroll Animation** | 600vh sticky canvas with frame-by-frame animation, left-aligned title overlay that fades out, 4 scroll-triggered text labels |
| **Product Showcase** | Split layout — shoe image + key specs (198g, 38mm stack, 8mm drop) |
| **Features** | Asymmetric 2-column grid (1 large card + 2 stacked) — ULTRA-LIGHT, HEAT-MAPPED FIT, IMPACT SHIELD PRO |
| **Technology Breakdown** | Exploded sole view image + 4 labeled technology layers |
| **Stats Bar** | Animated counters (198g, 7 layers, 87% energy return, 300% impact absorption) |
| **Athlete Spotlight** | Runner image + testimonial quote + race statistics |
| **Reviews** | 2-column staggered layout, 4 verified reviews with numeric ratings |
| **Specifications** | 2-column spec table (weight, stack, drop, upper, midsole, plate, outsole, sizes, colorways, price) |
| **CTA** | Pre-order section with $275 price and trust signals |
| **Newsletter** | Email signup form |
| **Footer** | 3-column nav, social icons, legal links |

---

## Design System

### Fonts
- **Bebas Neue** (Google Fonts) — headlines, stats, logo, card numbers
- **Outfit** (Google Fonts) — body text, buttons, labels, navigation

### Colors
- `--accent: #E86200` — primary brand (slightly desaturated orange)
- `--bg: #0B0B0F` — page background (off-black, never pure black)
- `--bg-elevated: #131318` — elevated section backgrounds
- `--bg-card: #17171C` — card backgrounds
- `--text-primary: #F0F0F2` — headlines
- `--text-secondary: #8E8E96` — body text
- `--text-tertiary: #5C5C64` — labels, captions

### Design Principles (Taste-Skill)
- No custom cursor (accessibility)
- No outer glow box-shadows (inner borders + tactile `:active` push instead)
- No 3-column equal grids (asymmetric layouts throughout)
- No emojis in UI
- No pure black (#000)
- Art-gallery-level spacing (VISUAL_DENSITY: 3)
- Asymmetric layouts (DESIGN_VARIANCE: 8)

---

## Swapping Videos

1. Replace `video1.mp4` and `video2.mp4` with your new videos
2. Delete `frames1/` and `frames2/` directories
3. Re-run the ffmpeg commands above
4. Update `FRAMES1_COUNT` and `FRAMES2_COUNT` at the top of `main.js`
5. `TOTAL_FRAMES` is computed automatically

For videos longer than 10 seconds, trim first:
```bash
ffmpeg -t 8 -i video.mp4 -vf "fps=24,scale=1280:-1" -q:v 2 frames/frame_%04d.jpg
```

---

## Technical Stack

- **Zero external libraries** — vanilla HTML + CSS + JS
- **IntersectionObserver** for all section entry animations
- **CSS custom properties** for theming
- **Responsive** — single-column fallback on mobile
- **Accessible** — semantic HTML, ARIA labels, `prefers-reduced-motion` support

## Local Development

```bash
npx serve .
```

---

## File Structure

```
supershoes/
  index.html          — page markup (10 sections)
  style.css           — design system + responsive styles
  main.js             — scroll engine + preloader + animations
  frames1/            — 121 JPEG frames from video1.mp4
  frames2/            — 121 JPEG frames from video2.mp4
  video1.mp4          — source video 1 (mobile fallback)
  video2.mp4          — source video 2
  supershoes1.png     — product hero image
  supershoes2.png     — exploded sole technology image
  supershoes3.png     — athlete action shot
  .github/workflows/  — GitHub Pages deployment
```
