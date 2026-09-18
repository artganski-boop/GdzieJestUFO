# Backend do prawdziwego wyszukiwania UFO w okolicy

To jest **osobny serwer**, oddzielony od strony z UFO. Frontend (Twoja
strona) wysyła do niego współrzędne, a on naprawdę odpytuje wyszukiwarkę
i zwraca surowe, niezweryfikowane wyniki.

## Dlaczego to musi być osobny serwer

Statyczna strona HTML (ani hostowany artefakt claude.ai) nie może sama
łączyć się z dowolnym API w internecie - to ograniczenie środowiska,
w którym działa, nie coś, co da się obejść kodem. Backend to zwykły
program działający 24/7 na czyimś serwerze (Twoim), z pełnym dostępem
do sieci.

## Krok 1: Klucz do wyszukiwarki

Zarejestruj się na **https://brave.com/search/api/** (darmowy plan
wystarczy na start) i skopiuj wygenerowany klucz API.

Alternatywy, jeśli wolisz inne API:
- **Google Programmable Search Engine** (programmablesearchengine.google.com)
  - darmowy limit 100 zapytań/dzień, potem płatne
- **Bing Web Search API** (przez Azure) - też ma darmowy tier

Kod w `server.js` jest napisany pod Brave Search, ale zamiana na inne
API to tylko podmiana jednego fragmentu funkcji `fetch(...)`.

## Krok 2: Uruchomienie lokalne (test)

```bash
npm install
cp .env.example .env
# wklej BRAVE_API_KEY w pliku .env
npm start
```

Test w przeglądarce lub curl:
```
curl "http://localhost:3000/api/nearby-ufo?lat=52.199&lon=21.028"
```

## Krok 3: Wdrożenie, żeby działało dla każdego odwiedzającego

Musisz wybrać hosting dla backendu. Kilka opcji, od najprostszych:

- **Render.com** - darmowy tier dla małych projektów Node.js, wdrożenie
  przez połączenie z repo GitHub, ustawiasz zmienne środowiskowe (`BRAVE_API_KEY`)
  w panelu.
- **Railway.app** - podobnie, kilka kliknięć, darmowe limity na start.
- **Fly.io** - trochę więcej konfiguracji, ale też ma darmowy poziom.
- Własny VPS (np. Hetzner, DigitalOcean) - najwięcej pracy, pełna kontrola.

Po wdrożeniu dostaniesz publiczny adres, np. `https://twoja-nazwa.onrender.com`.

## Krok 4: Podłączenie do strony z UFO

W pliku strony (`ufo-landing-standalone.html`) trzeba dodać wywołanie
tego backendu i wyświetlić wyniki jako osobną, wyraźnie oznaczoną
sekcję "wyniki wyszukiwania internetowego (niezweryfikowane)" - obok
kurowanej bazy, nie zamiast niej. Przykładowy fetch:

```js
async function fetchLiveWebResults(lat, lon) {
  const res = await fetch(`https://twoja-nazwa.onrender.com/api/nearby-ufo?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error("Backend error");
  return res.json(); // { place, results: [{title, url, snippet}], disclaimer }
}
```

**Ważne:** to zadziała tylko wtedy, gdy strona z UFO też przestanie być
hostowana jako artefakt claude.ai (ten hosting blokuje właśnie takie
żądania sieciowe do dowolnych adresów) - musi być wdrożona gdzie indziej,
np. na tym samym Render/Vercel/Netlify co backend, albo jako zwykły
plik HTML na dowolnym hostingu stron statycznych.

## Ograniczenia, o których warto wiedzieć

- Wyniki wyszukiwania to **surowe trafienia z internetu** - mogą to być
  fora, blogi, cokolwiek. Zero weryfikacji faktów, zero oceny
  wiarygodności - to zupełnie inny tryb niż kurowana baza w głównej
  aplikacji, i tak też powinien być oznaczony w interfejsie.
- Facebook blokuje automatyczne pobieranie treści z grup i postów w
  swoim regulaminie - żadne legalne API wyszukiwania nie zwróci Ci
  wyników bezpośrednio z prywatnych/zamkniętych grup na FB.
- Reverse geocoding przez Nominatim ma limit ok. 1 zapytanie/sekundę
  i wymaga podania prawdziwego kontaktu w nagłówku `User-Agent` -
  przy realnym ruchu warto rozważyć płatną alternatywę (np. Google
  Geocoding API) albo cache wyników.
