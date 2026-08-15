# VeStope.cz – Rolbař v2

Nová čistá PWA aplikace pro rolbaře VeStope.cz.

## Stav projektu

**v0.8.0 – profil rolbaře, sezónní souhrn a Fáze 8**

Fáze 1–6 byly postupně otestovány v aplikaci. Fáze 8 přidává dokončovací animaci. Aktuálně je připraven také datový a UI základ pro autentizovaného rolbaře, jeho stroj a sezónní souhrn.

### Profil rolbaře

- uživatel není pevně přiřazen k jedné oblasti,
- databázový profil `groomers` obsahuje uživatelské jméno, aktivní stav, roli a údaje o stroji,
- stroj má název/označení a průměrnou spotřebu v l/100 km,
- údaje o stroji lze později zobrazit při prvním přihlášení a upravovat v Můj souhrn.

### Můj souhrn

- aktuální sezóna se určuje automaticky jako září–srpen, např. `2026/27`,
- souhrn počítá upravené kilometry, aktivní čas, počet jízd a počet unikátních upravovaných dnů,
- zobrazuje seznam jednotlivých jízd,
- datový model serveru obsahuje `groomer_rides` pro dlouhodobé sezónní statistiky,
- lokální UI základ používá stejné údaje z IndexedDB, dokud nebude připojena autentizovaná synchronizace.

### Autentizace

Finální přihlášení bude založené na Supabase Auth a tabulce `groomers`. Uživatel se po prvním přihlášení drží v bezpečné session na zařízení; odhlášení umožní přihlásit jiného rolbaře. Oblast se k uživateli nepřipíná – určuje se podle konkrétní jízdy/GPS.

### Bezpečnost databáze

`groomer_rides` má RLS a vlastní čtení/zápis pouze pro přihlášeného aktivního rolbaře. Profil rolbaře má vlastní čtení a aktualizaci.

## Vývojová pravidla

- Zdrojové soubory se neupravují automatickými patchovacími skripty.
- Service Worker neobsahuje aplikační logiku.
- Každá nová funkce vzniká v samostatné fázi.
- Každá fáze musí být otestována před další implementací.
- Datový model se rozšiřuje zpětně kompatibilně pomocí `schemaVersion`.
- Secrets nikdy nepatří do veřejného repository.
