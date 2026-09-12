Tenhle návod vezme stroj, na kterém běží Docker, a skončí u funkčního UPolníčku: API, databáze,
worker, který v sandboxu opravdu známkuje odevzdaná řešení, a tento frontend jako vstupní brána.

Je psaný pro toho, kdo server spravuje. Učitelé ani studenti z něj nepotřebují nic.

## Než začnete

| Požadavek                     | Proč                                                |
| ----------------------------- | --------------------------------------------------- |
| Docker s Compose v2           | Všechno běží v kontejnerech, včetně buildu          |
| **cgroup v2 na hostiteli**    | Bez toho sandbox odmítne běžet — viz níže           |
| ~10 GB místa                  | Image, nástrojové řetězce workeru a nahrané soubory |
| DNS jméno nebo záznam v hosts | Stack se adresuje jménem, ne IP adresou             |

**cgroup v2 je ten požadavek, který se vyplatí ověřit jako první**, protože je to jediný, který se
pak nedá spravit úpravou konfigurace. Odevzdaný kód běží uvnitř `isolate` — téhož sandboxu, jaký
používá IOI — a verze 2.7 potřebuje sjednocenou hierarchii cgroup:

```bash
mount | grep cgroup
```

Hostitel s cgroup v2 odpoví jediným `cgroup2` připojením na `/sys/fs/cgroup`. To je výchozí stav
současného Debianu, Ubuntu i RHEL a Docker Desktopu, včetně Macu. Pokud váš stroj běží ještě na v1,
README nasazení popisuje, jak místo toho připnout starší sandbox.

## Instalace

```bash
git clone git@github.com:UPOL-KMI/upcode-deploy.git
cd upcode-deploy
./pull-repos.sh
cp .env.example .env
```

Pak upravte `.env`. Tyhle položky rozhodují o tom, jestli stack vůbec naběhne:

| Položka                                 | Co tam patří                                                      |
| --------------------------------------- | ----------------------------------------------------------------- |
| `APP_DOMAIN`                            | Adresa, kterou budou lidé psát. Všechno ostatní se odvozuje od ní |
| `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` | Nová hesla. Nic jiného je nečte                                   |
| `JWT_SECRET`                            | Dlouhý náhodný řetězec. Pozdější změna odhlásí všechny            |
| `BROKER_AUTH_*`, `WORKER_FILES_AUTH_*`  | Sdílená tajemství mezi vnitřními službami                         |
| `RECODEX_INSTANCE_NAME`                 | Jak si nasazení říká — v hlavičce a na úvodní stránce             |
| `SMTP_*`, `MAIL_FROM`                   | Odchozí pošta. Bez ní produkt funguje, ale nic neodešle           |

Pak build a start:

```bash
docker compose build        # poprvé 5-10 minut: worker a sandbox se kompilují ze zdrojů
docker compose up -d
docker compose logs -f api  # první start pouští migrace, fixtury a import běhových prostředí
```

Než cokoli otevřete, počkejte, až se log `api` uklidní. První start dělá skutečnou práci: zakládá
schéma, importuje balíčky běhových prostředí, bez kterých by se nedalo známkovat, a pojmenuje
instanci podle `.env`.

U lokální instalace nejdřív nasměrujte jméno na sebe:

```bash
echo "127.0.0.1  recodex.local" | sudo tee -a /etc/hosts
```

Pak otevřete `http://<APP_DOMAIN>/`.

## První účet

První start založí jednoho správce: `admin@admin.com` s heslem `admin`.

**Přihlaste se a změňte to heslo dřív, než bude stroj dostupný komukoli dalšímu.** Je to známá
dvojice, uvedená v tomhle návodu i v README nasazení, a má plná superadmin práva.

Všechno ostatní se dělá přes rozhraní: založit skutečné účty, dát někomu roli správce a ten
seedovaný účet zakázat.

## Co běží a k čemu to je

| Služba     | Role                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------- |
| `proxy`    | Jediný port, který kdokoli zvenčí potřebuje. `/api/v1` směruje na API, zbytek na frontend |
| `web-next` | Tento frontend                                                                            |
| `web-app`  | Původní frontend, ponechaný na vlastním portu jako reference                              |
| `api`      | core-api: účty, skupiny, cvičení, zadání, oprávnění                                       |
| `mysql`    | Databáze                                                                                  |
| `broker`   | Předává vyhodnocovací úlohy workerům                                                      |
| `worker`   | Spouští odevzdaný kód v sandboxu a vyrábí verdikt                                         |
| `monitor`  | Streamuje průběh vyhodnocení do prohlížeče, dokud řešení běží                             |
| `cleaner`  | Uklízí souborovou cache workeru                                                           |

## Jazyky, ve kterých může student odevzdávat

Image workeru instaluje `bash`, C a C++ (GCC), Python 3.13, .NET 8 SDK pro C# a JDK pro Javu; API
při prvním startu importuje odpovídající pipeline. Prostředí potřebuje **obojí**: nástroje v image
workeru a pipeline v databázi, která říká, jak se kompiluje, spouští a soudí.

Přidat jazyk znamená doinstalovat nástroje do `services/worker/Dockerfile`, přidat jeho jméno do
`headers.env` v `services/worker/config.yml.template`, přidat balíček do `services/api/Dockerfile`,
znovu sestavit a pak — na už existující databázi — balíček jednou ručně naimportovat:

```bash
docker compose exec api php bin/console runtimes:import --yes /opt/recodex-runtimes/<balicek>.zip
```

Dvě připnuté verze jsou nosné a jsou zdokumentované tam, kde žijí: .NET je připnuté na 8, protože
balíček pro C# odmítá přejít na 9 nebo 10, a Python se kompiluje ze zdrojů na 3.13, protože
debianí 3.11 odmítá syntaxi, kterou studenti běžně píší.

## Ověření, že známkování opravdu funguje

Instalace, která zobrazuje stránky, ještě není instalace, která známkuje. Zkouškou je odevzdat
řešení a přečíst verdikt:

1. Přihlaste se jako správce.
2. Založte skupinu, cvičení, dejte mu referenční řešení a zadejte ho.
3. Odevzdejte řešení vlastního zadání.
4. Sledujte vyhodnocení a přečtěte výsledek.

Pokud řešení zůstávají ve frontě, worker se nedostane k brokeru. Pokud se vracejí jako selhání
místo verdiktu, bývá příčinou sandbox:

```bash
docker compose logs worker | grep -E "cgroup v2 subtree|cgroup support"
```

## Aktualizace

```bash
./pull-repos.sh
docker compose build
docker compose up -d
```

API pouští databázové migrace při každém startu, takže změna schématu v nové verzi nevyžaduje
zvláštní krok.

## Zálohy

Dva svazky drží všechno, co se nedá znovu vyrobit:

- `mysql_data` — databáze: účty, skupiny, zadání, body, verdikty.
- `api_storage` — nahrané soubory: přílohy cvičení a každé odevzdané řešení.

Všechno ostatní (logy, cache workeru) se obnoví samo. Zálohujte tyhle dva svazky a vyzkoušejte si
obnovu dřív, než ji budete potřebovat.

## Pošta

Nic v produktu nepotřebuje poštu k tomu, aby fungovalo, ale několik věcí je bez ní nepříjemných:
potvrzení registrace, reset hesla, pozvánky do skupiny i hromadný e-mail celé třídě odesílají
zprávu. Když `SMTP_*` není nastavené, tyhle postupy proběhnou, ale zpráva nikam nedorazí.
