# Expansion matrix

Scored 1–10. **Priority** is a judgement, not an average — a cheap thing that
compounds beats an expensive thing that scores well on paper.

Frequency = how often a player would touch it. Retention = how much it makes
leaving costly. Cost = infrastructure, where 10 is cheap.

| Feature | Value | Diff. | Freq. | Retention | Revenue | Complexity | Cost | Risk | B/I | Priority |
|---|--:|--:|--:|--:|--:|--:|--:|--:|:--:|:--:|
| **Native video analysis (clips)** | 10 | 9 | 8 | 9 | 9 | 4 | 9 | 4 | Build | **1** |
| **Player timeline** | 8 | 8 | 9 | 10 | 5 | 8 | 10 | 1 | Build | **2** |
| **Calendar integration** | 8 | 5 | 10 | 7 | 4 | 8 | 10 | 2 | Integrate | **3** |
| **Video → development auto-link** | 9 | 10 | 7 | 9 | 7 | 6 | 9 | 3 | Build | **4** |
| **Player memory (durable)** | 8 | 8 | 10 | 9 | 6 | 6 | 8 | 3 | Build | **5** |
| **Report engine + PDF** | 8 | 7 | 3 | 6 | 8 | 6 | 8 | 2 | Build | **6** |
| **Smart import (photo/PDF/CSV)** | 8 | 7 | 6 | 6 | 5 | 7 | 8 | 3 | Build | **7** |
| **Data confidence / provenance** | 7 | 9 | 4 | 7 | 3 | 8 | 10 | 1 | Build | **8** |
| **Share links + permissions** | 7 | 5 | 4 | 6 | 6 | 7 | 9 | 4 | Build | **9** |
| **Video annotation (draw/arrow)** | 7 | 4 | 6 | 5 | 4 | 6 | 9 | 2 | Build | **10** |
| Voice match logging | 7 | 6 | 7 | 5 | 4 | 5 | 7 | 3 | Build | 11 |
| Social share cards | 6 | 4 | 4 | 3 | 7 | 7 | 9 | 3 | Build | 12 |
| Deep player profile 2.0 | 6 | 5 | 3 | 7 | 4 | 7 | 10 | 4 | Build | 13 |
| Player card / QR profile | 6 | 6 | 2 | 5 | 6 | 7 | 9 | 5 | Build | 14 |
| WHOOP / Oura | 6 | 4 | 8 | 6 | 4 | 6 | 8 | 3 | Integrate | 15 |
| Multilingual (ES/PT first) | 7 | 3 | 10 | 5 | 7 | 3 | 8 | 4 | Build | 16 |
| Comparison engine | 5 | 8 | 3 | 4 | 4 | 5 | 7 | 6 | Build | 17 |
| Knowledge graph expansion | 6 | 7 | 5 | 6 | 3 | 5 | 9 | 2 | Build | 18 |
| Career mode / player CV | 5 | 5 | 1 | 4 | 6 | 5 | 9 | 6 | Later | 19 |
| Proactive push (email/notif) | 6 | 4 | 8 | 7 | 5 | 6 | 8 | 5 | Build | 20 |
| Full-match video analysis | 6 | 8 | 2 | 5 | 6 | 2 | 5 | 6 | Later | 21 |
| Offline mode | 4 | 3 | 3 | 4 | 2 | 4 | 9 | 3 | Later | 22 |
| Strava | 3 | 2 | 5 | 3 | 2 | 6 | 8 | 6 | Later | 23 |
| AI agent architecture | 3 | 2 | — | 2 | 1 | 3 | 6 | 7 | Ignore | 24 |
| Garmin | 5 | 3 | 7 | 5 | 3 | 3 | 7 | 9 | Blocked | 25 |
| Match data providers | 4 | 3 | 3 | 3 | 3 | 2 | 3 | 8 | Ignore | 26 |
| GPS vendor APIs | 5 | 6 | 4 | 5 | 4 | 2 | 4 | 9 | Partner | 27 |
| Tracking CV (own build) | 6 | 9 | 3 | 5 | 5 | 1 | 2 | 10 | Ignore | 28 |

## Reading the table

**The top five are cheap.** Timeline, calendar and memory are assembly and
plumbing over data MIDO already holds. Native video is a rewrite of one provider
file. None needs a new company-scale capability.

**Multilingual scores oddly.** Highest possible frequency — a Spanish speaker
needs it every single second — but low differentiation and high complexity, and
it multiplies the cost of every future feature. It is a market-expansion
decision, not a product one. Do it when a market is chosen, not before.

**Full-match video ranks low despite being the headline ask.** It costs five
cents to analyse and $4 a season to serve, needs a queue, and cannot reliably
tell which player is you. Clips give most of the value at a fraction of the risk.

**Own-build tracking CV is bottom for a reason.** Highest differentiation on the
board, and still the worst idea here — a GPU pipeline plus an unsolved
re-identification problem is a company, not a feature.
