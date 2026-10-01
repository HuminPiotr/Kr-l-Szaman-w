/**
 * Kronika obrzędu - teksty po rundzie: tytuł za wynik, przydomki, rozbicie punktów.
 * Spec: docs/superpowers/specs/2026-10-01-polana-ksiega-design.md
 *
 * CZYSTA LOGIKA, BEZ DOM. TON (GEMINI.md §2): to podsumowanie, nie wyrok - nawet
 * najniższy tytuł jest ciepły ("każde ognisko zaczyna się od kłody"), przydomek
 * pojawia się tylko, gdy coś go zasłużyło (brak pasującego = brak przydomka,
 * nigdy "brak osiągnięć").
 */
import { PIESN_AWARYJNA_S } from './tryby.js';

const liczba = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

// Tytuł liczony z PUNKTÓW NA MINUTĘ: próba 60 s i pieśń 4:23 nie mogą mierzyć się tą
// samą liczbą. ZGADNIĘTE progi - do strojenia na żywym ciele (jak PROG_SZARPNIECIA).
export const PROGI_TYTULOW = [
    { do: 150, tytul: 'Kłoda', zdanie: 'Każde ognisko zaczyna się od kłody.' },
    { do: 400, tytul: 'Uczeń Ogniska', zdanie: 'Iskra już zaskoczyła.' },
    { do: 800, tytul: 'Szeptucha', zdanie: 'Duchy zaczynają Cię słyszeć.' },
    { do: 1300, tytul: 'Żerca', zdanie: 'Ogień tańczy razem z Tobą.' },
    { do: 2000, tytul: 'Wołchw', zdanie: 'Żywioły słuchają Twojego głosu.' },
    { do: Infinity, tytul: 'Król Szamanów', zdanie: 'Cała polana klęka przed Twoim ogniem.' }
];

export function punktyNaMinute(wynik, dlugoscS) {
    const d = liczba(dlugoscS) || PIESN_AWARYJNA_S;
    return liczba(wynik) / (d / 60);
}

/** @returns {{tytul:string, zdanie:string}} */
export function tytulZaWynik(wynik, dlugoscS) {
    const ppm = punktyNaMinute(wynik, dlugoscS);
    const p = PROGI_TYTULOW.find(x => ppm < x.do) ?? PROGI_TYTULOW.at(-1);
    return { tytul: p.tytul, zdanie: p.zdanie };
}

// REJESTR PRZYDOMKÓW - nowa technika/reakcja = nowy wpis. Reguły czytają tylko pola
// z Przebieg.zapiszWynik (rozbicie, momenty); tools/test-kronika.mjs pilnuje, że
// id techniki/reakcji, do których się odwołują, nadal istnieją (KOMBOSY, REAKCJE).
// Progi zgadnięte jak reszta liczb arcade.
export const PRZYDOMKI = [
    { id: 'podpalacz', nazwa: 'Podpalacz Chmur', pasuje: (p) => liczba(p?.momenty?.serie?.pozoga) >= 40 },
    { id: 'wiatrodmuch', nazwa: 'Wiatrodmuch', pasuje: (p) => liczba(p?.momenty?.serie?.rozwianie) >= 40 },
    { id: 'tancerz', nazwa: 'Tancerz Czystego Ruchu',
      pasuje: (p) => liczba(p?.wynik) > 0 && liczba(p?.rozbicie?.taniec) / liczba(p?.wynik) >= 0.6 },
    { id: 'pierunow', nazwa: 'Pan Pierunów',
      pasuje: (p) => liczba(p?.momenty?.techniki?.gromWOgniu) + liczba(p?.momenty?.techniki?.gromWZiemie) >= 3 },
    { id: 'splatacz', nazwa: 'Splatacz', pasuje: (p) => liczba(p?.momenty?.splecenia) >= 3 }
];

const MAX_PRZYDOMKOW = 2;

/** @returns {string[]} maks. 2 nazwy, w kolejności rejestru */
export function przydomki(pods) {
    return PRZYDOMKI.filter(r => r.pasuje(pods)).slice(0, MAX_PRZYDOMKOW).map(r => r.nazwa);
}

const WARSTWY = [['taniec', 'taniec'], ['pieczecie', 'pieczęcie'], ['techniki', 'techniki'], ['reakcje', 'reakcje']];

function tekstMiejsca(wk) {
    if (!wk) return '';
    if (!wk.wpisano) return 'Tym razem poza dziesiątką — Księga pamięta najlepszych, a Ty tańcz dalej.';
    if (wk.nowyRekord) return 'Nowy rekord Plemienia!';
    if (wk.pierwszyWpis) return 'Pierwszy zapis w Księdze tego obrzędu.';
    return `Miejsce ${wk.miejsce} w Księdze Plemienia.`;
}

/**
 * @param {object} pods  z Przebieg.zapiszWynik()
 * @param {{wynikKsiegi?: {wpisano:boolean, miejsce:number|null, nowyRekord:boolean, pierwszyWpis:boolean}|null}} [opcje]
 */
export function zbudujKronike(pods, opcje) {
    // `opcje` może być null (domyślna wartość parametru działa tylko dla undefined).
    const wynikKsiegi = opcje?.wynikKsiegi ?? null;
    const wynik = Math.floor(liczba(pods?.wynik));
    const linie = [];
    for (const [klucz, etykieta] of WARSTWY) {
        const v = liczba(pods?.rozbicie?.[klucz]);
        if (v > 0) linie.push(`${etykieta}: ${Math.floor(v)}`);
    }
    const pozoga = liczba(pods?.momenty?.serie?.pozoga);
    if (pozoga > 0) linie.push(`największa Pożoga: ${Math.floor(pozoga)} kłębów`);
    const splecenia = liczba(pods?.momenty?.splecenia);
    if (splecenia > 0) linie.push(`spleceń technik: ${Math.floor(splecenia)}`);

    let podpis = 'Enter — jeszcze raz · Esc — Polana';
    if (pods?.kragKoniec === false && pods.nastepny) podpis = `Enter — teraz tańczy: ${pods.nastepny} · Esc — Polana`;
    if (pods?.kragKoniec === true) podpis = 'Enter — nowy Krąg · Esc — Polana';

    return {
        tytul: pods?.nick ? `${pods.nick} — obrzęd skończony` : 'Obrzęd skończony',
        wynik: String(wynik),
        szaman: tytulZaWynik(pods?.wynik, pods?.dlugoscS),
        przydomki: przydomki(pods),
        linie,
        podium: Array.isArray(pods?.podium)
            ? pods.podium.map((w, i) => ({ miejsce: i + 1, nick: String(w.nick), wynik: Math.floor(liczba(w.wynik)) }))
            : null,
        miejsce: tekstMiejsca(wynikKsiegi),
        podpis
    };
}
