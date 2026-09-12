This guide is for whoever teaches: creating a course, writing exercises, setting deadlines, and
reading what students submitted.

## The shape of the thing

UPolníček has four nouns, and everything else is a detail of one of them.

- A **group** is a course, or a seminar group inside one. It holds students and assignments, and it
  can hold subgroups.
- An **exercise** is a task with tests: a text, the files the tests need, limits, and at least one
  reference solution. Exercises live in a catalogue, independent of any course.
- An **assignment** is an exercise given to a group, with its own deadlines and points. The same
  exercise can be assigned to five courses and carry different deadlines in each.
- A **solution** is one student's attempt at one assignment. It is graded automatically, and you can
  override the result.

The distinction that matters: **you write an exercise once and assign it many times.** Changing the
exercise does not disturb the courses that already use it until you say so.

## Your course

Create it from **Groups**. A group needs a name in both languages the interface offers, and it
belongs to an instance — on a single-faculty deployment there is only one.

Three settings decide how it behaves:

- **Public** — whether students can find and join it themselves.
- **Organisational** — a group that only holds other groups. It can have subgroups but no
  assignments and no students. Use it for a department or a degree programme.
- **Archived** — a course that has finished. It stays readable and stops appearing in the lists
  people work from.

Students arrive in one of three ways: they join a public group themselves, you add them from the
roster, or you create an **invitation link** with an expiry and send it to them.

## Writing an exercise

From **Exercises**, create one, then fill in four things — the interface will not let you assign it
until they are all there.

1. **The text.** Markdown, in each language you intend to offer. Code fences and mathematics both
   render.
2. **The tests.** Each test names what goes in and what should come out. For the common shape —
   feed this to standard input, expect that on standard output — the built-in judge compares them
   for you, either exactly or ignoring whitespace.
3. **The limits.** Time and memory, per test and per environment. Start from the reference
   solution's own measured time and leave real headroom: the grading machine is not the student's
   laptop.
4. **A reference solution.** A correct solution that you submit yourself. **An exercise cannot be
   assigned without one**, deliberately: it is the proof that the tests, the limits and the
   pipeline actually work together, and it is where most configuration mistakes surface.

Submit the reference solution and read its verdict before going further. If it does not score
full marks, the exercise is not finished, and every student would have hit the same wall.

### Assignments that are not programs

Not everything can be run and tested. An essay, measured data, a presentation, a scan — that is
what the **Data** environment is for: it accepts **any file** whatever its extension, and compiles
and runs nothing. The only thing that happens to a submission is the check you attach to the
exercise yourself.

That check is **not optional**, and it is the one thing a data-only exercise goes wrong on. Without
it every submission comes back `FAILED`, reading `/box/: Is a directory`, on an exercise that
otherwise looks correctly configured. If all you want is to collect the file and mark it yourself,
attach a two-line script as an exercise file:

```bash
#!/bin/bash
echo "Submitted. Awaiting the teacher's review."
exit 0
```

The submission then scores full marks on the automatic part, that sentence appears to the student
among the results, and you award the real points by hand on the solution screen. If you do want to
check something — comparing submitted data against a model answer, say — it is an ordinary program
that receives the submitted files and decides.

A data-only exercise needs a reference solution too. It is simply a file you submit yourself.

### Importing from GitHub Classroom

An assignment template with an `autograding.json` can be imported instead of retyped. Its
`input`/`output` tests map cleanly onto UPolníček tests, the template's `README.md` becomes the
exercise text, and its other files become attachments.

What cannot be imported is stated rather than guessed at: a test that runs an arbitrary shell
command, or a whole test framework inside the repository, cannot become per-test input and output
pairs — the import will tell you which tests it could not translate. And a reference solution is
never in a Classroom template, so an imported exercise arrives **not yet assignable** until you
write one.

## Assigning it

From the group, choose **Assign an exercise**. The picker starts with your course's own exercises
and can widen to the whole catalogue.

Then set the terms:

- **First deadline** and the points before it.
- **Second deadline**, optional, with a lower score — late but not worthless. Points can drop in one
  step at the deadline, or slide between the two.
- **Points threshold** — the fraction of the points a solution has to reach before it counts at all.
- **Attempt limit** — how many times a student may submit. Leave it generous unless the exercise is
  an exam.
- **Visible from** — the assignment exists but stays hidden until then.
- **Which languages** a student may submit in.

Deadlines are typed in **your own time zone**, and are shown to every reader in theirs.

## Reading what came back

The assignment's **Solutions** tab lists every attempt, one row per submission. Open one and you
see what the student submitted, what each test did, and how the score was reached.

What you can do from there:

- **Award points the evaluation did not.** An override, with a note saying why. Use it when a
  solution is right in a way the tests do not capture — or wrong in a way they missed.
- **Accept an attempt.** By default a student's last submission counts; accepting marks a
  particular one as the one that does.
- **Write a review.** Comments on specific lines of the submitted code. A review stays yours until
  you close it, and only then does the student see it.
- **Re-evaluate.** Runs the tests again — after fixing a broken exercise, for instance.
- **Compare two solutions**, line by line, when you want to see what changed between attempts.

Students can ask for a review themselves, and those requests collect on your dashboard so the queue
is somewhere you look rather than something you remember.

## Exams

A group can be put into exam mode for a period you set: it starts now or at a time you choose, runs
for a length or until an end you name, and can lock students to the group for its duration. While an
exam is running, a locked student sees that course and nothing else.

Set it up before the room fills. The exam screen shows who is locked in and lets you release
somebody individually.

## Points that are not code

A **shadow assignment** is points without a submission — for a presentation, an oral exam, activity
in a seminar. It appears in the group's scoring alongside real assignments, and you type the points
in yourself, per student, with the date they were earned.

## Seeing the whole course at once

The group's **Students** tab is the points matrix: every student against every assignment, with
totals. It exports, and it links from any cell to that student's own attempts.

One student's whole course is its own screen — everything they submitted in it, in one place —
which is usually the fastest way to answer "how is this person actually doing".
