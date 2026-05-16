# SIGTS wireframe deck (low fidelity)

Deliverable for **stakeholder alignment**: portable SVG wireframes you can show in a browser, embed in slides, or print. These are **not** visual design mockups; they document **information architecture**, primary **user tasks**, and **role boundaries** for the SIGTS (park digital guide) system.

## Audience: three client groups

| Stakeholder | Goals (summary) | Screens to walk through |
|-------------|-----------------|---------------------------|
| **1. Visitor / tourist** | Plan and enjoy the visit, learn, navigate safely, discover species | 00, 01, 02, 03, 04, 08 |
| **2. Field guide** | Run tours, record sightings, stay in sync when connectivity varies | 00, 01, 05 |
| **3. Park authority** (IT and staff) | Oversight, assignments, internal operations, compliance-oriented views | 00, 01, 06, 07 |

Everyone shares **authentication** (01). The **stakeholder map** (00) is the recommended opening slide when all three groups are in the room.

## Suggested presentation order

1. **`00-stakeholder-context.svg`** — one shared mental model: one platform, role-based entry.
2. **`01-authentication.svg`** — entry, recovery, and optional MFA / demo notices.
3. Then split by audience, **or** run **visitor path** first (broadest), then guide, then authority:
   - Visitor: **02** → **08** → **03** → **04** (home → catalog → map → AI).
   - Guide: **05**.
   - Authority: **06** → **07** (admin then intranet; order can swap by meeting focus).

## File index

| File | Label | Notes |
|------|--------|--------|
| `00-stakeholder-context.svg` | Context | Who uses what; use in joint sessions |
| `01-authentication.svg` | WF-01 | All roles |
| `02-dashboard-tourist.svg` | WF-02 | Visitor home / app shell |
| `03-map-guidance.svg` | WF-03 | Map, layers, legend |
| `04-ai-assistant-chat.svg` | WF-04 | Grounded / assistive chat pattern |
| `05-guide-operations.svg` | WF-05 | Guide shift, tour, sightings, sync |
| `06-it-admin.svg` | WF-06 | IT / manager dashboard |
| `07-intranet-staff.svg` | WF-07 | Staff intranet, access context |
| `08-animals-catalog.svg` | WF-08 | Species / biodiversity catalog |

## Visual language (conventions)

- **Solid rectangles**: panels, chrome, or primary layout regions.
- **Dashed outlines**: inputs, placeholders, or “to be defined” controls.
- **Light gray fills**: KPI tiles, quick actions, or non-interactive summary areas.
- **Labels on each screen** use `WF-xx | Role | Screen name` for traceability in feedback.

## How reviewers should comment

Focus feedback on **missed tasks**, **wrong priority**, **role leakage** (e.g., admin-only data on a tourist screen), and **dependency order** (what must ship before what). Pixel-perfect layout and branding are **out of scope** for this deck.
