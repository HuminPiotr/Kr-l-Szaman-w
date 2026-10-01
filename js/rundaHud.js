/**
 * HUD rundy - odliczanie, czas, Zew, "Teraz tańczy", baner końca.
 *
 * DOM, NIE PŁÓTNO (lustro, webfont - jak js/sekwencja.js i js/wynikHud.js).
 * Funkcje CZYSTE liczą widok (testy w node), klasa tylko aplikuje go do
 * elementów; brak elementów = cicho nic nie robi.
 *
 * TON (§2): baner końca to PODSUMOWANIE, nie wyrok - bez słów porażki,
 * ostatnie 10 s to rozpalająca się łuna, nie zagrożenie.
 * Baner końca jest TYMCZASOWY - zastąpi go Kronika obrzędu z podprojektu 3.
 */
import { NAZWY_ZYWIOLOW } from './tryby.js';

const liczba = (v) => Number.isFinite(v) && v > 0 ? v : 0;

/** 65 -> '1:05'. Zaokrąglane W GÓRĘ: 0:00 pokazujemy dopiero, gdy czas naprawdę minął. */
export function formatCzasu(s) {
    if (!Number.isFinite(s) || s <= 0) return '0:00';
    const c = Math.ceil(s);
    return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`;
}

export function tekstZewu(zywiol) {
    const nazwa = NAZWY_ZYWIOLOW[zywiol];
    return nazwa ? `Duchy proszą: ${nazwa} ×2` : '';
}

const ETYKIETY = [['taniec', 'taniec'], ['pieczecie', 'pieczęcie'], ['techniki', 'techniki'], ['reakcje', 'reakcje']];

/** Podsumowanie z Przebieg.zapiszWynik() -> teksty do banera. */
export function tekstPodsumowania(pods) {
    const wynik = String(Math.floor(liczba(pods?.wynik)));
    const linie = [];
    if (pods?.podium) {
        pods.podium.forEach((w, i) => linie.push(`${i + 1}. ${w.nick} — ${Math.floor(liczba(w.wynik))}`));
    } else {
        for (const [klucz, etykieta] of ETYKIETY) {
            const v = liczba(pods?.rozbicie?.[klucz]);
            if (v > 0) linie.push(`${etykieta}: ${Math.floor(v)}`);
        }
        const pozoga = liczba(pods?.momenty?.serie?.pozoga);
        if (pozoga > 0) linie.push(`największa Pożoga: ${Math.floor(pozoga)} kłębów`);
        const splecenia = liczba(pods?.momenty?.splecenia);
        if (splecenia > 0) linie.push(`spleceń technik: ${Math.floor(splecenia)}`);
    }
    let tytul = pods?.nick ? `${pods.nick} — obrzęd skończony` : 'Obrzęd skończony';
    if (pods?.kragKoniec) tytul = 'Krąg zamknięty';
    let podpis = 'Enter — jeszcze raz · Esc — swobodny taniec';
    if (pods?.kragKoniec === false && pods.nastepny) podpis = `Enter — teraz tańczy: ${pods.nastepny} · Esc — swobodny taniec`;
    return { tytul, wynik, linie, podpis };
}

/** @param {import('./przebieg.js').Przebieg|null} przebieg  null = tryb swobodny */
export function widokRundy(przebieg) {
    const pusty = { zapowiedz: '', odliczanie: 0, czas: '', ostatnie: false, zew: '', koniec: null };
    if (!przebieg) return pusty;
    if (przebieg.stan === 'PODSUMOWANIE' && przebieg.podsumowanie) {
        return { ...pusty, koniec: tekstPodsumowania(przebieg.podsumowanie) };
    }
    if (przebieg.stan !== 'RUNDA') return pusty;
    const r = przebieg.runda;
    return {
        zapowiedz: r.stan === 'ZAPOWIEDZ' && przebieg.nick ? `Teraz tańczy: ${przebieg.nick}` : '',
        odliczanie: r.odliczanie,
        czas: r.stan === 'TRWA' || r.stan === 'WYBRZMIENIE' ? formatCzasu(r.pozostaloS) : '',
        ostatnie: r.ostatnieSekundy,
        zew: r.stan === 'TRWA' ? tekstZewu(przebieg.zew?.zywiol) : '',
        koniec: null
    };
}

export class RundaHud {
    constructor(root) {
        this.root = root ?? null;
        const q = (s) => root?.querySelector(s) ?? null;
        this.zapowiedz = q('#runda-zapowiedz');
        this.odliczanie = q('#runda-odliczanie');
        this.czas = q('#runda-czas');
        this.zew = q('#runda-zew');
        this.koniec = q('#runda-koniec');
        this.koniecTytul = q('#runda-koniec-tytul');
        this.koniecWynik = q('#runda-koniec-wynik');
        this.koniecLinie = q('#runda-koniec-linie');
        this.koniecPodpis = q('#runda-koniec-podpis');
        this._ost = {};
    }

    _tekst(klucz, el, tekst) {
        if (!el || this._ost[klucz] === tekst) return;
        el.textContent = tekst;
        this._ost[klucz] = tekst;
    }

    update(w) {
        if (!this.root) return;
        const cokolwiek = w.zapowiedz || w.odliczanie || w.czas || w.zew || w.koniec;
        this.root.classList.toggle('hidden', !cokolwiek);
        this._tekst('zapowiedz', this.zapowiedz, w.zapowiedz);
        this._tekst('odliczanie', this.odliczanie, w.odliczanie ? String(w.odliczanie) : '');
        this._tekst('czas', this.czas, w.czas);
        this._tekst('zew', this.zew, w.zew);
        this.root.classList.toggle('ostatnie', !!w.ostatnie);
        this.koniec?.classList.toggle('hidden', !w.koniec);
        if (w.koniec) {
            this._tekst('kt', this.koniecTytul, w.koniec.tytul);
            this._tekst('kw', this.koniecWynik, w.koniec.wynik);
            this._tekst('kp', this.koniecPodpis, w.koniec.podpis);
            const sygnatura = w.koniec.linie.join('\n');
            if (this.koniecLinie && this._ost.kl !== sygnatura) {
                this.koniecLinie.replaceChildren();
                for (const l of w.koniec.linie) {
                    const el = document.createElement('div');
                    el.textContent = l;   // tekst (nick gracza!) wyłącznie przez textContent
                    this.koniecLinie.appendChild(el);
                }
                this._ost.kl = sygnatura;
            }
        }
    }
}
