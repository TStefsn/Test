# Analysis-Trainer · Mathematik Leistungskurs

Eine webbasierte Übungsumgebung zur **Analysis** im Mathematik-Leistungskurs.
Erzeugt zufällige Übungsaufgaben, zeichnet die Graphen und gibt zu jeder Aufgabe
die **Lösungen** an – bewusst **ohne Lösungsweg**, nur die Ergebnisse.

## Starten

Die App ist vollständig statisch und **benötigt kein Internet**
(math.js ist lokal unter `vendor/` eingebunden).

- Einfach `index.html` im Browser öffnen, **oder**
- einen lokalen Server starten, z. B.:
  ```bash
  python3 -m http.server 8000
  # dann http://localhost:8000 öffnen
  ```

## Funktionsumfang

### Funktionstypen (einzeln oder als Verknüpfung kombinierbar)
1. Quadratische Funktionen
2. Biquadratische Funktionen
3. Ganzrationale Funktionen 3. Grades (Polynomdivision)
4. Exponentialfunktionen
5. Natürliche Logarithmusfunktionen
6. Wurzelfunktionen
7. Gebrochenrationale Funktionen

Mehrfachauswahl der Typen erzeugt **Verknüpfungen** (Summe/Produkt).

### Aufgabentypen
- **Kurvendiskussion** – vollständige Untersuchung einer Funktion
- **Kurvenschar** – Funktionenschar mit Parameter `t` inkl. **Ortskurve**
- **Extremalproblem** – klassische Optimierungsaufgaben (Rechteck, Schachtel,
  Rechteck unter Parabel, Zylinderdose)

### Themenschwerpunkte (wählbar)
- **Kurvenuntersuchung**: Definitionsbereich, Symmetrie, Nullstellen,
  Achsenabschnitt, Extrem- und Wendepunkte, Verhalten im Unendlichen,
  senkrechte/waagerechte/schiefe Asymptoten
- **Wendetangente & Normale** im Wendepunkt
- **Flächenberechnung** zwischen Graph und x-Achse (mit Teilflächen)
- **Ortskurve** der Extrempunkte einer Schar
- **Graph zeichnen** – interaktiver Plot mit markanten Punkten

Zusätzlich lässt sich über **„Eigene Funktion eingeben"** jede beliebige
Funktion analysieren (Parameter `t` für Scharen wird automatisch erkannt).

## Wie die Lösungen berechnet werden

- **Symbolisch** (über [math.js](https://mathjs.org/)): Ableitungen `f′`, `f″`,
  Vereinfachung und Ausmultiplizieren der Funktionsterme.
- **Numerisch** (eigene Verfahren in `js/math-utils.js`):
  Nullstellen (Bisektion), Extrema/Wendepunkte (Nullstellen der Ableitungen mit
  Klassifikation), Integration (adaptives Simpson-Verfahren), Polstellen,
  Grenzverhalten/Asymptoten und Polynom-Regression für die Ortskurve.

Ergebnisse werden hübsch gerundet (ganze Zahlen und einfache Brüche werden
erkannt). Eine Wertekontrolle filtert Scheinpunkte an Polstellen heraus.

## Projektstruktur

```
index.html            Oberfläche
css/styles.css        Layout & Design
js/math-utils.js      Numerische Verfahren
js/plot.js            Canvas-Graphenplotter
js/generators.js      Aufgabengeneratoren je Funktionstyp
js/solver.js          Lösungsberechnung (Analyse, Ortskurve, Extremalproblem)
js/app.js             Oberflächensteuerung & Formel-Rendering
vendor/math.min.js    math.js (lokal eingebunden)
```

## Hinweis

Die Aufgaben werden zufällig erzeugt; die angegebenen Ergebnisse dienen der
Selbstkontrolle. Die numerischen Werte sind auf wenige Nachkommastellen gerundet.
