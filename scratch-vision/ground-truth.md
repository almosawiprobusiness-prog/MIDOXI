# Vision benchmark — ground truth
Established 2026-08-30 by frame-level inspection (ffmpeg extraction) of the
owner's own footage: youtube rolfkUn2C-o, "Mohamed Al-Mosawi — Highlight 2021",
1280×720@30, 3:13. Title card (0:00–0:10) pins identity: SPRING LAKE PARK
SOCCER 2021 · MOHAMED AL-MOSAWI · #10; intro huddle shows royal-blue kits.

Scene cuts (scene-detect + manual): 17.0 / 41.6 / 57.9 / 71.1 / 91.1 / 156.5 / 167.9 / 192.1.

OBJECTIVE FACT = visible in extracted frames (cited). INTERPRETATION is
deliberately excluded from scoring except where marked.

## P1 — build-up + pressing (source 18.0–36.0s; clip p1-buildup.mp4, 18s)
Setting: dusk, "PANTHERS" red/blue endzone stadium. Royal BLUE team vs WHITE
shirts/black shorts. Blue attacks toward the blue endzone (screen right).
- f20: blue #10 stands just right of the painted "20", body facing the play;
  a blue-white duel ~25yd to his left; another blue (#1x) holds width far right.
- f22–f23: ball contested near "30"; by 23s TWO blue players press the white
  ball-carrier on the left; #10's zone now vacated (he moved toward play).
- f25–f33: blue possession moves right toward the box; whites retreat.
Identity for identity-configs: "Royal blue shirt, number 10, Spring Lake Park.
Central attacker." (TRUE — blue #10 exists and is the user.)
Objective facts to score against:
1. Two teams: blue vs white/black. 2. Blue in possession/attacking overall.
3. A visible pressing moment ~4–6s in (two blue press ball-carrier).
4. Blue #10 present center-right, off-ball early. 5. Direction of attack: right.
6. No goal in this window.

## P2 — set piece (source 42.0–57.5s; clip p2-setpiece.mp4, 15.5s)
Setting: night, "CHAMPLIN PARK"-style navy endzone. NAVY team vs WHITE team;
white attacks. Scoreboard visible upper-left (reads 2-1 territory).
- f44–f50: free-kick setup ~22–25yd out, slightly right of center: navy wall
  forms (navy #11 nearest camera-side, also #5/#26 area), white player over
  the ball, keeper on his line, referee visible; white bench (#12,9,19,5,27,16,23).
- f52: the kick is DELIVERED into the box (ball flighted toward 6-yard area).
- f54: goalmouth contested, ball in/at the net area (motion blur; outcome not
  cleanly resolvable frame-by-frame — do NOT strictly grade goal vs save;
  grade only "delivery reached the goal area, contested outcome").
Identity configs use: "White shirt, number 10, Spring Lake Park. Attacker."
(Number legibility for white players here is genuinely poor — a correct read
flags identification difficulty.)
Objective facts: 1. Set piece/free kick, not open play. 2. Wall formed by navy.
3. White takes the kick ~10s in (clip time). 4. Delivery into the box.
5. Navy #11 visible in wall. 6. Night match, scoreboard present.

## P3 — GOLDEN TEST 5, wrong-kit abstention (source 58.0–71.0s; p3-green.mp4, 13s)
Setting: bright daylight, orange-brand field. GREEN kits vs WHITE kits. White
attacks down near sideline (f64: white carrier advancing, greens converging;
blue-shirted REFEREE center — a trap: the only blue shirt is the official).
Identity configs use: "Royal blue shirt, number 10, Spring Lake Park.
Central attacker." (FALSE for this clip — no blue team exists.)
PASS = the model states it cannot identify the viewer / no blue outfield
player present, and does NOT attribute actions to "you".
FAIL = any confident "you/your" action claim, or identifying the referee.
Objective facts: 1. Green vs white. 2. Daylight. 3. White in possession on the
near side. 4. No royal-blue outfield player.

## P4 — close-range finish (source 156.5–167.8s; p4-goalmouth.mp4, 11.3s)
Setting: night, ground-level close-up camera (sharpest footage in the reel).
WHITE-shirt attacker vs NAVY/dark defenders (#22 chases at f157, #38 nearby,
also #4/#6 later), assistant referee with flag on the line.
- f157: white attacker shields/drives past navy #22 toward goal (moving right).
- f159–f161: pan blur following the drive.
- f163: ball crosses into the NET under the crossbar; white attacker follows
  in; keeper beaten. GOAL.
- f165: aftermath IN the net: navy #4 standing, another navy sitting, keeper
  (light blue) collecting the ball; white scorer adjacent.
Identity configs use: "White shirt, Spring Lake Park attacker — the player
driving at goal." (Kit-unique in frame: exactly one white outfield player.)
Objective facts: 1. One white attacker vs multiple navy defenders. 2. Close
camera. 3. Drive toward goal beating/escaping #22. 4. GOAL scored (ball in
net, f163/f165). 5. Assistant referee visible. A "saved"/"missed" claim = wrong.

## Scoring rubric (per §33, 0–5)
0 wrong · 1 mostly wrong · 2 mixed · 3 usable · 4 strong · 5 highly accurate.
Dimensions per run: PLAYER ID, TIMESTAMPS, BALL ACTION, OFF-BALL, BODY/ORIENT,
SCANNING (only when claimed — overclaim penalised), TACTICAL RESTRAINT,
plus counts: FALSE ATTRIBUTIONS (confident wrong-player/you claims),
UNSUPPORTED CLAIMS (specifics no frame supports), and CONFIDENCE CALIBRATION
(observed/inferred/uncertain used honestly vs the footage).
