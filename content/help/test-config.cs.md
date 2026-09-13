Test je jeden pokus o spuštění odevzdaného řešení: dostane nějaký vstup, něco vypíše, a to se
porovná s tím, co vypsat mělo. Úloha jich může mít víc — typicky jeden na každý případ, který
chcete ověřit.

**Soubory se nevypisují ručně, vybírají se.** Všechno, na co se tady odkazujete — vstupy,
očekávané výstupy, vlastní soudce — musí být nejdřív připojené k úloze v **Nastavení úlohy →
Soubory**. Dokud tam nic není, jsou nabídky prázdné.

## Vstup

Co řešení dostane, než se spustí.

| Pole                 | K čemu je                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vstupní soubory**  | Soubory, které se položí vedle řešení. Druhé políčko určí, pod jakým jménem je řešení uvidí — necháte-li ho prázdné, použije se jméno souboru. |
| **Standardní vstup** | Soubor, jehož obsah se řešení přivede na standardní vstup (to, co v Pythonu čte `input()`, v C `scanf`).                                       |

**Příklad.** Test má ověřit součet čísel ze souboru. Připojíte k úloze `soucet-01.in`, v poli
_Standardní vstup_ ho vyberete — a řešení ho přečte, jako by ho student napsal na klávesnici.

**Příklad s jiným jménem.** Zadání říká „program čte soubor `data.csv`". Připojíte
`test1-data.csv`, dáte ho do _Vstupních souborů_ a jako druhé jméno napíšete `data.csv`. Každý test
tak může mít jiná data pod stále stejným jménem.

## Spuštění

Jak se řešení spustí.

| Pole          | K čemu je                                                             |
| ------------- | --------------------------------------------------------------------- |
| **Argumenty** | Předají se programu na příkazové řádce. Jeden řádek = jeden argument. |

**Příklad.** Argumenty `--mode` a `fast` se programu předají jako dvě samostatné položky, tedy
`program --mode fast`. Nepište je do jednoho řádku, oddělovat je mezerou nestačí.

Většina úloh tady nechává prázdno a data předává vstupem.

## Výstup

Co se po řešení chce a s čím se to porovná.

| Pole                                | K čemu je                                                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Porovnávat soubor, který zapíše** | Ve výchozím stavu se hodnotí to, co program vypíše na obrazovku. Zapnete-li tohle, hodnotí se místo toho soubor, který program vytvoří. |
| **Soubor, který zapíše**            | Jméno toho souboru — objeví se, jen když je přepínač zapnutý.                                                                           |
| **Očekávaný výstup**                | Soubor se správnou odpovědí. **Bez něj úlohu nelze zadat**, protože soudce nemá s čím porovnávat.                                       |

**Příklad.** K úloze připojíte `soucet-01.out` s jediným řádkem `42`, vyberete ho jako _Očekávaný
výstup_, a řešení projde, pokud vypíše totéž.

Výjimka: úlohy typu **Data-Only** (odevzdávání dokumentů) očekávaný výstup nepotřebují — nic se
nespouští ani neporovnává, hodnotí vyučující ručně.

## Posouzení

Kdo rozhodne, jestli se výstup shoduje.

| Pole                        | K čemu je                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Porovnání**               | Vestavěný soudce. _Token po tokenu_ je běžná volba: nezáleží na počtu mezer, ale na pořadí slov a čísel. |
| **Použít vlastního soudce** | Místo vestavěného porovnání spustí váš vlastní program.                                                  |
| **Program soudce**          | Soubor s tím programem, opět připojený k úloze.                                                          |
| **Argumenty soudce**        | Předají se soudci **před** dvojicí souborů, které porovnává.                                             |

**Kdy který vestavěný soudce.** _Token po tokenu_ pro běžný text a celá čísla. _Čísla přibližně_,
když výsledek závisí na zaokrouhlení. _V libovolném pořadí_, když na pořadí odpovědí nezáleží.
_Bajt po bajtu_, když má výstup sedět úplně přesně včetně mezer.

**Vlastní soudce** dostane dva soubory — očekávaný a skutečný výstup — a musí skončit návratovým
kódem 0 při shodě. Na první řádek standardního výstupu píše úspěšnost od `0.0` do `1.0`, takže umí
i částečné body.

## Sestavení a spuštění (za každý jazyk zvlášť)

Tahle část se opakuje pro každý zvolený jazyk, protože v každém se řešení staví jinak.

| Pole                                  | K čemu je                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Vstupní bod**                       | Soubor, který se spustí, když student odevzdá víc souborů. Necháte-li prázdné, vybere se při odevzdání. |
| **Návratové kódy znamenající úspěch** | Obvykle `0`. Jednotlivé hodnoty nebo rozsahy oddělené čárkami, třeba `0, 2-4`.                          |
| **Doplňkové soubory**                 | Přidají se k řešení, **než** se sestaví — hlavičky, moduly, knihovny.                                   |

Která pole se tu objeví, závisí na jazyku: Java nemá vstupní bod, C nemá knihovny `.jar`.

## Než úlohu zadáte

1. Připojte soubory (**Nastavení úlohy → Soubory**).
2. U každého testu vyberte alespoň **očekávaný výstup**.
3. Uložte konfiguraci.
4. Nastavte **Omezení zdrojů** — paměť a čas na test.
5. Odevzdejte **vzorové řešení**. Je to vaše vlastní odpověď a právě ona ověří, že testy fungují.

Co ještě chybí, hlásí červený rámeček nahoře na obrazovce úlohy i tady.
