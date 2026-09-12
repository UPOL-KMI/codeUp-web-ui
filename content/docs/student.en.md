How to sign in, join a course, submit a solution and read the result of its evaluation.

## Signing in

Sign in with your institution's account if the sign-in page offers it. Otherwise register with an
email address and a password, and confirm the address using the link you receive.

An invitation link enrols you in the course once you accept it. If you do not have an account yet,
you can create one from the same link.

## Courses and deadlines

Signing in opens the **Overview**: a month calendar of submission deadlines and a list of the
assignments you have not finished, ordered by the nearest deadline. Each row shows the points
available and the state of your attempts.

**Groups** lists the courses you are enrolled in. A public course can be joined from there; a
private one is joined through a teacher or an invitation link.

## Submitting a solution

Open the assignment and read its terms: the deadline, the points, the number of attempts allowed
and the permitted languages.

Then choose **Submit a solution**:

1. Upload the files. An archive is accepted too.
2. If the assignment permits several languages, select the one you used.
3. If the solution has several files, name the program's entry point.
4. Confirm with **Submit**.

Evaluating an ordinary program takes a few seconds. The page follows the progress itself and shows
the result as soon as it is available.

## Assignments that are not programs

An assignment need not be a program. A teacher may require a text, measured data, a presentation or
a scan. Submission works the same way, except nothing is compiled or run: the evaluation confirms
receipt and the teacher awards the points by hand. Deadlines, attempts and feedback all work as
they do for programs.

## The result of an evaluation

The solution screen states the score and the result of each test:

| Result                    | Meaning                                                    |
| ------------------------- | ---------------------------------------------------------- |
| **OK**                    | The test passed                                            |
| **FAILED**                | The program ran and produced an incorrect output           |
| **Time limit exceeded**   | The time limit was exceeded                                |
| **Memory limit exceeded** | The memory limit was exceeded                              |
| **Compilation failed**    | The solution did not compile; the compiler output is shown |
| **Runtime error**         | The program failed, or exited with a non-zero status       |

The score follows from which tests passed and how much each is worth, so a partially correct
solution receives part of the points.

For a test that did not pass, compare the expected output against the actual one. How much of the
output is shown is set by the teacher in the exercise configuration.

Submitted files can be opened at any time, and two attempts can be compared side by side.

## Deadlines and attempts

An assignment may carry a second deadline worth fewer points. The assignment states how many points
apply before the first deadline and how many between the first and the second.

Where the number of attempts is limited, the assignment screen states how many remain. Test the
solution against the example in the assignment before submitting; tests compare the output
including whitespace.

The **last** submitted solution is the one graded, not the best one. If an earlier attempt should
count instead, ask your teacher — they can accept it.

## Requesting a review

A review can be requested from the solution screen. The solution then enters the teacher's queue;
the request can be withdrawn.

A review consists of comments on particular lines of the submitted solution. It becomes visible
once the teacher closes it.

## Exam mode

For the duration of an exam a teacher may lock you into a single course. While the lock holds, other
courses are not accessible; it is released when the exam ends.

## Troubleshooting

- **The evaluation failed with an infrastructure error.** This is not a fault in your solution.
  Report it to your teacher.
- **You believe the solution is correct but a test did not pass.** Check the exact output including
  whitespace, then request a review and state where you believe the test is wrong.
- **The submission cannot be made.** The deadline has passed, the attempts are used up, or the
  selected language is not permitted. The assignment screen states which.
