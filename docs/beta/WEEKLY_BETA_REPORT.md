# Founding XI — Weekly Beta Report

> **Status: no data yet.** The beta has not started — migrations are
> unapplied and no players have signed up. Everything below is the
> template, kept empty on purpose. **Do not fill it with estimates.** A
> weekly report containing plausible numbers nobody measured is worse
> than no report, because the decisions made from it feel evidence-based
> and are not.
>
> Week 1 begins the day the first founder signs up. Source the numbers
> from `/app/admin/beta` and the queries in `FOUNDING_XI_METRICS.md`.

---

## How to use this

One section is the whole discipline: **what players SAY** and **what
players DO** are recorded separately, and where they disagree the
disagreement is the finding. A player who calls Film Room "amazing" and
opened it once has told you two things, and the second one is the one
that matters.

Copy the template below for each week. Keep old weeks — the trend across
weeks is the product review, and a report that gets overwritten is a
snapshot, not evidence.

---

## TEMPLATE — Founding XI, Week N (dates)

### Active players
`N of 11 active this week` · list who, and who has gone quiet.
Anyone at 0 active days gets a message, not a metric.

### Retention
| Player | D1 | D3 | D7 | D14 | D30 | Active days |
|---|---|---|---|---|---|---|
| | | | | | | |

At eleven players this is read name by name. Do not compute a retention
curve from eleven people and treat it as a rate.

### What they did — most used
| Action | Players | Total |
|---|---|---|

### What they did — least used
| Action | Players | Total |
|---|---|---|

An action at 0 players is either broken, hidden, or not wanted. Those
are three different problems; the next section decides which.

### Core loop completion
| Player | Goal | Check-in | Study | Match | Review | Training | Film |
|---|---|---|---|---|---|---|---|

**Where do players stop?** If several stop at the same step, that step
is the product problem of the week.

### Next Best Action
- Shown / Opened / Why-viewed / Completed / Dismissed:
- Open rate:
- Completion rate:
- **If ignored:** do NOT make it more prominent. Name the suspected
  cause first — bad advice, wrong timing, unclear value, already done
  offline, placement, too demanding — and say how you would tell them
  apart.

### AI quality
- 👍 / 👎 totals, by surface:
- Every 👎 reason, verbatim:
- Failure category for each (wrong context · generic · football quality
  · hallucination · repetitive · too long · too short · wrong
  recommendation · technical failure):
- **Pattern?** Fix the system. **One-off?** Leave it. Never hand-patch
  an individual response.

### Study / Film / Training / Match engagement
One line each: how many players, how many times, anything notable.

### Bugs
| # | Report | Severity | Status | Fixed in |
|---|---|---|---|---|

### What players SAY
Verbatim quotes, attributed. Do not paraphrase into agreement.

### What players DO
The behaviour next to the quotes above. Note every place the two
disagree — that list is usually the most valuable output of the week.

### Repeated requests
Only things asked **independently by 3+ players**. One player asking for
a nutrition tracker is not a signal; seven players saying "I don't know
what to do after my match" is the roadmap.

### Confusion points
Where players said they did not understand something, plus every
`confusing` feedback row.

### Failed workflows
Anything a player started and could not finish. Cross-reference
`[client-error]` log lines and video rows stuck in `processing`.

### Top 5 findings

1.
2.
3.
4.
5.

### Recommended changes
Each with a priority (P0 fix now · P1 blocks the loop · P2 improves a
workflow · P3 idea, not during beta) and the evidence behind it. Anything
without evidence does not go on this list — it goes in
`PRODUCT_DECISIONS.md` as an unvalidated idea, or nowhere.
