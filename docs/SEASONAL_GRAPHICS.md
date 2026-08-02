# Seasonal Closure Graphics — System Spec

**Status:** Decided 2026-08-01. Not yet drawn.
**Belongs in:** the brand style guide, as a subsection of the icon strategy.
**Referenced by:** `docs/STUDIO_CLOSURES.md` §16.7 — the `seasonal_graphic` field.

## Why this exists

The 2026–2027 closure flyers use stock clipart: a word-cloud turkey, bubble-letter
Spring Break, Memorial Day balloons, a generic pumpkin. Nothing in the set says
ballet school, nothing matches anything else, and the backgrounds run saturated
lime, orange and red — none of which are brand colours.

The studio already owns a better visual language. The production lockups (Sylvia,
Giselle, Paquita, and the 2024 Nutcracker t-shirt art) share one architecture: a
scene inside a ring. This spec extends that architecture to closures so the
seasonal layer reads as part of the brand rather than borrowed from a clipart
library.

## The container

**A circular ring enclosing a scene.** Same construction as the production
lockups, with one deliberate difference: **no arced studio name.**

The name comes off because the wordmark already sits at the top of every flyer.
Repeating it inside the graphic reads as redundancy at flyer scale, and removing
it makes the ring reusable in any context where identity is established
elsewhere — social posts, web banners, email headers.

The ring itself stays. It is what makes twelve different subjects feel like one
set, and it means the flyer template never needs adjusting per closure: every
graphic is the same shape at the same size.

## Colour rule

**One occasion colour plus lavender. Never a full seasonal palette.**

The occasion earns an exception; it does not license abandoning the brand. Where
a closure has no strong seasonal association, lavender alone carries it.

| Closure | Colour |
|---|---|
| Labor Day | Lavender `#B4A7D6` |
| Halloween | Orange + lavender |
| Veterans Day | Navy + red, restrained |
| Thanksgiving | Warm amber + lavender |
| Nutcracker | Red + green — the production's own identity |
| Winter Recess | Deep green + lavender |
| MLK Day | Lavender |
| Presidents Day | Lavender |
| Spring Recess | Blush `#F1E1DD` + lavender |
| Memorial Day | Navy + red, as Veterans |
| Last day of school | Gold `#C9A84C` + lavender |
| Fourth of July | Navy + red |

Nine of twelve lean lavender, so the system holds.

Two of the assignments do double duty and need no exception at all: **Blush** is
already the universal support colour, and **Gold** is already reserved for
achievement — which the last day of the school year is.

### Colours that must not appear

**Dark Pink `#E485B6` and Teal `#51AFC2` are location codes.** Pink means San
Clemente, teal means Rancho Santa Margarita. A seasonal graphic using either
collides with location scoping on exactly the flyers where location matters most.
Keep both out of the seasonal palette entirely.

### Background

**White or blush. Never a saturated field.**

The current flyers put the colour in the background — lime green, saturated
orange, bright red — which is the single largest reason they read as amateur.
Colour lives in the illustration; the page stays quiet. This also keeps the
headline legible, since `date_line` and `scope_line` sit directly above the
graphic.

## Line treatment

Match the existing production art: **thin outline vector illustration**,
consistent stroke weight across the set, no fills where an outline will do, no
gradients, no drop shadows.

The reference for weight is the pointe-shoes-and-bow illustration from the Sylvia
set and the interior scene of `BAM 2024 Nutcracker T-Shirts.ai`. Draw one graphic
to final quality first, fix the stroke weight from it, and match the remaining
eleven to that.

## Subjects

Every subject is framed through ballet. That is the whole point — a pumpkin is
clipart, pointe shoes with a pumpkin is a ballet school's Halloween.

| Closure | Scene |
|---|---|
| Labor Day | Pointe shoes at rest, ribbons loose |
| Halloween | Pointe shoes with a small pumpkin, or costumed silhouette |
| Veterans Day | Slippers with a ribbon in flag colours |
| Thanksgiving | Slippers with autumn leaves and a garland |
| Nutcracker | Ballerina, tree, soldier — the interior of the 2024 t-shirt art, titling removed |
| Winter Recess | Pointe shoes with pine and a snowflake |
| MLK Day | Neutral — the barre motif from the wordmark |
| Presidents Day | Neutral — the barre motif |
| Spring Recess | Slippers with blossoms |
| Memorial Day | Slippers with ribbon, as Veterans |
| Last day of school | Pointe shoes with a graduation motif |
| Fourth of July | Slippers with ribbon and stars |

MLK Day and Presidents Day share the neutral treatment deliberately. Both are
observances rather than festive occasions, and a ballet-themed decoration would
be tonally wrong on either.

## Source material

`BAM 2024 Nutcracker T-Shirts.ai` has ten artboards and contains, already drawn:

- The Nutcracker interior scene — ballerina, tree, soldier, gifts
- Pointe shoes with a bow, top right — the base for Halloween, Spring, Summer
- The ring construction itself

Several of the twelve are an extraction and recolour rather than a new drawing.

## Export

- **SVG** preferred; PNG at 1042×1042 minimum as fallback, matching the existing icon set
- Transparent background — the flyer supplies white or blush
- Square canvas, ring centred, consistent margin so every graphic drops into the same frame without adjustment

## Naming

`ba-m-closure-<occasion>` — e.g. `ba-m-closure-halloween`,
`ba-m-closure-nutcracker`, `ba-m-closure-winter-recess`.

Never prefixed `BAM`. Filenames appear in page source and image search.

## How the platform selects one

The graphic is **not derivable from `studio_closures`** — no column says
"pumpkin." It is a lookup the platform owns, mapping closure reason to image URL,
with an admin override for the cases the map gets wrong.

This resolves the one field left unspecified in `STUDIO_CLOSURES.md` §16.7.

## Order of work

1. Draw **Nutcracker** first — it is an extraction from existing art and it fixes stroke weight, ring proportion and margin for the whole set.
2. Draw **Halloween** second. It is the first genuinely new subject and the first test of whether the occasion-colour rule holds.
3. Review both against a flyer at print size before drawing the remaining ten.
