A test is one run of a submitted solution: it is given some input, it writes something, and what it
writes is compared against what it should have written. An exercise can have several — typically
one per case you want to check.

**Files are chosen, never typed.** Everything referred to here — inputs, expected outputs, a custom
judge — has to be attached to the exercise first, under **Exercise settings → Files**. Until
something is there, these lists are empty.

## Input

What the solution is given before it runs.

| Field              | What it is for                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Input files**    | Files placed next to the solution. The second box says what name the solution sees them under; left empty, the file keeps its own name. |
| **Standard input** | A file whose contents are fed to the solution on standard input (what `input()` reads in Python, `scanf` in C).                         |

**Example.** The test checks a sum read from a file. Attach `sum-01.in` to the exercise, pick it as
_Standard input_, and the solution reads it as though it had been typed.

**Example with a different name.** The assignment says "the program reads `data.csv`". Attach
`test1-data.csv`, put it in _Input files_, and write `data.csv` as its second name. Every test can
then have its own data under one fixed name.

## Execution

How the solution is started.

| Field         | What it is for                                                      |
| ------------- | ------------------------------------------------------------------- |
| **Arguments** | Passed to the program on the command line. One row is one argument. |

**Example.** Arguments `--mode` and `fast` reach the program as two separate items, i.e.
`program --mode fast`. Do not write them on one row; separating them with a space is not the same.

Most exercises leave this empty and pass their data through the input instead.

## Output

What is asked of the solution and what it is compared against.

| Field                        | What it is for                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Compare a file it writes** | By default what the program prints is judged. Turn this on and a file the program creates is judged instead.                         |
| **The file it writes**       | That file's name — shown only while the switch is on.                                                                                |
| **Expected output**          | The file holding the right answer. **Without it the exercise cannot be assigned**, because the judge has nothing to compare against. |

**Example.** Attach `sum-01.out` containing the single line `42`, pick it as _Expected output_, and
a solution passes when it prints the same.

One exception: **data-only** exercises (collecting documents) need no expected output — nothing is
run and nothing is compared, and the teacher marks the submission by hand.

## Judging

Who decides whether the output matches.

| Field                  | What it is for                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Comparison**         | A built-in judge. _Token by token_ is the usual choice: whitespace does not matter, the order of words and numbers does. |
| **Use a custom judge** | Runs a program of yours instead of the built-in comparison.                                                              |
| **Judge program**      | The file holding that program, again attached to the exercise.                                                           |
| **Judge arguments**    | Passed to your judge **before** the pair of files it compares.                                                           |

**Which built-in judge.** _Token by token_ for ordinary text and whole numbers. _Numbers
approximately_ when the result depends on rounding. _In any order_ when the order of the answers
does not matter. _Byte by byte_ when the output has to match exactly, whitespace included.

**A custom judge** is handed two files — the expected and the actual output — and must exit with
code 0 on a match. It writes a score between `0.0` and `1.0` on the first line of its standard
output, so it can award partial credit.

## Build and run (per language)

This part repeats for each chosen language, because each one builds a solution differently.

| Field                                | What it is for                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| **Entry point**                      | The file to run when a student submits several. Left empty, it is chosen at submission time. |
| **Exit codes that count as success** | Usually `0`. Single values or ranges separated by commas, e.g. `0, 2-4`.                     |
| **Extra files**                      | Added to the solution **before** it is built — headers, modules, libraries.                  |

Which fields appear depends on the language: Java has no entry point, C takes no `.jar` libraries.

## Before you assign the exercise

1. Attach the files (**Exercise settings → Files**).
2. Give every test at least an **expected output**.
3. Save the configuration.
4. Set the **resource limits** — memory and time per test.
5. Submit a **reference solution**. It is your own answer, and it is what proves the tests work.

Whatever is still missing is named in the red panel at the top of this screen and of the exercise.
