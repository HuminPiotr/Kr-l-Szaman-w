/**
 * Kamienie Pamięci - osiągnięcia Księgi Plemienia.
 * Spec: docs/superpowers/specs/2026-10-12-pamiec-plemienia-design.md
 *
 * CZYSTA LOGIKA, BEZ DOM. Rejestr deklaratywny (jak PRZYDOMKI w kronika.js):
 * nowy pomysł = nowy wpis. Warunek czyta STAN Pamięci (js/odkrycia.js) i KONTEKST
 * wywołania; `kiedy` mówi, przy jakim zdarzeniu kamień jest sprawdzany:
 *   zywo   - po pieczęci/technice/węźle (także swobodny taniec)
 *   runda  - po rundzie dokończonej do Kroniki (Esc się nie liczy)
 *   nick   - po rozpoznaniu nicku
 *   zawsze - przy każdym z powyższych (pory dnia)
 *
 * §2: kamienie nie dają punktów i NIGDY nie są odbierane. Progi ZGADNIĘTE - do
 * strojenia na żywym ciele, jak reszta liczb arcade.
 *
 * STRAŻNIK PRZY IMPORCIE: id technik i węzłów w warunkach idą przez T()/W(),
 * które RZUCAJĄ, gdy id zniknie z katalogu - każdy test importujący ten moduł
 * robi się wtedy czerwony, zamiast kamienia, którego nie da się zdobyć.
 */
import { PIECZECIE, DWOJKI, TROJKI, TECHNIKI, WEZLY } from './katalog.js';
import { tytulZaWynik } from './kronika.js';
import { BOGOWIE } from './jaja.js';

// Najdłuższe okno mitu (Kamienny Mur, 60 s) - Pamięć przycina historię do tego.
export const OKNO_HISTORII_MS = 60000;

const ID_TECHNIK = TECHNIKI.map(t => t.id);
const ID_WEZLOW = WEZLY.map(w => w.id);
const T = (id) => { if (!ID_TECHNIK.includes(id)) throw new Error(`osiagniecia.js: nieznana technika '${id}'`); return id; };
const W = (id) => { if (!ID_WEZLOW.includes(id)) throw new Error(`osiagniecia.js: nieznany węzeł '${id}'`); return id; };

const liczba = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const ile = (o, ids) => ids.filter(id => o?.[id]).length;
const wszystkie = (o, ids) => ids.length > 0 && ile(o, ids) === ids.length;
const tab = (h) => (Array.isArray(h) ? h : []);

/** b (najnowsze wystąpienie) poprzedzone przez a w ciągu oknoMs. */
export function poKolei(historia, [rA, a], [rB, b], oknoMs) {
    const h = tab(historia);
    for (let j = h.length - 1; j >= 0; j--) {
        if (h[j].rodzaj !== rB || h[j].id !== b) continue;
        for (let i = j - 1; i >= 0; i--) {
            if (h[j].t - h[i].t > oknoMs) break;
            if (h[i].rodzaj === rA && h[i].id === a) return true;
        }
        return false;   // starsze b sprawdzano, kiedy się zdarzyły
    }
    return false;
}

/** Każde z wymaganych zdarzeń wystąpiło w ostatnich oknoMs przed `now`. */
export function razem(historia, wymagane, oknoMs, now) {
    if (!Number.isFinite(now)) return false;
    const h = tab(historia);
    return wymagane.length > 0 && wymagane.every(([r, id]) => h.some(e => e.rodzaj === r && e.id === id && e.t >= now - oknoMs && e.t <= now));
}

export function ileWOknie(historia, rodzaj, id, oknoMs, now) {
    if (!Number.isFinite(now)) return 0;
    return tab(historia).filter(e => e.rodzaj === rodzaj && e.id === id && e.t >= now - oknoMs && e.t <= now).length;
}

export function rozneWOknie(historia, rodzaj, oknoMs, now) {
    if (!Number.isFinite(now)) return 0;
    return new Set(tab(historia).filter(e => e.rodzaj === rodzaj && e.t >= now - oknoMs && e.t <= now).map(e => e.id)).size;
}

const dataOk = (d) => d instanceof Date && Number.isFinite(d.getTime());
export const godzinaDuchow = (d) => dataOk(d) && d.getHours() < 3;
// Kupalnocka: najkrótsza noc, z 23 na 24 czerwca (miesiące w Date od zera: czerwiec = 5).
export const nocKupaly = (d) => dataOk(d) && d.getMonth() === 5
    && ((d.getDate() === 23 && d.getHours() >= 18) || (d.getDate() === 24 && d.getHours() < 6));

export const KATEGORIE = [
    { id: 'kolekcja', naglowek: 'Kolekcja' },
    { id: 'mit', naglowek: 'Mity' },
    { id: 'kunszt', naglowek: 'Kunszt i obrzęd' },
    { id: 'sekret', naglowek: 'Sekrety plemienia' }
];

export const KAMIENIE = [
    // --- KOLEKCJA ---
    { id: 'pierwszaIskra', nazwa: 'Pierwsza Iskra', opis: 'Pierwsza technika zapisana w Księdze.',
      kategoria: 'kolekcja', kiedy: 'zywo', runa: 'ᚲ',
      warunek: (s) => Object.keys(s.techniki ?? {}).length >= 1 },
    { id: 'piecZywiolow', nazwa: 'Pięć Żywiołów', opis: 'Każda z pięciu pieczęci złożona choć raz.',
      kategoria: 'kolekcja', kiedy: 'zywo', runa: 'ᚠ',
      postep: (s) => ({ ile: ile(s.pieczecie, PIECZECIE), z: PIECZECIE.length }),
      warunek: (s) => wszystkie(s.pieczecie, PIECZECIE) },
    { id: 'mowaGestow', nazwa: 'Mowa Gestów', opis: 'Wszystkie gesty dwóch pieczęci.',
      kategoria: 'kolekcja', kiedy: 'zywo', runa: 'ᚷ',
      postep: (s) => ({ ile: ile(s.techniki, DWOJKI), z: DWOJKI.length }),
      warunek: (s) => wszystkie(s.techniki, DWOJKI) },
    { id: 'wladcaZjawisk', nazwa: 'Władca Zjawisk', opis: 'Wszystkie zjawiska trzech pieczęci.',
      kategoria: 'kolekcja', kiedy: 'zywo', runa: 'ᚺ',
      postep: (s) => ({ ile: ile(s.techniki, TROJKI), z: TROJKI.length }),
      warunek: (s) => wszystkie(s.techniki, TROJKI) },
    { id: 'tkaczWezlow', nazwa: 'Tkacz Węzłów', opis: 'Wszystkie Węzły Mocy splecione.',
      kategoria: 'kolekcja', kiedy: 'zywo', runa: 'ᚾ',
      postep: (s) => ({ ile: ile(s.wezly, ID_WEZLOW), z: ID_WEZLOW.length }),
      warunek: (s) => wszystkie(s.wezly, ID_WEZLOW) },
    { id: 'wszechwiedzacy', nazwa: 'Wszechwiedzący Wołchw', opis: 'Cały Zwój Technik i wszystkie Węzły Mocy.',
      kategoria: 'kolekcja', kiedy: 'zywo', runa: 'ᛗ',
      warunek: (s) => wszystkie(s.techniki, ID_TECHNIK) && wszystkie(s.wezly, ID_WEZLOW) },

    // --- MITY (okna ZGADNIĘTE) ---
    { id: 'perunKontraWeles', nazwa: 'Perun kontra Weles', opis: 'Grom w Ziemię, a po nim Kołowrót — w ciągu 15 sekund.',
      kategoria: 'mit', kiedy: 'zywo', runa: 'ᚦ',
      warunek: (s) => poKolei(s.historia, ['technika', T('gromWZiemie')], ['technika', T('kolowrot')], 15000) },
    { id: 'trojsplot', nazwa: 'Trójsplot', opis: 'Trzy techniki splecione w jeden łańcuch.',
      kategoria: 'mit', kiedy: 'zywo', runa: 'ᛞ',
      warunek: (s) => liczba(s.splotSeria) >= 2 },
    { id: 'ogienIWoda', nazwa: 'Ogień i Woda', opis: 'Bania, a po niej Wstęga Mokoszy — w ciągu 15 sekund.',
      kategoria: 'mit', kiedy: 'zywo', runa: 'ᛚ',
      warunek: (s) => poKolei(s.historia, ['technika', T('bania')], ['technika', T('tecza')], 15000) },
    { id: 'burzaNadBagnem', nazwa: 'Burza nad Bagnem', opis: 'Przewodzenie i Burza w mgle w ciągu 5 sekund.',
      kategoria: 'mit', kiedy: 'zywo', runa: 'ᛇ',
      warunek: (s, c) => razem(s.historia, [['wezel', W('przewodzenie')], ['wezel', W('burzaWMgle')]], 5000, c?.now) },
    { id: 'nocDziadow', nazwa: 'Noc Dziadów', opis: 'Latarnie we mgle i Okadzenie w ciągu 30 sekund.',
      kategoria: 'mit', kiedy: 'zywo', runa: 'ᛈ',
      warunek: (s, c) => razem(s.historia, [['wezel', W('latarnie')], ['technika', T('dym')]], 30000, c?.now) },
    { id: 'kragZywiolow', nazwa: 'Krąg Żywiołów', opis: 'Pięć różnych pieczęci w ciągu 20 sekund.',
      kategoria: 'mit', kiedy: 'zywo', runa: 'ᛃ',
      warunek: (s, c) => rozneWOknie(s.historia, 'pieczec', 20000, c?.now) >= PIECZECIE.length },

    // --- KUNSZT I OBRZĘD (tylko rundy dokończone do Kroniki) ---
    { id: 'podpalaczNieba', nazwa: 'Podpalacz Nieba', opis: 'Pożoga na sto kłębów w jednej serii.',
      kategoria: 'kunszt', kiedy: 'runda', runa: 'ᚱ',
      warunek: (s, c) => liczba(c?.pods?.momenty?.serie?.[W('pozoga')]) >= 100 },
    { id: 'krolSzamanow', nazwa: 'Król Szamanów', opis: 'Tytuł Króla Szamanów w Kronice obrzędu.',
      kategoria: 'kunszt', kiedy: 'runda', runa: 'ᚨ',
      warunek: (s, c) => !!c?.pods && tytulZaWynik(c.pods.wynik, c.pods.dlugoscS).tytul === 'Król Szamanów' },
    { id: 'piesniarz', nazwa: 'Pieśniarz', opis: 'Każda pieśń plemienia zatańczona do końca.',
      kategoria: 'kunszt', kiedy: 'runda', runa: 'ᚹ',
      postep: (s) => ({ ile: tab(s.manifest).filter(p => tab(s.liczniki?.piesni).includes(p)).length, z: tab(s.manifest).length }),
      warunek: (s) => tab(s.manifest).length > 0 && tab(s.manifest).every(p => tab(s.liczniki?.piesni).includes(p)) },
    { id: 'wielkiKrag', nazwa: 'Wielki Krąg', opis: 'Krąg sześciu tancerzy zatańczony do końca.',
      kategoria: 'kunszt', kiedy: 'runda', runa: 'ᛖ',
      warunek: (s, c) => c?.pods?.kragKoniec === true && tab(c.pods.podium).length >= 6 },
    { id: 'wszechstronny', nazwa: 'Wszechstronny', opis: 'Osiem różnych technik w jednej rundzie.',
      kategoria: 'kunszt', kiedy: 'runda', runa: 'ᛜ',
      warunek: (s, c) => Object.values(c?.pods?.momenty?.techniki ?? {}).filter(n => liczba(n) > 0).length >= 8 },
    { id: 'dziesiecObrzedow', nazwa: 'Dziesięć Obrzędów', opis: 'Dziesięć rund zatańczonych do końca.',
      kategoria: 'kunszt', kiedy: 'runda', runa: 'ᛁ',
      postep: (s) => ({ ile: Math.min(10, liczba(s.liczniki?.rundy)), z: 10 }),
      warunek: (s) => liczba(s.liczniki?.rundy) >= 10 },
    { id: 'rekordPlemienia', nazwa: 'Rekord Plemienia', opis: 'Pobity rekord w Księdze Plemienia.',
      kategoria: 'kunszt', kiedy: 'runda', runa: 'ᛒ',
      warunek: (s, c) => c?.wynikKsiegi?.nowyRekord === true },

    // --- SEKRETY (ukryte do zdobycia) ---
    { id: 'bogWsrodLudzi', nazwa: 'Bóg wśród Ludzi', opis: 'Zatańczono pod imieniem boga.',
      kategoria: 'sekret', sekret: true, kiedy: 'nick', runa: 'ᚢ',
      warunek: (s) => tab(s.liczniki?.bogowie).length >= 1 },
    { id: 'pieciuBogow', nazwa: 'Pięciu Bogów', opis: 'Każdy z pięciu bogów zatańczył przy tym ognisku.',
      kategoria: 'sekret', sekret: true, kiedy: 'nick', runa: 'ᚺ',
      warunek: (s) => BOGOWIE.every(b => tab(s.liczniki?.bogowie).includes(b)) },
    { id: 'godzinaDuchow', nazwa: 'Godzina Duchów', opis: 'Taniec między północą a trzecią nad ranem.',
      kategoria: 'sekret', sekret: true, kiedy: 'zawsze', runa: 'ᛇ',
      warunek: (s, c) => godzinaDuchow(c?.teraz) },
    { id: 'nocKupaly', nazwa: 'Noc Kupały', opis: 'Taniec w najkrótszą noc, z 23 na 24 czerwca.',
      kategoria: 'sekret', sekret: true, kiedy: 'zawsze', runa: 'ᚲ',
      warunek: (s, c) => nocKupaly(c?.teraz) },
    { id: 'kamiennyMur', nazwa: 'Kamienny Mur', opis: 'Trzy Kamienne Tarcze w ciągu minuty.',
      kategoria: 'sekret', sekret: true, kiedy: 'zywo', runa: 'ᚢ',
      warunek: (s, c) => ileWOknie(s.historia, 'technika', T('kamiennaTarcza'), 60000, c?.now) >= 3 }
];
