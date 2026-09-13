The limits say how much each test may use. A solution that goes past them fails that test — the
student sees that they hit a limit, not that their program computes the wrong answer.

This is not only about fairness: the sandbox has to have a ceiling, or one runaway solution takes
the machine and holds up everybody else's queue.

## Machines

A **hardware group** is chosen first — the class of machine the exercise is to be evaluated on. It
describes what a machine has, and its ceilings are what the limits below are measured against.

**An exercise with no group selected cannot be assigned.** On an ordinary installation there is one
group and ticking it is all there is to it.

Removing a group throws away the limits that were set for it. If you select several, limits are
entered for each and have to hold on all of them.

## Processor time or elapsed time

The **Measure processor time** switch decides what is actually measured:

- **processor time** — how long the program really computed. It is stable between runs, so the same
  solution fares the same today and tomorrow. The right choice for most exercises.
- **elapsed time** (switch off) — wall-clock time, waiting for disk or network included. It is what
  the student experiences, but it moves with how busy the machine is.

Switching **rewrites every limit** below into the other measure, so it is not a cosmetic choice —
check the numbers afterwards.

## The grid

Tests are rows, languages are columns. Each cell holds two numbers:

| Field      | Unit    | What it means                                                          |
| ---------- | ------- | ---------------------------------------------------------------------- |
| **Memory** | KiB     | The most the test may take. `65536` KiB = 64 MiB.                      |
| **Time**   | seconds | The longest the test may run, in whichever measure the switch selects. |

Why per language: the same solution in Python needs more just to start than in C, and a limit that
suits one cuts the other off at the starting line.

**The "total time" row** adds the column up and compares it against the ceiling for the whole
exercise. Limits can be fine cell by cell and still be refused for what they add up to — which is
why that row is on the screen.

## Choosing the numbers

1. Submit a **reference solution** and look at what it actually used.
2. Leave **headroom** — two to four times as much is usual. A reference solution is written by the
   author, who knows the right approach; a student is still looking for it.
3. After changing limits, **re-evaluate all** reference solutions. It is the quickest way to find
   out whether you have broken your own exercise.

**Data-only exercises** (collecting documents) come with their limits filled in. Nothing submitted
is executed — only the judge runs — so the numbers are there because the system requires them, and
you need not touch them.

## When it will not save

A value above the machine's ceiling is refused, and so is a column that adds up past the ceiling for
the whole exercise. The fields concerned are marked in red and the ceiling is printed above the
grid. **Zero is not allowed** — every test needs both a memory and a time limit.
