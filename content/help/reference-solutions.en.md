A reference solution is your own answer to your own exercise, run through exactly the pipeline a
student's will be. It tests the tests: when it fails, the fault is not in the solution but in how
the exercise is set up.

**Where an exercise has automatic tests, at least one reference solution is required** — without it
the exercise cannot be assigned. Data-only exercises need none, because nothing is run and nothing
is compared.

## What to submit

A solution that is supposed to pass — the right answer. You upload the files exactly as a student
would and the system works out which language they are.

Several are usually worth having:

- a correct solution in **every language** the exercise allows,
- a **slow but correct** one — it shows whether the time limit is set too tightly,
- an **obviously wrong** one — it shows that the tests actually catch a mistake. An exercise where
  nonsense passes is worse than one with no tests at all.

## What the result tells you

| State                      | What it means                                                                   |
| -------------------------- | ------------------------------------------------------------------------------- |
| **All tests passed**       | The exercise is set up the way you meant it.                                    |
| **Some tests passed**      | Some test has the wrong expected output, the wrong input, or too tight a limit. |
| **No test passed**         | Most often the wrong judge, or the input and the expected output swapped.       |
| **Compilation failed**     | A missing extra file, or the wrong entry point.                                 |
| **Could not be evaluated** | An infrastructure failure, not your solution's. Re-evaluate it.                 |

Open a solution to see the result test by test, memory and time included — which is what sensible
limits are chosen from.

## Re-evaluate

**After every change to the tests, the limits or the judge, run "re-evaluate all".** The reference
solutions are run against the exercise as it stands now, and you see immediately whether the change
broke something that used to work. The results stored with a solution are always from the run that
happened — not from how the exercise is configured today.

## Who can see them

| Level                | Who reaches the solution                                           |
| -------------------- | ------------------------------------------------------------------ |
| **Teachers only**    | The default. Students do not know it exists.                       |
| **Students too**     | Students may read it. Consider whether that gives the answer away. |
| **Canonical answer** | Marked as the exemplary answer among the others.                   |

A private reference solution is visible **only to its author**. Take an exercise over from a
colleague and you will not see theirs — the screen says so; submit your own.

## Deleting

Deleting one also removes everything the pipeline recorded about it. If it is the exercise's last
reference solution, the exercise becomes unassignable until another one arrives.
