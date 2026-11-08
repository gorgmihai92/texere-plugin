---
title: Texere
subtitle: Vault-ul cercetătorului
author: George Mihai
lang: ro
version: "0.4.0"
date: "Versiunea 0.4.0 · 8 noiembrie 2026"
---
## 1. Început

Cercetarea e de obicei împrăștiată în multe aplicații și locuri: Zotero, Mendeley sau EndNote, Word sau Google Docs, laptopul, cloudul, telefonul, stickuri și hard diskuri externe. Drumul dintre ele costă timp și pierde lucruri pe parcurs.

Texere e un vault Obsidian gata făcut pentru cercetătorii care vor un singur loc pentru tot procesul: găsești referințe, citești PDF-uri, iei notițe, scrii, citezi și exporți. Versiunea asta vine cu o hartă a filosofiei, dar o poți adapta pentru orice disciplină.

#### Pentru cine e

- **Oricine, fără cunoștințe tehnice.** Descarci vault-ul, îl deschizi în Obsidian, iar o configurare scurtă face restul. Fără cod, fără linie de comandă, fără LaTeX.
- **Cei care scriu în engleză și în română.** Interfața, configurarea, Ajutorul și ghidul merg în ambele limbi. Notele au nume în engleză și aliasuri în română: scrii `[[Etică` și primești **Ethics**.
- **Studenții Universității din București.** Șabloane de export pentru lucrările de licență și disertație de la Facultatea de Filosofie, după ghidul de redactare al facultății.

![[Fara si cu Obsidian (varianta 4).png]]

**Pasul 1. Configurează vault-ul (o singură dată)**

1. Instalează [Obsidian](https://obsidian.md/download) (gratuit).
2. Copiază folderul vault-ului pe calculator; în Obsidian, alege **Open folder as vault**.
3. Apasă **Trust author and enable plugins**.
4. Configurarea se deschide singură. La fiecare pas bifezi sau alegi ce vrei; **Înainte** aplică alegerea.
5. La final, **Vezi ce s-a făcut** îți arată un rezumat (mai târziu: **Ajutor → Ultima configurare**).

> [!warning] Ai ales din greșeală „Restricted mode”?
> Pluginurile sunt oprite. Le pornești din **Settings → Community plugins**.

> [!note] Un plugin pe care îl instalezi tu
> Texere are nevoie de **PDF++** pentru adnotări. Configurarea îi deschide pagina: **Install**, apoi **Enable**.

**Pasul 2. Lucrează:** adaugi o referință ([[#2. Referințele și lectura]]), citești și subliniezi ([[#2.5 Lectura și adnotările]]), scrii și citezi ([[#3. Scrisul]]), exporți ([[#4. Exportul]]).

#### Pagina de pornire

Fiecare tab nou deschide pagina de pornire Texere: ultimele fișiere, acțiunile principale, ce trebuie reparat (cu un buton) și, într-un vault nou, **prima ta săptămână**, patru pași care se bifează singuri.

Te-ai blocat? Butonul **?** de lângă **+**, jos, deschide Ajutorul: scrie întrebarea cu cuvintele tale. E prima dată în Obsidian? Începe cu [[#1.4 Obsidian în cinci minute]].

### 1.1 Termeni

| Termen | Ce înseamnă |
| --- | --- |
| **Vault** | Folderul cu notele și setările (inclusiv folderul ascuns `.obsidian`). |
| **Link** | `[[Numele notei]]` trimite la altă notă. **Backlinks** arată cine trimite la nota deschisă. |
| **Etichetă** (tag) | Un cuvânt cu `#` în față, ca `#claim`. |
| **Proprietăți (metadate)** | Câmpurile din capul notei. La o referință: autor, an, titlu, DOI, ramură… |
| **Notă de lectură** | Câte una pentru fiecare referință: datele ei, PDF-ul și adnotările tale. |
| **Citekey** | Codul unei referințe, ca `craig_philosophy_2002`: proprietatea `id` a notei. |
| **Citare** | `[@citekey, p. 34]`, care apare ca (Craig, 2002, p. 34). |
| **Bibliografie** | `bibliography.json`, în **Support/Texere/Bibliography**, ținută la zi de Texere. |
| **Command palette** | Toate comenzile, cu **Ctrl/Cmd + P**. |

### 1.2 Pluginul Texere și modulele lui

Texere e un singur plugin cu trei module. Le pornești sau le oprești din **Settings → Texere → General**.

| Modulul | Ce face | Unde |
| --- | --- | --- |
| **Referințe** | Adaugă referințe, arată citările în stilul ales, aduce adnotările în note, ține bibliografia | bara de jos |
| **Export** | PDF, Word sau Markdown, cu citări, bibliografie și cuprins | bara de jos, sau Texere din dreapta-jos |
| **Insights** `LAB` | Cât și cum scrii, linkurile și tiparele | bara de jos |

Fiecare modul merge și singur. Fără Referințe, exportul merge, dar citările rămân `[@citekey]` și nu se face bibliografia.

Texere stă liniștit în notele tale: cât scrii vezi doar textul tău, semnele apar doar dacă le pornești și nimic nu se scrie într-o notă fără clicul tău. Tot ce poate face pentru o notă: clic dreapta pe notă → **Texere**.

### 1.3 Structura vault-ului

| Folder | Ce conține |
| --- | --- |
| **1. References** | **Reading Notes** (câte una pentru fiecare referință) și **PDFs** |
| **2. Notes** | **Essays**, **Personal**, **Poetry** și **Disciplines** (hărțile disciplinelor) |
| **3. Workspace** | **Courses**, **Thesis**, **Articles**, **Projects** |
| **4. Export** | fișierele exportate |
| **Support** | **Media** (imaginile), **Templates** și **Texere**: **Guides** (cu **Writing guide references**), **Bibliography** (și stilurile de citare), **Cuts** (Tăieturile: ce tai din fiecare notă) |

#### Dacă schimbi structura

- **Muți sau redenumești din Obsidian**, nu din Finder sau Explorer, iar Texere te urmează. Ai mutat ceva din Finder? Un tab nou te ajută să-l găsești.
- **Unde e fiecare folder** și unde intră referințele noi: **Settings → Texere → General → Foldere**.
- **Lipsește un folder propus?** Îl creezi acolo cu un clic. Texere nu pune niciodată la loc un folder pe care l-ai șters.
- **Singura regulă:** nu schimba `id`-ul unei note de lectură (citekey-ul ei).

#### Harta filosofiei

**2. Notes/Disciplines/Philosophy** are câte o notă pentru fiecare ramură, teorie, concept, curent, perioadă și autor, pornind de la [[Philosophy|Filosofie]], fiecare cu alias în română.

Folosește-le în metadatele referințelor. [[Craig 2002 – Philosophy. A very short introduction]] are la **branch** valoarea [[Introduction|Introduceri]]: deschide [[Introduction|Introduceri]], iar **Backlinks** arată toate referințele din ramura asta.

Nu ai folderul **Disciplines**? **Settings → Texere → General → Foldere → Harta disciplinei → Creează harta**. Harta altei discipline? Scrie la [hi@georgemihai.com](mailto:hi@georgemihai.com).

### 1.4 Obsidian în cinci minute

Obsidian e gratuit și lucrează cu fișiere text de pe calculatorul tău: fără cont, nimic în cloud dacă nu pui tu acolo. Fiecare notă e un fișier `.md` pe care îl poți deschide în orice editor.

- **Bara din stânga:** **Files**, **Search**, **Bookmarks**; deasupra lor, iconițele pentru Texere, graf și alte pluginuri.
- **La mijloc:** notele tale, în taburi, ca într-un browser.
- **Bara din dreapta:** despre nota deschisă: **Outline**, **Backlinks**, însoțitorul scrisului.
- **Dreapta-jos:** bara de stare, cu **Texere** (exportul, stilul citărilor…).
- **Settings:** rotița din stânga-jos.

**Scrisul.** Markdown, văzut pe loc: `**îngroșat**`, `# Titlu`, `- listă`. Meniul ⋯ din capul notei comută la **Reading view**.

**Linkurile.** Scrii `[[` și alegi o notă; un link spre o notă care nu există încă o creează la clic. Un clic pe o etichetă arată toate locurile în care ai folosit-o.

**Graful.** Notele ca puncte, linkurile ca linii. Tot vault-ul: iconița grafului din stânga. În jurul unei note: ⋯ → **Open local graph**. Referințele legate de hartă (prin ramură, concept sau autor) se adună în grupuri, așa că vezi ce citești cel mai mult. Setările grafului filtrează după folder sau etichetă, de exemplu `path:"1. References"`.

**Pluginurile.** Vault-ul vine cu Texere și PDF++, plus Style Settings, Omnisearch, Excalidraw și Editing Toolbar. Nu-ți mai trebuie nimic.

[Acest video](https://www.youtube.com/watch?v=z4AbijUCoKU) îți arată interfața în câteva minute.

## 2. Referințele și lectura

Fiecare referință are o notă în **Reading Notes**, cu numele *Autor An – Titlu*, și PDF-ul ei în **PDFs**. Cele care sunt deja acolo sunt exemple: le poți șterge oricând. Referințe cu alte nume (dintr-un vault mai vechi): pagina de pornire îți propune să le redenumești.

### 2.1 Cauți și adaugi

1. Deschide **Referințe** din bara de jos (sau **Ctrl/Cmd + P** → **Texere: Adaugă o referință**).
2. Scrie un titlu, un autor, un DOI, un ISBN sau un link.
3. Alege referința și apasă **Adaugă în vault**. PDF-ul gratuit vine cu ea, când există.

Ai deja citarea, BibTeX, RIS sau DOI-ul? **Lipește**. Nu e în niciun catalog? **Introdu manual**. „Limită atinsă”? Adaugă o cheie gratuită în **Settings → Texere → Referințe → Cataloage**.

### 2.2 Din Zotero

1. Deschide Zotero. **Doar prima dată:** **Setări → Avansat** → bifează **Permite altor aplicații de pe acest computer să comunice cu Zotero**.
2. În Texere: **Referințe** → **Zotero**. ✎ arată referințele cu adnotări.
3. Bifează ce vrei și apasă **Importă**.

Primești nota, PDF-ul și adnotările, fiecare cu eticheta culorii ei.

- **Nimic nu se dublează:** o referință care e deja în vault primește doar ce lipsește.
- **Un PDF fără titlu și autori** intră în **PDFs/Inbox**, iar Texere te întreabă cărei referințe îi aparține.
- **Ce etichetă primește fiecare culoare:** **Settings → Texere → Referințe → Zotero → Avansat**.

> [!tip] Recomandat: o cheie Zotero
> O adaugi în același loc. Importul merge atunci și cu Zotero închis.

### 2.3 Din browser, cu butonul Zotero

1. Instalează [Zotero Connector](https://www.zotero.org/download/connectors) în browser.
2. Pornește **Settings → Texere → Referințe → Zotero → Butonul Zotero din browser**.
3. Pe pagina unui articol, apasă butonul Zotero (Obsidian trebuie să fie deschis). Cu Zotero deschis, referința intră în Zotero, apoi în vault; cu Zotero închis, direct în vault.

> [!warning]- A salvat o pagină web în loc de articol?
> Pe Mac, dacă închizi fereastra, Zotero rămâne pornit: apasă **Cmd + Q**. Apoi **Zotero Connector → Preferences → Advanced → Reset Translators** și încearcă din nou.

### 2.4 Un PDF pe care îl ai deja

1. Deschide PDF-ul în Obsidian.
2. **Ctrl/Cmd + P** → **Texere: Adaugă acest PDF ca referință**.
3. Alege referința. PDF-ul se atașează și se mută în **PDFs**.

PDF-uri rămase fără referință: **PDF-uri fără referință**, în **Referințe** sau în Texere din dreapta-jos. O referință fără PDF: clic dreapta pe nota ei → **Texere** → **Caută PDF-ul gratuit**.

### 2.5 Lectura și adnotările

1. Deschide nota de lectură și apasă pe PDF-ul din **attachment**.
2. Selectează un pasaj și alege o culoare din paleta **PDF++**.
3. Lipește-l în notă (**Ctrl/Cmd + V**). Începe cu eticheta culorii și se termină cu citarea și **· PDF**, un link înapoi la locul exact.

| Culoare | Etichetă | Ce marchezi |
| --- | --- | --- |
| roz | `#fact` | fapte, date, cifre |
| galben | `#claim` | afirmațiile autorului |
| roșu | `#disagree` | cu ce nu ești de acord |
| turcoaz | `#agree` | cu ce ești de acord |
| albastru | `#connection` | legături cu alte texte sau idei |
| mov | `#question` | întrebări |
| portocaliu | `#definition` | definiții |
| gri | `#word` | termeni de reținut |

**Adnotările făcute în altă parte** (Zotero, Preview, Acrobat) intră singure în notă, cu eticheta celei mai apropiate culori. Făcute după ce ai adăugat referința: clic dreapta pe PDF sau pe notă → **Texere** → **Importă adnotările din PDF**. Făcute sub alt nume: Texere te întreabă dacă sunt ale tale.

> [!example] Dintr-o notă reală
> În [[Dummett 1996 – Origins of Analytical Philosophy]]:
> ```
> #claim Gottlob Frege, fondatorul filosofiei analitice, [@dummett_origins_1996, p. 7] · PDF
> Contra credinței populare, nu Russell a fost părintele filosofiei analitice.
> ```
> Pasajul, apoi comentariul tău dedesubt.

**După lectură:** cauți o etichetă (`tag:#disagree`) în toate lecturile și completezi **Thesis**, **Arguments**, **Counterarguments** și **Conclusions** în notă.

#### Distilează: adnotările în cuvintele tale

O deschizi din **Acasă → Distilează** sau cu clic dreapta pe o notă de lectură → **Texere**. Texere îți arată câte o adnotare; scrii una-două propoziții, salvate chiar sub ea, deja citate: `… [@craig_philosophy_2002, p. 34]`.

- O adnotare e folosită când sub ea e ceva scris de tine; adnotările `#word` sunt sărite.
- **Șterge adnotarea** o scoate din notă și din PDF; **Anulează** le pune pe amândouă înapoi.
- Dintr-o hartă a dezbaterii, **Distilează-le** ia doar adnotările conceptului despre care n-ai scris încă.

#### Statisticile referinței

Sus în fiecare notă de lectură, actualizate zilnic: cum o citează alții ([scite](https://scite.ai), [OpenAlex](https://openalex.org), [Semantic Scholar](https://www.semanticscholar.org)), ce ai adnotat și, la un articol, cum îi evaluează revista comisiile de specialiști din Norvegia și Finlanda și dacă e în ERIH PLUS sau DOAJ.

## 3. Scrisul

### 3.1 Pornește de la un șablon (opțional)

| Șablonul | Pentru |
| --- | --- |
| [[New essay]] | o lucrare sau un articol, cu cuprins și o structură simplă (introducere, secțiuni, obiecții, limite, concluzie): duplică-l, completează **title** și **author**, lasă **Bibliography** goală (o umple exportul) |
| [[Licență – Facultatea de Filosofie UB]] | lucrarea de licență, după regulile facultății |
| [[Disertație – Facultatea de Filosofie UB]] | lucrarea de disertație, după regulile facultății |

La lucrări completezi **title**, **autor**, **coordonator** și **an**. Regulile: [[Ghid de redactare – Licență și disertație (Facultatea de Filosofie, Universitatea din București)]].

### 3.2 Citarea referințelor

1. Scrie `@` și un cuvânt din autor sau din titlu.
2. Alege referința: Texere scrie `[@citekey]`.
3. Adaugă pagina: `[@citekey, p. 34]`. Dă-o mereu când citezi sau parafrazezi.

În notă, citarea se citește ca text: (Craig, 2002, p. 34). Un clic pe ea deschide referința sau PDF-ul, sau o editezi.

| Scrii | Primești (APA) |
| --- | --- |
| `[@craig_philosophy_2002]` | (Craig, 2002) |
| `[@craig_philosophy_2002, p. 34]` | (Craig, 2002, p. 34) |
| `[@craig_philosophy_2002, pp. 34-36]` | (Craig, 2002, pp. 34–36) |
| `[@craig_philosophy_2002; @dummett_origins_1996]` | (Craig, 2002; Dummett, 1996) |
| `@craig_philosophy_2002 [p. 34]` | Craig (2002, p. 34) |
| `[see @craig_philosophy_2002, ch. 2]` | (see Craig, 2002, ch. 2) |

**Stilul citărilor** apare în Texere, în dreapta-jos (de exemplu **APA**). Un clic pe el alege altul pentru nota asta (se salvează în proprietatea `csl`; exportul îl urmează), sau **Adaugă un stil de citare…** dintre peste 10.000.

### 3.3 Ghiduri de scriere

- [[Primii pași în filosofie – citit, argumentat, scris]]: de la eseul de seminar la doctorat: forma unui text bun, cuvintele pentru fiecare mișcare, semnalele de alarmă și o listă de verificare. Cele paisprezece referințe ale lui sunt în **Writing guide references**.
- [Guidelines on Writing a Philosophy Paper](https://www.jimpryor.net/teaching/guidelines/writing.html), de Jim Pryor
- [LEADERSHIP LAB: The Craft of Writing Effectively](https://www.youtube.com/watch?v=vtIzMaLkCaM) (video)
- [[Metodologia cercetării - Literature Review]] și [[Metodologia cercetării - Structura unei lucrări științifice]]

### 3.4 Modul Editare: încerci variante

Pentru când lucrezi o ciornă scrisă.

- **Pornit:** ✎ sus în notă, sau clic dreapta → **Texere** → **Modul Editare**. Jos apare bara **✎ Editare**, iar marginea notei se colorează.
- **Oprit:** **Gata**, în bara aceea.

#### Variante

1. Selectează un cuvânt, o propoziție sau un paragraf și apasă **Variante**.
2. Scrie o variantă în ultimul rând și apasă Enter; adaugi câte vrei.
3. Le încerci cu ↑ ↓ sau cu un clic. ✕ scoate una; originalul rămâne mereu.
4. **Păstrează ce se vede** alege.

Textul cu variante primește o linie trasă ca de mână care se termină cu puncte (● cea din notă, ○ celelalte); un clic pe puncte le redeschide. Clic pe text: **← →** le schimbă, **⌫** o șterge pe cea care se vede, **⌘Z** anulează. Fără clic: **⌃⌘← →** schimbă, **⌃⌘↑ ↓** sare la următorul loc (Windows și Linux: **Ctrl + Alt + Shift**). Esc, sau scrisul, te întoarce la scris.

#### Estompează, Tăieturi, verificări și scurtări

- **Estompează:** pasajul selectat se estompează, ca să citești pagina fără el. Un clic pe el îl readuce.
- **Mută în Tăieturi:** pasajul ajunge în Tăieturile notei (**Support/Texere/Cuts**), deschise cu **Tăieturi** din bară; **Ctrl/⌘ + Enter** pune un paragraf înapoi la cursor. Nu se șterge nimic.
- **Semne** (din **Texere** din bară, fără AI): propozițiile lungi, ezitările și umplutura, cuvintele nepotrivite tonului, afirmațiile prea tari, opiniile personale. Clic pe un semn: **Variante**, **Estompează** sau **E în regulă**.
- **Scurtări:** **Scurtare ușoară**, **Mai strâns** și **Și mai tăios** doar estompează cuvintele care ar pleca. Clic pe un cuvânt ca să rămână; **Originalul** anulează tot.

Variantele și estompările stau în setările lui Texere de pe acest calculator, nu în notă, iar schimbatul variantelor nu se numără la cuvintele scrise. Modul Editare pornește de la Wordplay de Rob Hardy, după Write_On al lui Jason Fried.

## 4. Exportul

1. Deschide nota, apoi Texere din dreapta-jos → **Exportă nota…** (sau **Export** din bara de jos).
2. Alege **PDF**, **Word** sau **Markdown**; previzualizarea arată rezultatul.
3. Apasă **Exportă**. Mesajul are butonul **Deschide**.

Bibliografia se face singură, din referințele pe care le citezi, sub titlul **Bibliografie** sau la final.

În fereastra exportului: **șablonul** (general sau al facultății), **stilul citărilor**, cuprinsul și câteva opțiuni (fiecare H2 de la pagină nouă, culori, etichete, linkuri colorate) și **aspectul** (pagina și textul), dat de șablon până îl deschizi. Alegerile rămân pentru data viitoare.

#### Șabloanele tale

1. **Settings → Texere → Export → Un șablon nou** (pornește de la unul existent).
2. Pagina, textul și documentul le setezi acolo. **Gata** le închide; **Editează** le redeschide.
3. O notă îl folosește cu proprietatea `export: <numele lui>`.

#### Bine de știut

- **Cuprinsul:** clic dreapta în notă → **Texere** → **Pune cuprinsul aici**. Se actualizează pe măsură ce scrii și primește numerele paginilor în PDF și Word (când Word cere să actualizeze câmpurile, răspunde **Da**).
- **Imaginile** trebuie să fie în vault, inserate cu `![[imagine.png]]`.
- **Folderul exportului** (în vault sau în afara lui): **Settings → Texere → General → Foldere**.

## 5. Insights: scrisul, linkurile și tiparele tale

> [!lab] Lab
> Insights e experimental și se îmbunătățește de la o versiune la alta; unele cifre se pot schimba. Ce numără rămâne în vault-ul tău. Iese pe internet doar când îi ceri (ca să traducă titlul unui concept sau să caute lucrările citate de referințele tale).

**Insights**, din bara de jos, are patru file: **Scrisul** (cât și cum scrii), **Lectura** (ce adnotezi și ce citezi), **Linkuri** (ce se leagă, ce n-are încă link), **Proiecte** (unde ai ajuns cu teza sau articolul). **Caută acum** recitește vault-ul. Setări: **Settings → Texere → Insights**.

#### Cuvinte, ținte și proiecte

- **Cuvintele:** scrise azi, săptămâna asta sau luna asta; lipite, inserate și șterse într-un rând dedesubt; zilele la rând și un calendar al ultimului an. **Cum lucrezi** arată orele și zilele în care scrii și lectura lângă scris. Anulează nu se numără; fiecare calculator își ține numărătoarea, iar totalurile le adună.
- **Ținta de cuvinte:** clic dreapta pe o notă → **Texere** → **Pune o țintă de cuvinte…**. O bară subțire deasupra textului arată cât mai ai.
- **Proiectele:** un folder, o etichetă sau o notă (teza, un articol, un curs), cu țintă și termen opționale: cuvintele, ritmul pe săptămână și când ajungi acolo. **Adaugă un proiect** e în fila **Proiecte**.

#### Însoțitorul scrisului și Verifică ciorna

Însoțitorul e un panou lateral pentru ciorna la care lucrezi: clic dreapta pe notă → **Texere** → **Însoțitorul scrisului**.

- **Sus:** **Eseu filosofic** sau **Text general**, și **Verifică ciorna**.
- **Câte un rând pe paragraf:** ce face și ce lipsește (teza, o citare, răspunsul la o obiecție, o definiție).
- **Pentru paragraful în care ești:** definițiile și adnotările din vault și o referință de citat, puse în text cu un clic.

**Verifică ciorna** citește o notă după ghidurile din [[Primii pași în filosofie – citit, argumentat, scris|Primii pași în filosofie]]: ce fac paragrafele (argumentează, prezintă alți autori, analizează, ilustrează), argumentul (teza spusă devreme, planul, termenii definiți, obiecțiile și răspunsurile), raționamentul (motive, exemple, experimente mentale, indicatoare) și proza (lungimea propozițiilor, ezitările, afirmațiile prea apăsate, „simt că”, formulele goale, cuvintele imprecise). **+** mai mult e mai bine, **−** mai puțin, **◦** echilibrat. Se numără doar textul scris de tine, doar semnalele corecte de cel puțin 8 ori din 10, și nu există un scor.

#### Cum scrii (Insights → Scrisul)

Aceleași semnale, pe mai multe note: **Compară [B] cu [A]**, fiecare fiind **punctul de plecare**, ultimele 30 sau 90 de zile, tot scrisul tău sau note alese (o ciornă veche față de cea nouă îți arată progresul). Întâi opt măsurători-cheie; **Arată tot** pentru restul. Comutatoarele de deasupra cardurilor aleg semnalele (**Text general / Eseu filosofic**) și imaginea (**Comparație / În timp / Cifre**): o linie de la A la B (**albastră** mai bine, **portocalie** mai rău), grafice mici în timp sau un tabel.

#### În timp ce scrii (oprite de la început)

Fiecare are comutatorul lui în **Insights → Scrisul → În timp ce scrii**:

- **Analiza scrisului:** o linie subțire în margine, în culoarea a ceea ce face fiecare paragraf, și o subliniere punctată sub opinii și cuvintele imprecise.
- **Afirmații fără citare:** un paragraf care argumentează, dar nu citează nimic, primește o linie portocalie și **citare?**. Clic: **Citează…** îți propune o referință, **Nu e o afirmație** îl ascunde.
- **Panourile conceptelor:** sus într-o notă-concept, definițiile lui și unde îl folosești.

Un rezumat chiar în notă: clic dreapta → **Texere** → **Statisticile scrisului în notă** (un rând și ce merită verificat); **Scoate statisticile scrisului** îl scoate.

#### Concepte, linkuri și tipare

- **Panoul conceptului:** definițiile din referințele tale, unde folosești conceptul, cu ce apare și un semn când îl folosești des fără să-l definești.
- **Harta dezbaterii:** adnotările tale despre un concept, din toate referințele, grupate după gânditor, cu poziția ta (`#agree`, `#disagree`, `#question`). Alegi unul sau mai multe filtre (ex. **Nu ești de acord** + **Afirmații și definiții**), iar **Începe o notă din cele …** face o schiță din ce se vede, pe feluri, cu citări și notițele tale.
- **De pus în ordine** (fila **Linkuri**): concepte scrise fără link (în notele tale și în rândurile tale din notele de lectură, niciodată în citate), nume fără notă (**Creează nota**), aliasuri posibile și dubluri. **Revizuiește** le grupează; **Leagă selectate** leagă prima menționare din fiecare notă și îți păstrează cuvintele: `[[Action|acțiunii]]`.
- **Tiparele:** ce citești dar nu scrii, subiectele în creștere, concepte care apar împreună fără link, note uitate care contează acum, pe cine citezi.
- **Recenzia săptămânii:** o pornești din **Settings → Texere → Insights → Recenzia săptămânii**: în fiecare luni, o notă scurtă în **2. Notes/Weekly reviews**.

## 6. Probleme și întrebări

### 6.1 Copii de siguranță

Din când în când, copiază folderul vault-ului pe un hard disk extern. Nu ai date sensibile? Merge și o copie în cloud.

### 6.2 Dacă ceva nu merge

1. Deschide un tab nou sau **Settings → Texere**: amândouă arată ce lipsește, cu un buton care repară.
2. Tot nu merge? **Settings → Texere → General → Rulează configurarea din nou**.
3. Caută mesajul în [[#6.4 Dacă apare o eroare]].

### 6.3 Configurarea manuală

Configurarea face cu tine pașii 3, 4, 5 și 7. De mână:

1. **Copiază tot vault-ul**, cu folderul ascuns `.obsidian` (pe Mac, **Cmd + Shift + .** îl arată).
2. **Pornește pluginurile:** **Settings → Community plugins → Turn on community plugins**.
3. **Texere și PDF++:** **Settings → Texere → General → Modulele**: pornește Referințe și Export. La **Avansat**, PDF++: **Deschide pagina lui** (apoi **Install** și **Enable**) sau **Pornește**.
4. **Bibliografia:** **Settings → Texere → Referințe → Note și citări → Eticheta notei** trebuie să fie `literature_note`; apoi **Avansat → Bibliografia → Refă din note**.
5. **Folderul exportului:** **Settings → Texere → General → Foldere → Folderul exportului**.
6. **Fontul:** **Textul → Font**, în fereastra exportului (apar doar fonturile instalate).
7. **Șabloanele și ghidurile:** pasul **Vault-ul tău** din configurare, sau **Settings → Texere → General → Avansat → Șabloanele și ghidurile de scris**, le adaugă pe cele care lipsesc, fără să le atingă pe ale tale.

### 6.4 Dacă apare o eroare

| Ce vezi | De ce | Ce faci |
| --- | --- | --- |
| „Restricted mode”, niciun plugin | n-ai ales „Trust author” | pasul 2 |
| configurarea nu pornește | ai închis-o sau Texere e oprit | **Rulează configurarea din nou**; altfel, pasul 2 |
| lipsesc comenzile Texere sau PDF++ | pluginuri oprite sau lipsește `.obsidian` | pașii 1 și 3 |
| citările rămân `[@citekey]` | modulul Referințe e oprit | pasul 3 |
| „negăsite: @…” la export | citekey-ul nu e în bibliografie | scrie `@` și alege referința |
| mai puține referințe decât note | note fără eticheta `literature_note` | pasul 4 |
| nu apare fișierul exportat | folderul exportului nu există pe acest calculator | pasul 5 |
| alt font în export | fontul nu e instalat | pasul 6 |
| lipsește un șablon sau un ghid de scris | a fost mutat sau șters | pasul 7 |
| „Zotero e închis” | Zotero nu e pornit | deschide-l sau adaugă o cheie Zotero |
| Zotero „nu-l lasă pe Texere să intre” | Zotero blochează alte aplicații | în Zotero: **Setări → Avansat** → permite altor aplicații |
| butonul Zotero salvează doar în Zotero | butonul din browser e oprit | [[#2.3 Din browser, cu butonul Zotero]] |
| lipsesc adnotări din notă | au fost făcute după ce ai adăugat referința | clic dreapta pe PDF → **Texere** → **Importă adnotările din PDF** |
| „limită atinsă” la căutare | limita pe zi a unui catalog | adaugă o cheie gratuită la **Cataloage** |

Numerele pașilor sunt cele din [[#6.3 Configurarea manuală]].

## 7. Ce e nou

Când apare o versiune nouă, pagina de pornire ți-o arată cu butonul **Actualizează**; nimic nu se instalează fără clicul tău. Reparațiile cresc ultimul număr (0.4.0 → 0.4.1), funcțiile noi pe cel din mijloc (0.4 → 0.5), o schimbare în felul în care merge Texere pe primul (0.x → 1.0).

**0.4.0** · 8 noiembrie 2026
Un singur plugin în loc de patru, o configurare ghidată și Ajutorul în Texere.

- **Un singur plugin, Texere.** Referințe, Export și Insights sunt module pe care le pornești sau le oprești din **Settings → Texere → General**; setările tale s-au mutat.
- **O configurare ghidată:** unde ține Texere lucrurile, disciplina ta și ce lipsește.
- **Cuvintele cercetătorilor:** **Referințe**, **note de lectură**, **adnotări**, **PDFs**, **Tăieturi** și **harta disciplinei** (înainte: Surse, note de literatură, evidențieri, Documente, Deoparte, harta domeniilor). Folderele, redenumite prin Obsidian, așa că linkurile urmează.
- **Ajutorul** are întrebările frecvente și tot ghidul; ghidul se actualizează odată cu pluginul.
- **Modul Editare** (secțiunea 3.4): variante ale unei propoziții, estompezi un pasaj, muți text în Tăieturi.
- **Folderele.** Texere urmează folderele pe care le muți sau le redenumești în Obsidian; ce ține de el stă în **Support/Texere**.
- **Insights e în Lab:** funcționează și se tot îmbunătățește.

---

**0.3.3** · 3 noiembrie 2026
Adnotările tale, în cuvintele tale.

- **Distilează**: scrii fiecare adnotare în cuvintele tale, salvată sub ea, deja citată.
- **Prima ta săptămână** în tab-ul nou.
- **Cum scrii** și **Verifică ciorna** în Insights, pentru scrisul filosofic.
- Un ghid nou: [[Primii pași în filosofie – citit, argumentat, scris]].
- Referințe, Export, Insights și Ajutor se deschid în tab-ul nou, cu o bară jos și un (+) pentru o notă nouă.

---

**0.3.2** · 3 noiembrie 2026
Apare Insights.

- Cuvinte scrise, lipite, inserate și șterse; ținte de cuvinte.
- Menționări fără link, legate cu un clic; aliasuri sugerate.
- Afirmații fără citare cât scrii; tipare, ritmul tezei și recenzia săptămânii.

---

**0.3.1** · 1 noiembrie 2026
Un ghid mai scurt și un Zotero mai ușor de folosit.

- Texere creează folderele propuse și le păzește pe cele de care are nevoie.
- Șabloane de export proprii; un panou în fiecare tab nou.
- Zotero: filtrează după adnotări fără să le dubleze, reface literele pierdute (ș, ț), adaugă un singur PDF fără să-l aștepte, își găsește mereu un port liber.
- Un PDF pe care situl nu-l dă: **Deschide PDF-ul**, salvează-l sau trage-l în Inbox, iar Texere îl atașează.

---

**0.3.0** · 1 noiembrie 2026
Referințe, citări și export fără BibLib, Pandoc sau LaTeX.

- Importul din Zotero, cu adnotări.
- Exportul cu previzualizare și șabloanele de lucrare ale facultății.

---

**0.2.0 – 0.2.3** · 27–30 octombrie 2026
Un singur vault pentru ambele limbi și structura de foldere.

- Ghiduri în română și engleză; configurarea și Ajutorul în limba ta; note cu nume în engleză și aliasuri în română.
- Folderele: Referințe, Notes, Workspace, Export, Support.

---

**0.1.0 – 0.1.6** · 26–27 octombrie 2026
Începutul.

- Primul ghid, configurarea automată, butonul Ajutor și harta filosofiei.
- Proiectul s-a numit Topos, apoi Texere (lat. *a țese*).

<!--
Pentru cine întreține vault-ul:
1. Crește versiunea și data (x.x.x): ultima cifră pentru corecturi, a doua pentru funcții noi, prima pentru schimbări mari. Adaugă un rând mai sus.
2. Ai schimbat pluginul? Actualizează manifest.json, versions.json și CHANGELOG.md (ghidul din assets/help al pluginului, notele din assets/notes).
3. Ține cele două ghiduri la fel: aceleași numere de secțiuni, aceeași versiune. Ajutorul și configurarea găsesc răspunsurile după numărul secțiunii.
-->
