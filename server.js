/**
 * Minimalny backend, który NAPRAWDĘ łączy się z wyszukiwarką.
 *
 * Przepływ:
 *  1. Przeglądarka użytkownika wysyła swoje lat/lon do TEGO serwera
 *     (nie do Anthropic, nie do Claude - do Twojego własnego backendu).
 *  2. Serwer zamienia współrzędne na nazwę okolicy (reverse geocoding,
 *     Nominatim/OpenStreetMap - darmowe, ale ograniczone limitem 1 zapytanie/s).
 *  3. Serwer odpytuje prawdziwe API wyszukiwarki (Brave Search API -
 *     darmowy tier, prosty REST, bez potrzeby scrapowania Google).
 *  4. Wyniki (tytuł, link, fragment tekstu) wracają do przeglądarki
 *     jako SUROWE, NIEZWERYFIKOWANE trafienia - żadnej oceny
 *     wiarygodności, żadnego twierdzenia że to prawda. To odróżnia
 *     ten tryb od kurowanej bazy w głównej aplikacji.
 *
 * WYMAGANE:
 *  - klucz API z https://brave.com/search/api/ (darmowy plan istnieje,
 *    sprawdź aktualny limit na ich stronie w momencie zakładania konta)
 *  - Node.js 18+ (ma wbudowane fetch, nie trzeba node-fetch)
 *
 * URUCHOMIENIE LOKALNE:
 *   npm install
 *   cp .env.example .env   # wklej tam swój BRAVE_API_KEY
 *   npm start
 *   -> serwer wystartuje na http://localhost:3000
 *
 * WDROŻENIE (żeby działało dla realnych odwiedzających Twojej strony,
 * nie tylko lokalnie na Twoim komputerze):
 *   Potrzebujesz hostingu dla backendu - Twoja obecna strona (artefakt
 *   claude.ai) NIE MOŻE się z nim połączyć (środowisko blokuje
 *   dowolne żądania sieciowe poza kilkoma dozwolonymi hostami).
 *   Musisz więc PRZENIEŚĆ całą aplikację poza claude.ai, na hosting,
 *   z którego wolno łączyć się z dowolnym API - patrz README.md.
 */

import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;

// CORS - pozwól Twojej stronie frontendowej (inny adres/domena) łączyć się z tym API.
// W produkcji zamień "*" na dokładny adres Twojej opublikowanej strony.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/nearby-ufo", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: "Wymagane parametry: lat, lon (liczby)." });
    }
    if (!BRAVE_API_KEY) {
      return res.status(500).json({ error: "Brak BRAVE_API_KEY w konfiguracji serwera." });
    }

    // 1) Reverse geocoding: współrzędne -> nazwa okolicy/dzielnicy/miasta.
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=pl`,
      {
        headers: {
          // Nominatim wymaga identyfikowalnego User-Agent, inaczej blokuje zapytania.
          "User-Agent": "ufo-landing-finder-backend/1.0 (kontakt: twoj-email@example.com)",
        },
      }
    );
    if (!geoRes.ok) throw new Error(`Nominatim HTTP ${geoRes.status}`);
    const geo = await geoRes.json();
    const addr = geo.address || {};
    const place =
      addr.suburb || addr.city_district || addr.town || addr.city || addr.county || geo.display_name || "";

    if (!place) {
      return res.json({ place: null, results: [], note: "Nie udało się ustalić nazwy okolicy dla tych współrzędnych." });
    }

    // 2) Prawdziwe wyszukiwanie web dla tej okolicy.
    const query = encodeURIComponent(`UFO ${place} obserwacja lądowanie`);
    const searchRes = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${query}&count=10&search_lang=pl`, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": BRAVE_API_KEY,
      },
    });
    if (!searchRes.ok) throw new Error(`Brave Search HTTP ${searchRes.status}`);
    const searchData = await searchRes.json();

    const results = (searchData.web?.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
    }));

    res.json({
      place,
      queried: `UFO ${place} obserwacja lądowanie`,
      results,
      disclaimer:
        "Surowe wyniki wyszukiwania internetowego - NIE zweryfikowane, NIE ocenione pod względem wiarygodności. To coś innego niż kurowana baza w głównej aplikacji.",
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Błąd podczas wyszukiwania.", details: String(err.message || err) });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Backend nasłuchuje na porcie ${PORT}`);
});
