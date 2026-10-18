# Merkuur (merkuur.eu) – new website: project brief for Cursor

Save this file in the repo root (e.g. `AGENTS.md` or `.cursor/rules/merkuur.mdc`) and put the current page next to it as `index.html`. Then paste the **Starter prompt** at the bottom into Cursor chat.

## 1. Context

- **Business:** Merkuur – mobile technology and engineering workshops in Estonia. Site language: **Estonian only** (no EN/RU versions – decided).
- **Goal of the site:** sell (1) services and (2) makersets / classroom equipment. These two must stay at the top of the page.
- **Current state:** one self-contained `index.html` (inline CSS and JS, no build step, no framework). Hosted on the owner's own physical server (full access), replacing the old Wix site at https://www.merkuur.eu.
- **Contacts on the site:** info@merkuur.eu · Lauri +372 51 85 404 · Liis +372 53 039 287 · Facebook https://www.facebook.com/mobileworkshops/ · Makerset shop https://mw.yrgel.com

## 1b. Verified company facts (from owner's documents – safe to use on the site)

Source: "Ettevõtte Merkuur OÜ üldandmed ja kokkuvõte" (docx) and "merkuur_tegevused2024.xlsx". Figures are **as of December 2023** – label them as such and ask the owner for updates.

- **Legal:** Merkuur OÜ, registry code **11544602**. Address still missing (placeholder in footer and privacy text).
- **People:** Lauri Soosaar – co-founder, technical developer of projects (tel 51 85 404). Liis Proos – co-founder, leads youth-focused projects; also an experienced career counsellor (tel 53 039 287). Email info@merkuur.eu.
- **Origin:** "Mobiilsed töötoad" started on the initiative of the Ministry of Education and Research (HTM) and the Estonian Youth Work Centre to ease labour shortages in wood and metal industries. Merkuur built a metal and wood workshop on wheels and workshops that go straight to young people. Activity since 2016.
- **Numbers (Dec 2023):** 3,500+ STEM workshops, ~30,000 young participants, 4 self-built mobile workshops, 100+ learning solutions. 2023: two more mobile technology classrooms built (one for MTÜ Sõmeru Start). 2023 Ida-Viru project (Startup Estonia): 44 activities, 831 participants. (The old site's blog post says "354 osalejat" for an Ida-Viru project – different project/year; do not mix the numbers.)
- **Service area:** across Estonia; every school can invite the mobile classroom to its schoolyard. Mobile clubs run in Harju, Ida-Viru, Lääne-Viru, Rapla, Pärnu and Tartu counties.
- **Audience:** young people aged 7–18 and adults. Clients: municipalities, schools (general, vocational, higher education), youth-work organisations, camp and summer-work-camp (malev) organisers, event organisers. Also NEET youth, youth with special needs (HEV), teachers and hobby-club leaders.
- **Content areas:** wood and metal work, welding, engineering, electronics, bionics (with FESTO Eesti), CNC equipment (3D printer, laser engraver, CNC mill) in learning, career information and counselling (individual and group), teacher/club-leader CNC training, competitions (Osavnäpp, Technology Olympiad in Lääne-Viru and Rapla), YouTube video lessons.
- **High-school elective "Inseneeria ja tootmine":** run 3× at Rakvere Riigigümnaasium, and at Pelgulinna, Narva Eesti and Jüri gymnasiums; planned 2024 for Nõo Reaalgümnaasium, Pelgulinna and Rakvere.
- **Projects/partners:** HTM, Estonian Youth Work Centre, ESF, ETAg (science popularisation 2019–20, 2022, 2023), HITSA ProgeTiiger, Erasmus+ (IMATEII, Lab4Stem, BetterCareer, SmartGrowth), Startup Estonia, xEdu Accelerator Helsinki (2019), digital textbook "Arvjuhitavad seadmed" (2021–22).
- **Slogan used on the site:** "Meie investeerime noortesse. Investeeri Sina ka!"

## 2. Services (what the site sells)

1. **Töötoad** – workshops for children, young people, adults; also birthdays and team events.
2. **Tehnoloogiatunnid** – mobile clubs, training, high-school engineering electives (gümnaasiumi inseneeria valikkursused).
3. **Õpilahenduste arendus** – digital textbook "Arvjuhitavad seadmed", lesson plans, learning materials.
4. **Makerspace ja tehnoloogiaklass** – building technology classrooms.
5. **Mobiilsed töökojad** – a fully equipped workshop on wheels that travels to the client.
6. **Karjääriteemad** – career workshops and counselling, led by Liis (experienced career counsellor).
- **Kooli varustamine:** the owner supplies an entire technology classroom or engineering corner – furnishing, all necessary tools and equipment, and training. This is a core revenue item.
- **Makerset'id:** sold via the external shop (mw.yrgel.com).

## 3. Page structure (section ids, in order)

`header` (sticky, hamburger on mobile) → `.hero` → `#teenused` (6 cards) → `#varustus` (school equipping) → `#pood` (makersets) → `#kellele` (who/where, 6 link tiles) → `.stats` (4 verified facts, dated Dec 2023) → `#meist` (about/origin + slogan) → `#teekond` (5-step roadmap) → `#tagasiside` (testimonials) → `#galerii` → `#projektid` (project links + award badges) → `#uudised` (blog cards + quick links) → `#meeskond` → `#kontakt` (people, how to order, enquiry form, privacy `<details id="privaatsus">`) → `footer`.

Do not reorder services / equipping / makersets below other content.

## 4. Design system ("workshop" theme)

- **Look:** industrial workbench – hazard stripes (`.hz`), blueprint grid over the hero photo, pegboard dot texture on dark sections, thick 2px dark outlines, square corners (2–4px), hard offset shadows, mono "spec plate" labels (`.kicker`, numbered service cards 01–06).
- **Tokens (CSS variables on `:root`, dark values under `prefers-color-scheme: dark`):**
  - `--bg #ece9e1`, `--surface #f7f5ef`, `--ink #16191d`, `--muted #555c66`
  - `--accent #ff6a13` (safety orange), `--hazard #ffc400` (yellow), `--deep #171b20` (steel)
- **Fonts (Google Fonts):** Barlow Condensed (headings, buttons, nav – uppercase), IBM Plex Mono (labels), Barlow (body). Always keep fallback stacks.
- **Components:** `.btn` (+ `.ghost`, `.ghost-dark`), `.card` grid, `.tiles` (+ `.light`), `.quote`, `.road` (roadmap, horizontal ≥900px, vertical below), `.split`, `.cform`, `.priv`, `.check`, `.awards`, `.gallery`, `.proj`.
- Keep headings uppercase (matches the old merkuur.eu style). Keep the original site's menu order where possible.
- The original Wix site's exact colors/fonts were **not** available when this was built – if the owner supplies brand colors/fonts, change only the `:root` tokens.

## 5. Content rules and decisions already made

- All copy in Estonian. Do **not** add EN/RU or a language switcher.
- **De-emphasise Snapmaker:** no dedicated section, no brand wording in headings or CTAs. Generic wording ("seadmed", "CNC + 3D"). The high-school engineering electives stay (tile in `#kellele`, mentioned in services and roadmap).
- Do not invent testimonials, partner names, prices, numbers or claims. Use only the verified facts in §1b. EEPA (European Enterprise Promotion Award) and the Estonian science-popularisation award appear as badges in `#projektid`.
- Placeholders highlighted with `.todo` (yellow) **must be filled or removed before launch**: the company **address** in the footer and privacy text (name and registry code are now filled); three testimonial cards in `#tagasiside`.
- **Assumptions the owner has not confirmed** (ask before keeping; "üle Eesti" and equipment-on-board are now confirmed by the company overview): "Tasuta vestlus" tag in roadmap step 1; the description of "Inseneerianurk"; link of the career card to /bettercareer; 12-month retention in the privacy text.
- Privacy policy currently states: no tracking cookies; fonts load from Google Fonts. Update it if analytics, fonts hosting or the form backend change.

## 6. Technical constraints

- Keep it dependency-free and fast: plain HTML/CSS/vanilla JS. If splitting files, use `index.html`, `styles.css`, `main.js`, `assets/` – still no build step unless the owner asks.
- Mobile-first correctness: no horizontal scroll at 320–1280px (tested at 320/360/390/768/1280); hamburger menu below 820px; tap targets ≥ 44px.
- Accessibility: semantic landmarks, visible focus (form already has a yellow focus outline), alt text, contrast AA in light and dark mode, `lang="et"`.
- The enquiry form currently only builds a `mailto:` link. Do not claim it "sends".

## 7. Image assets (currently hot-linked from Wix)

Base: `https://static.wixstatic.com/media/<id>` – these will break when the Wix subscription ends. **Download originals and self-host** (`/assets/img/`, WebP/AVIF + `srcset`, `width/height` set).

| Wix id (prefix `a7f28e_`) | Used for |
|---|---|
| `213e5225ab8e411cbaf145b82b54c3d9~mv2_d_4032_3024_s_4_2.jpg` | Hero, og:image |
| `7402480051cd40d093fe59e1f28aa045~mv2.jpg` | Logo (square) |
| `49c2a64583b44ef894a64e2770e6c94b~mv2.jpg` | Service: Töötoad (Neeme school) |
| `d96711c8a73f4287a56272f4e6fe22a1~mv2.jpg` | Service: Tehnoloogiatunnid |
| `7df29537faf14ca3bf3bca541e40da4b~mv2_d_6000_4000_s_4_2.jpg` | Service: Õpilahenduste arendus; makerset section |
| `c34f073e4336408ca677769001eef86c~mv2_d_4943_3296_s_4_2.jpg` | Service: Makerspace; school equipping |
| `a8fffa03b3bd41cd9d7cf3f80f7251c6~mv2.jpg` | Service: Mobiilsed töökojad |
| `ffc213a6c24c4383912ea94d55ce198d~mv2.jpg` | Career card, blog, gallery (Ida-Viru) |
| `68073d44abf044bf913b61f880205682~mv2.jpg`, `9792dc3de2404bb69f8caebfb630e963~mv2.jpg` | Blog / gallery |
| `1804c8ea80de4870aaba580d4528a812~mv2.jpg`, `a2de679276f844059b3e5e041ec508c1~mv2.jpg`, `67ca9d735af24001a6ba630a22aa21d7~mv2.jpg` | Gallery |
| `f7e3f445307f430f9781c4695dd28d42~mv2_d_4000_6000_s_4_2.jpg` | Team portrait (Lauri Soosaar) |
| `ce09094dd0c141a687e6057ea9b80fba~mv2.png`, `01bcdaf1c177432fa8fce697a5b217ce~mv2.jpg` | Award badges (EEPA, ETAG) |

## 8. Backlog (suggested order)

1. **Launch blockers:** fill `.todo` placeholders; confirm assumptions in §5; real testimonials.
2. **Self-host images and fonts** (also removes the Google Fonts IP-transfer note from the privacy text).
3. **Real form backend:** small endpoint on the owner's server (e.g. Node/PHP/Go) with validation, honeypot/rate-limit, SMTP to info@merkuur.eu, no data stored longer than the privacy text says. Keep `mailto:` as a no-JS fallback.
4. **Analytics (decided: self-hosted, cookie-free):** GoatCounter (preferred, single binary + SQLite) or Umami on `stats.merkuur.eu` behind nginx/Caddy with HTTPS. Add the one-line script once the owner provides the URL/ID. Track clicks on "Küsi pakkumist" and form submits only if Umami.
5. **Redirects from old Wix URLs** to the new pages (e.g. `/tootoad`, `/teenused`, `/futureclassroomlab`, `/snapmaker`, `/blog`, `/kalender-1`, `/meeskond`, `/projektid`) – keep SEO and inbound links. Generate an nginx `map`/`return 301` list.
6. **Subpages** in the same design: calendar, workshops, clubs, school equipping, makersets overview, projects, team, blog. Many buttons still link to the old Wix pages.
7. **SEO/perf:** per-page titles and descriptions, sitemap.xml, robots.txt, canonical, JSON-LD (Organization exists), compress assets, Lighthouse ≥ 90.
8. **Server hardening:** HTTPS (Let's Encrypt), HSTS, CSP, gzip/brotli, caching headers, firewall 80/443 only, backups.

## 9. Starter prompt (paste into Cursor chat)

> You are working on the new merkuur.eu website. Read `AGENTS.md` (this brief) and `index.html` first. Follow §5 and §6 strictly: Estonian only, no new languages, do not invent facts, keep services, school equipping and makersets at the top, keep Snapmaker de-emphasised.
>
> Task 1: Download all hot-linked Wix images listed in §7 into `assets/img/`, convert to WebP with sensible sizes, update `index.html` to use local files with `srcset`, `width`/`height` and `loading="lazy"` (hero image eager). Do not change the design.
> Task 2: Self-host the Barlow, Barlow Condensed and IBM Plex Mono fonts (woff2, `font-display: swap`), remove the Google Fonts links, and update the privacy paragraph "Küpsised ja kolmandad osapooled" accordingly.
> Task 3: Split inline CSS/JS into `styles.css` and `main.js` without changing behaviour. Verify at 320, 360, 390, 768 and 1280px that there is no horizontal scroll and that the mobile menu works.
>
> Show a short plan first, then make the changes in small commits. Ask me before touching anything listed under "Assumptions" in §5.
