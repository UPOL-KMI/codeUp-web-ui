Tenhle návod je pro toho, kdo učí: jak založit kurz, napsat cvičení, nastavit termíny a číst, co
studenti odevzdali.

## Jak je to poskládané

UPolníček má čtyři pojmy a všechno ostatní je detail některého z nich.

- **Skupina** je kurz nebo seminární skupina uvnitř něj. Drží studenty a zadání a může mít
  podskupiny.
- **Cvičení** je úloha s testy: text, soubory, které testy potřebují, limity a aspoň jedno
  referenční řešení. Cvičení žijí v katalogu nezávisle na kurzech.
- **Zadání** je cvičení přiřazené skupině, s vlastními termíny a body. Totéž cvičení může být
  zadané v pěti kurzech a v každém mít jiné termíny.
- **Řešení** je jeden pokus jednoho studenta o jedno zadání. Opraví se automaticky a výsledek
  můžete přebít.

Rozdíl, na kterém záleží: **cvičení napíšete jednou a zadáte mnohokrát.** Úprava cvičení nerozhodí
kurzy, které ho už používají, dokud to sami neřeknete.

## Váš kurz

Založíte ho ze **Skupin**. Skupina potřebuje název v obou jazycích, které rozhraní nabízí, a patří
do instance — na nasazení pro jednu fakultu je jen jedna.

O chování rozhodují tři nastavení:

- **Veřejná** — jestli se studenti mohou přihlásit sami.
- **Organizační** — skupina, která drží jen další skupiny. Může mít podskupiny, ale žádná zadání
  ani studenty. Hodí se pro katedru nebo studijní program.
- **Archivovaná** — kurz, který skončil. Zůstane čitelný a zmizí ze seznamů, se kterými se pracuje.

Studenti se dostanou dovnitř třemi způsoby: sami se přidají do veřejné skupiny, přidáte je ze
seznamu, nebo jim pošlete **pozvánkový odkaz** s platností.

## Psaní cvičení

Z **Cvičení** založte nové a vyplňte čtyři věci — dokud nejsou všechny, rozhraní vám cvičení
nedovolí zadat.

1. **Text.** Markdown, v každém jazyce, který chcete nabídnout. Vykresluje se kód i matematika.
2. **Testy.** Každý test říká, co jde dovnitř a co má vyjít ven. Pro běžný tvar — tohle na standardní
   vstup, tamto se čeká na výstupu — je porovná vestavěný soudce, buď přesně, nebo bez ohledu na
   bílé znaky.
3. **Limity.** Čas a paměť, pro každý test a prostředí. Vyjděte z naměřeného času referenčního
   řešení a nechte skutečnou rezervu: stroj, který známkuje, není studentův notebook.
4. **Referenční řešení.** Správné řešení, které odevzdáte sami. **Bez něj cvičení nejde zadat**, a je
   to záměr: je to důkaz, že testy, limity a pipeline spolu opravdu fungují, a je to místo, kde se
   projeví většina chyb v konfiguraci.

Referenční řešení odevzdejte a přečtěte jeho verdikt, než půjdete dál. Pokud nedostane plný počet
bodů, cvičení není hotové — a každý student by narazil na tutéž zeď.

### Import z GitHub Classroom

Zadání s `autograding.json` jde naimportovat místo přepisování. Jeho testy typu `input`/`output` se
mapují na testy v UPolníčku čistě, `README.md` šablony se stane textem cvičení a ostatní soubory
přílohami.

Co naimportovat nejde, je řečeno nahlas a ne odhadnuto: test, který spouští libovolný příkaz shellu,
ani celý testovací framework uvnitř repozitáře se na dvojice vstup/výstup převést nedají — import
vám řekne, které testy přeložit nedokázal. A referenční řešení v šabloně z Classroomu prakticky
nikdy není, takže naimportované cvičení přijde **zatím nezadatelné**, dokud ho nenapíšete.

## Zadání

Ve skupině zvolte **Zadat cvičení**. Výběr začíná u cvičení vašeho kurzu a dá se rozšířit na celý
katalog.

Pak nastavte podmínky:

- **První termín** a body před ním.
- **Druhý termín**, volitelně, s nižším ziskem — pozdě, ale ne zbytečně. Body mohou klesnout skokem
  v termínu, nebo se mezi oběma termíny plynule snižovat.
- **Bodový práh** — jakou část bodů musí řešení získat, aby se vůbec počítalo.
- **Limit pokusů** — kolikrát smí student odevzdat. Nechte ho velkorysý, pokud nejde o zkoušku.
- **Viditelné od** — zadání existuje, ale do té doby zůstane skryté.
- **Ve kterých jazycích** smí student odevzdávat.

Termíny se zadávají **ve vaší časové zóně** a každému se zobrazí v té jeho.

## Čtení toho, co přišlo

Záložka **Řešení** u zadání vypisuje každý pokus, jeden řádek na odevzdání. Po otevření vidíte, co
student odevzdal, co udělal každý test a jak se došlo ke skóre.

Co odtud můžete dělat:

- **Udělit body, které vyhodnocení nedalo.** Přebití s poznámkou proč. Použijte ho, když je řešení
  správné způsobem, který testy nezachytí — nebo špatné způsobem, který jim unikl.
- **Uznat pokus.** Ve výchozím stavu se počítá poslední odevzdání; uznáním označíte konkrétní jiné.
- **Napsat revizi.** Komentáře ke konkrétním řádkům odevzdaného kódu. Revize je jen vaše, dokud ji
  neuzavřete — teprve pak ji student uvidí.
- **Přehodnotit.** Spustí testy znovu — třeba po opravě rozbitého cvičení.
- **Porovnat dvě řešení** řádek po řádku, když chcete vidět, co se mezi pokusy změnilo.

Studenti si o revizi mohou říct sami a tyhle žádosti se sbírají na vaší nástěnce, takže fronta je
místo, kam se díváte, ne něco, co si musíte pamatovat.

## Zkoušky

Skupinu lze na zvolené období přepnout do zkouškového režimu: začne hned nebo v čase, který určíte,
trvá zadanou dobu nebo do zadaného konce, a může studenty na tu dobu zamknout do skupiny. Zamčený
student během zkoušky vidí jen tenhle kurz.

Nastavte to dřív, než se místnost zaplní. Obrazovka zkoušky ukazuje, kdo je zamčený, a umožní
jednotlivce uvolnit.

## Body, které nejsou kód

**Stínové zadání** jsou body bez odevzdání — za prezentaci, ústní zkoušení, aktivitu na semináři.
Objeví se v bodování skupiny vedle skutečných zadání a body zadáváte sami, po studentech, s datem,
kdy byly získány.

## Pohled na celý kurz naráz

Záložka **Studenti** je bodová matice: každý student proti každému zadání, včetně součtů. Dá se
exportovat a z každé buňky vede odkaz na pokusy toho studenta.

Celý kurz jednoho studenta má vlastní obrazovku — všechno, co v něm odevzdal, na jednom místě — a
bývá to nejrychlejší způsob, jak odpovědět na otázku „jak si ten člověk vlastně vede".
