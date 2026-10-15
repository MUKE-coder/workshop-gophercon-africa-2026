# Tazama design

A clean nature site for wildlife sightings, after the Aeline and Rainforest Alliance references:
white pages, deep forest green, lime buttons, photos that melt into mist, and one handwritten word
per headline. "Tazama" is Swahili for "look".

## Colours

Defined on `:root` in `web/assets/css/app.css`, redefined for dark mode.

| Token          | Light     | Use                                         |
|----------------|-----------|---------------------------------------------|
| `--forest`     | `#1F4D3A` | Brand green: logo, numbers, links on hover  |
| `--moss`       | `#4E7D3A` | The handwritten word, bars, focus ring      |
| `--lime`       | `#D4F06A` | Main buttons, chips, accents on green bands |
| `--band`       | `#1F4D3A` | Face-off band and footer background         |
| `--paper`      | `#FFFFFF` | Page                                        |
| `--surface`    | `#F1F5EF` | Panels, badges, chart cards                 |
| `--ink`        | `#15201A` | Text                                        |
| `--muted`      | `#56655B` | Secondary text                              |
| `--line`       | `#E1E8DE` | Borders                                     |

Dark mode swaps the paper for `#0D1411`, the band for `#12271E`, and lightens forest and moss.

## Lettering

- **Geist** (`--font`): everything. Headlines weight 500, tight tracking (-0.05em).
- **Kalam** 700 (`--script`): one handwritten word per headline, as `<em class="script">`, in moss
  (lime on green bands). Never more than one word or short phrase.
- Fonts are self-hosted in `web/assets/vendor/fonts/`.

## Shapes and spacing

- Buttons are pills (`.pill`): `--lime` for the main action with a forest arrow circle,
  `--forest` for secondary, `--light` (white, bordered) for quiet ones.
- Radii: cards and photos 22px, panels 24-28px, stat boxes 18px, chips and buttons fully round.
- Sections: `--max` 1240px wide, `--gutter` 16-48px, generous vertical space (64-120px).

## Components

- **Hero**: text left (badge, headline, lede, buttons, four stat boxes); the newest photos on the
  right as a crossfading slideshow that fades into white mist on its left edge; three frosted
  "floating" cards for the newest sightings; animated 3D birds flying across.
- **Cards**: 4:5 photo, name with the weather, place, date and who recorded it. Tilt towards the
  pointer.
- **Face-off** (`#compare`): a forest band with:
  - two searchable country pickers (white boxes with flags and sighting counts, type to filter)
    and a round "vs" button that swaps them;
  - a scoreboard: four rounds (species, sightings, animals found only there, photos), a trophy
    verdict ("Kenya wins!"), lime stars on each round's winner, and confetti;
  - two columns of each country's most-seen animals with lime bars; the winner's column gets a
    lime outline and a "Winner" tag; shared animals tinted and listed as lime chips in the middle;
  - "Your comparisons": the visitor's last 8 match-ups, kept in their browser (localStorage).
- **Watch it move** (sighting page): free videos of the species from Wikimedia Commons, with
  credits and thumbnails to switch between them.
- **Map tips**: a frosted card on the map explaining zoom, drag, groups and dots; shown on a
  first visit, then behind a "How to use the map" button.
- Flags come from flagcdn.com and simply disappear if they can't load.
- **The zoo** (`/zoo`, `web/assets/js/zoo.js`): a low-poly 3D park in the same greens. Seven
  enclosures in a ring round a plaza with a fountain: zebras (the three.js horse with shader
  stripes), flamingos over a lagoon, macaws in a wire-dome aviary, and screens playing Wikimedia
  Commons footage of lions, elephants, giraffes and penguins. Real sighting photos stand on wooden
  boards. Frosted glass cards (`--glass`) hold the welcome, one panel per enclosure (fact, numbers,
  photos, camera angles, Showtime) and the strip of enclosures along the bottom. Day or night
  follows the site theme; lamps light up at night. A home page teaser links to it.
- **Globe**: light, forest coastlines, coloured dots per species.

## Motion

- Pages open with a circle bursting out from the click (View Transitions, GSAP fallback); a
  sighting's photo flies from its card to its page.
- One hero intro, floating cards bobbing, rows and bars growing on scroll.
- Everything respects `prefers-reduced-motion`.

## Avoid

- The earlier kanga patterns and the zigzag borders: the user moved away from them.
- More than one handwritten word per heading.
