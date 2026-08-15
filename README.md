# VeStope.cz – Rolbař v2

Nová čistá PWA aplikace pro rolbaře VeStope.cz.

## Stav projektu

**v0.3.0 – Fáze 3: persistentní uložení dokončené jízdy**

Fáze 1 (GPS preflight) a fáze 2 (GPS tracking, živý čas/vzdálenost, pauza a potvrzení ukončení) byly otestovány. Fáze 3 přidává samostatnou datovou vrstvu pro dokončené jízdy.

### Fáze 3 obsahuje

- po potvrzení ukončení se dokončená jízda uloží do IndexedDB,
- každý záznam má stabilní `id` a `schemaVersion`,
- ukládá se začátek, konec, aktivní čas, celková vzdálenost a délka pauz,
- datový model má připravené pole pro budoucí fotografie a report,
- je připravená agregace jízd za konkrétní kalendářní den pro pozdější denní statistiky,
- při nedostupnosti IndexedDB existuje malý localStorage fallback,
- Service Worker byl aktualizován tak, aby novou datovou vrstvu správně cachoval a při nasazení se nepoužila stará shell verze.

**Poznámka:** Ve Fázi 3 se data zatím ukládají pouze lokálně v zařízení. Serverová synchronizace bude řešena až v samostatné fázi, aby nebyla současně měněna GPS, úložiště a backendová komunikace.

## Vývojová pravidla

- Zdrojové soubory se neupravují automatickými patchovacími skripty.
- Service Worker neobsahuje aplikační logiku.
- Každá nová funkce vzniká v samostatné fázi.
- Každá fáze musí být otestována před další implementací.
- Datový model se rozšiřuje zpětně kompatibilně pomocí `schemaVersion`.
- Secrets nikdy nepatří do veřejného repository.
