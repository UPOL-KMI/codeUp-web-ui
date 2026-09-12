This guide is for students: getting in, finding your courses, submitting a solution, and
understanding what came back.

## Getting in

If your school signs you in with its own account, use that button on the sign-in page and you are
done. Otherwise register with an email address and a password, and confirm the address from the
message you receive.

If you were sent an **invitation link** to a course, opening it and accepting puts you in that
course. You can create an account from the same link if you do not have one yet.

## Finding your courses

The **dashboard** is what you see after signing in. It shows the assignments you have not finished,
nearest deadline first, with what each is worth and where it stands.

**Groups** lists every course you are in. A public course you are not in yet can be joined from
there; a private one needs your teacher to add you or send an invitation.

## Submitting

Open the assignment and read it first: the text, what the tests expect, and the terms — the
deadline, the points, how many attempts you have, and which languages are allowed.

Then **Submit a solution**:

1. Add your files. Several files are fine, and so is an archive.
2. If the assignment allows more than one language, pick the one you wrote in.
3. If your solution has more than one file, say which one the program starts from.
4. Submit, and watch the evaluation run.

Evaluation takes seconds for a small program. The page follows along and shows the result when it
lands, without your reloading anything.

## Reading the result

A solution's screen shows the score, and then each test with what happened in it:

| What you see              | What it means                                        |
| ------------------------- | ---------------------------------------------------- |
| **OK**                    | The test passed                                      |
| **FAILED**                | The program ran and produced the wrong answer        |
| **Time limit exceeded**   | It was too slow — usually an algorithm, not a detail |
| **Memory limit exceeded** | It used more memory than the exercise allows         |
| **Compilation failed**    | It did not build. The compiler's own output is shown |
| **Runtime error**         | It crashed, or exited with a non-zero status         |

The score is computed from which tests passed and what each is worth, so a partially correct
solution usually gets partial marks.

Read the failing test rather than guessing: how much of the output was visible to you is the
teacher's choice, but where it is shown, comparing what was expected against what your program
printed usually ends the argument in one line.

You can open the files you submitted at any time, and compare two of your attempts side by side to
see what actually changed.

## Deadlines and attempts

An assignment can have a **second deadline** worth fewer points. Submitting late is then worth
something rather than nothing — the assignment says exactly how many points, before and after.

If an assignment limits attempts, the screen says how many you have left. Test your program
yourself before spending one: run it on the example from the text and check the output character
for character, since whitespace is often compared too.

By default, the **last** solution you submit is the one that counts — not the best one. If you
submit something worse after something better, ask your teacher to accept the earlier attempt;
they can.

## Asking for a review

You can ask your teacher to look at a solution — **Request a review** on the solution screen. It
puts your submission in their queue, and you can take the request back.

A review is comments on particular lines of your code. It appears when your teacher closes it, not
while they are still writing, so silence after a request does not mean it was ignored.

## Exams

During an exam your teacher can lock you into one course: while the lock holds you see that course
and nothing else, and it releases itself when the exam ends. If you are locked out of something you
need during an exam, that is a question for whoever is invigilating.

## If something looks wrong

- **The evaluation failed rather than judging your program.** That is infrastructure, not your
  code. Tell your teacher — it is visible to them and not something you can fix.
- **Your solution is right and the test disagrees.** Check the whitespace and the exact wording of
  the output first, then ask for a review and say what you think the test is doing wrong.
- **You cannot submit.** The deadline may have passed, you may be out of attempts, or the language
  you chose may not be allowed. The assignment screen says which, rather than just refusing.
