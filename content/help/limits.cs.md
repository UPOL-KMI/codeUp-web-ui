Limity říkají, kolik smí každý test spotřebovat. Řešení, které je překročí, ten test neprojde —
student uvidí, že narazil na limit, ne že mu program špatně počítá.

Nejde jen o pohodlí: sandbox musí mít strop, jinak jediné zacyklené řešení obsadí stroj a zablokuje
frontu všem ostatním.

## Stroje

Nejdřív se vybere **hardwarová skupina** — třída strojů, na kterých se má úloha vyhodnocovat.
Popisuje, co stroj má, a její stropy jsou to, vůči čemu se limity níže poměřují.

**Úlohu bez jediné vybrané skupiny nelze zadat.** Na běžné instalaci je skupina jedna a stačí ji
zaškrtnout.

Odebráním skupiny se zahodí limity, které pro ni byly nastavené. Když jich vyberete víc, limity se
zadávají pro každou zvlášť a musí platit na všech.

## Procesorový nebo reálný čas

Přepínač **Měřit procesorový čas** rozhoduje, co se vlastně měří:

- **procesorový čas** — jak dlouho program skutečně počítal. Mezi běhy je stabilní, takže stejné
  řešení dopadne dnes i zítra stejně. Pro většinu úloh správná volba.
- **reálný čas** (přepínač vypnutý) — čas na hodinách včetně čekání na disk či síť. Je to to, co
  zažije student, ale kolísá podle zatížení stroje.

Přepnutí **přepíše všechny limity** níže na druhou míru, takže to není kosmetická volba — po
přepnutí čísla zkontrolujte.

## Mřížka limitů

Testy jsou řádky, jazyky sloupce. Každá buňka má dvě čísla:

| Pole      | Jednotka | Co znamená                                                           |
| --------- | -------- | -------------------------------------------------------------------- |
| **Paměť** | KiB      | Kolik smí test nejvýš zabrat. `65536` KiB = 64 MiB.                  |
| **Čas**   | sekundy  | Kolik smí test nejvýš běžet, v té míře, kterou určuje přepínač výše. |

Proč zvlášť za každý jazyk: totéž řešení v Pythonu potřebuje na rozběh víc než v C, a limit, který
sedne jednomu, druhý jazyk odstřihne hned na startu.

**Řádek „Celkový čas"** sčítá sloupec a porovnává ho se stropem na celou úlohu. Limity můžou být
v pořádku buňku po buňce, a přesto je uložení odmítnuto právě za ten součet — proto je ten řádek
vidět.

## Jak čísla zvolit

1. Odevzdejte **vzorové řešení** a podívejte se, kolik skutečně spotřebovalo.
2. Dejte limit **s rezervou** — obvykle dvoj- až čtyřnásobek. Vzorové řešení píše autor, který zná
   správný postup; student ho teprve hledá.
3. Po změně limitů spusťte **Vyhodnotit znovu všechna** vzorová řešení. Je to nejrychlejší způsob,
   jak zjistit, že jste si vlastní úlohu nerozbili.

**Úlohy typu Data-Only** (odevzdávání dokumentů) mají limity předvyplněné. Nic z odevzdaného se
nespouští — běží jen soudce — takže čísla tam jsou jen proto, že je vyžaduje systém, a měnit je
nemusíte.

## Když to nejde uložit

Uložení odmítne hodnotu, která překročí strop stroje, i součet přes celý sloupec. Dotčená pole se
označí červeně a strop je napsaný nad mřížkou. **Nula neprojde** — každý test potřebuje paměťový
i časový limit.
