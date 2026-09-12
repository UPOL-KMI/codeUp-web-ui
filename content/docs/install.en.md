This guide takes a machine with Docker on it and ends with a working ReCodEx: an API, a database,
a sandboxed worker that grades real submissions, and this frontend serving the front door.

It is written for whoever administers the server. Teachers and students need none of it.

## Before you start

| Requirement                 | Why                                                |
| --------------------------- | -------------------------------------------------- |
| Docker with Compose v2      | Everything runs in containers, including the build |
| **cgroup v2 on the host**   | The sandbox refuses to run without it — see below  |
| ~10 GB of disk              | Images, the worker toolchains and uploaded files   |
| A DNS name or a hosts entry | The stack is addressed by name, not by IP          |

**cgroup v2 is the one requirement worth checking first**, because it is the one that cannot be
fixed afterwards by editing a config file. Submitted code runs inside `isolate`, the same sandbox
used by the IOI, and version 2.7 needs the kernel's unified cgroup hierarchy:

```bash
mount | grep cgroup
```

A cgroup v2 host answers with a single `cgroup2` mount at `/sys/fs/cgroup`. That is the default on
current Debian, Ubuntu and RHEL, and on Docker Desktop — including on a Mac. If your host is still
on v1, the deployment's README explains how to pin the older sandbox instead.

## Install

```bash
git clone git@github.com:UPOL-KMI/upcode-deploy.git
cd upcode-deploy
./pull-repos.sh
cp .env.example .env
```

Then edit `.env`. These are the entries that decide whether the stack comes up at all:

| Entry                                   | What to put there                                                      |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `APP_DOMAIN`                            | The address people will type. Everything else is derived from it       |
| `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` | New passwords. Nothing else reads them                                 |
| `JWT_SECRET`                            | A long random string. Changing it later signs everybody out            |
| `BROKER_AUTH_*`, `WORKER_FILES_AUTH_*`  | Shared secrets between the internal services                           |
| `RECODEX_INSTANCE_NAME`                 | What this deployment calls itself, in the header and on the front page |
| `SMTP_*`, `MAIL_FROM`                   | Outbound mail. Leave unset and the product works, but sends nothing    |

Then build and start:

```bash
docker compose build        # 5-10 minutes the first time: the worker and sandbox compile from source
docker compose up -d
docker compose logs -f api  # first boot runs migrations, fixtures and the runtime imports
```

Wait for the `api` log to settle before opening anything. First boot does real work: it creates the
schema, imports the runtime packages that make grading possible, and names the instance from
`.env`.

For a local install, point the name at yourself first:

```bash
echo "127.0.0.1  recodex.local" | sudo tee -a /etc/hosts
```

Then open `http://<APP_DOMAIN>/`.

## The first account

First boot seeds one administrator, `admin@admin.com` with the password `admin`.

**Sign in and change that password before the machine is reachable by anybody else.** It is a
known pair, published in this guide and in the deployment's README, and it is a full superadmin.

From there, everything else is done through the interface: create real accounts, give somebody else
the administrator role, and disable the seeded one.

## What runs, and what each part is for

| Service    | Role                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| `proxy`    | The only port anybody outside needs. Routes `/api/v1` to the API and everything else to the frontend |
| `web-next` | This frontend                                                                                        |
| `web-app`  | The legacy frontend, kept on a port of its own as a reference                                        |
| `api`      | core-api: accounts, groups, exercises, assignments, permissions                                      |
| `mysql`    | The database                                                                                         |
| `broker`   | Hands evaluation jobs to workers                                                                     |
| `worker`   | Runs submitted code in the sandbox and produces a verdict                                            |
| `monitor`  | Streams evaluation progress to the browser while a submission runs                                   |
| `cleaner`  | Expires the worker's file cache                                                                      |

## Languages a student can submit in

The worker image installs `bash`, C and C++ (GCC), Python 3.13, the .NET 8 SDK for C#, and a JDK
for Java, and the API imports the matching pipelines on first boot. An environment needs **both**:
the toolchain in the worker image, and a pipeline in the database that says how to compile, run and
judge it.

Adding a language means installing its toolchain in `services/worker/Dockerfile`, adding its name
to `headers.env` in `services/worker/config.yml.template`, adding its package to
`services/api/Dockerfile`, rebuilding, and then — on a database that already exists — importing the
package once by hand:

```bash
docker compose exec api php bin/console runtimes:import --yes /opt/recodex-runtimes/<package>.zip
```

Two version pins are load-bearing and documented where they live: the .NET runtime is pinned to 8
because the C# package refuses to roll forward to 9 or 10, and Python is built from source at 3.13
because Debian's 3.11 rejects syntax students write every day.

## Checking that grading actually works

An installation that serves pages is not yet an installation that grades. The check is to submit
something and read the verdict:

1. Sign in as the administrator.
2. Create a group, create an exercise, give it a reference solution, and assign it.
3. Submit a solution to your own assignment.
4. Watch the evaluation and read the result.

If submissions stay queued, the worker is not reaching the broker. If they come back as failures
rather than verdicts, the sandbox is usually the reason:

```bash
docker compose logs worker | grep -E "cgroup v2 subtree|cgroup support"
```

## Updating

```bash
./pull-repos.sh
docker compose build
docker compose up -d
```

The API applies database migrations on every boot, so a schema change in a new version needs no
separate step.

## Backups

Two volumes hold everything that cannot be rebuilt:

- `mysql_data` — the database: accounts, groups, assignments, points, verdicts.
- `api_storage` — uploaded files: exercise attachments, and every solution anybody has submitted.

Everything else (logs, the worker cache) regenerates itself. Back up those two, and test restoring
them before you need to.

## Mail

Nothing in the product depends on mail to function, but several things are unpleasant without it:
registration confirmations, password resets, group invitations and the "email the whole class"
control all send. If `SMTP_*` is unset, those flows still complete and the message goes nowhere.
