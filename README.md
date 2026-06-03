# VoxLingua — Marketing Site

A premium marketing site for **VoxLingua**, a speech-to-text dictation app (Mac/Windows/Linux) that
turns your voice into polished text in any app, across **100 languages** — on-device (Faster-Whisper)
or cloud (GPT-4o). Content mirrors the actual product: 5 plans (Free/Pro/Ultra/Team/Enterprise),
translation & voice commands on Ultra, email mode & custom dictionary on Pro. No fabricated stats.

## Run it

It's a static site — no build step. Just open `index.html`, or serve the folder:

```bash
# from voxlingua-ui/
python -m http.server 8080
# then visit http://localhost:8080
```

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page markup + SEO meta + JSON-LD structured data |
| `styles.css`  | Design system & all styling (no framework) |
| `script.js`   | Scroll reveal, nav, pricing toggle, hero typewriter |
| `robots.txt`  | Crawler directives |
| `sitemap.xml` | Sitemap for search engines |
| `logo.png` | Full-res transparent logo master (background removed) |
| `logo-mark.png` | 512×512 square mark — used in nav, footer, final CTA & favicon |

## Design

- **Theme:** dark "electric glow" — built around the brand logo (blue→violet light on near-black)
- **Type:** Fraunces (characterful display serif) + Hanken Grotesk (clean body)
- **Palette:** cool near-black ink (`#07070C`), cool off-white text, blue (`#4DA3FF`) → violet (`#A855F7`)
  accent pulled straight from the logo and used sparingly (dominant ink, sharp accent — not purple-on-white slop)
- **Logo:** the supplied PNG, background keyed to transparent via luminance alpha, auto-cropped & de-fringed
- **No dependencies, no tracking, no build** — fast loads = better SEO & conversion

## Pricing strategy (low price, healthy margin)

| Plan | Price |
| --- | --- |
| Free | 3,000 words/wk |
| Pro  | **$7/mo** billed annually ($9 monthly) |
| Team | **$8/seat/mo** billed annually ($11 monthly) |
| Enterprise | Custom |

Voice-AI marginal cost per user is low, so a low headline price still keeps a healthy gross margin —
the free tier is a generous funnel and Pro is the profit driver. No free trials: the Free plan is the
try-before-you-buy path, and users upgrade to Pro directly when they're ready.

## SEO checklist (implemented)

- Descriptive, keyword-rich `<title>` and meta description with a conversion hook
- Open Graph + Twitter cards for rich social sharing
- Canonical URL, robots meta, theme-color
- JSON-LD: `SoftwareApplication` (+ offers & rating) and `FAQPage`
- Semantic HTML5 landmarks, single `<h1>`, logical heading order
- `robots.txt` + `sitemap.xml`
- Accessible: skip link, focus states, reduced-motion support, alt/aria labels
- Fast: system-friendly fonts with `display=swap`, no JS framework

> Replace placeholder URLs (`voxlingua.ai`), the `og-image.png`, logos and testimonials with real
> assets before launch.
