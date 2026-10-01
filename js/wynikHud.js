/**
 * HUD wyniku - licznik w lewym górnym rogu, unoszące się "+340 Okadzenie"
 * w miejscu zdarzenia i zagregowane serie reakcji ("Pożoga ×23 · +184").
 *
 * DOM, NIE PŁÓTNO - te same powody co js/sekwencja.js (lustrzane płótno,
 * webfont). Podział jak tam: funkcje CZYSTE liczą (testy w node), klasa
 * tylko aplikuje do elementów; brak elementów = cicho nic nie robi.
 *
 * Reakcje NIE dostają unoszących się napisów - przychodzą co klatkę
 * i zalałyby ekran. Idą jako jedna linijka serii pod licznikiem.
 */
export const MAX_UNOSZACYCH = 12;
const CZAS_UNOSZENIA_MS = 1400;   // = czas animacji .unosi w style.css

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function formatujWynik(w) {
    return String(Math.floor(Number.isFinite(w) ? Math.max(0, w) : 0));
}

/** Piksele płótna -> procenty CSS warstwy UI. Płótno jest lustrzane (scaleX(-1)). */
export function pozycjaWLustrze(miejsce, W, H) {
    if (!miejsce || !Number.isFinite(miejsce.x) || !Number.isFinite(miejsce.y) || !(W > 0) || !(H > 0)) {
        return { lewo: 50, gora: 40 };
    }
    return {
        lewo: clamp(100 * (1 - miejsce.x / W), 5, 95),
        gora: clamp(100 * miejsce.y / H, 8, 90)
    };
}

export function tekstZdarzenia(z) {
    const p = `+${Math.round(z.punkty)}`;
    return z.tekst ? `${p} ${z.tekst}` : p;
}

export function tekstSerii(s) {
    return `${s.nazwa} ×${s.n} · +${Math.round(s.punkty)}`;
}

export class WynikHud {
    constructor(root) {
        this.root = root ?? null;
        this.licznik = root?.querySelector('#wynik-licznik') ?? null;
        this.serie = root?.querySelector('#wynik-serie') ?? null;
        // #wynik-unoszace leży POZA #wynik-hud (pełnoekranowa warstwa) - stąd getElementById.
        this.warstwa = root ? document.getElementById('wynik-unoszace') : null;
        this._ostatniLicznik = '';
        this._ostatnieSerie = '';
    }

    update(punktacja, now, W, H) {
        const zdarzenia = punktacja.odbierzZdarzenia();   // odbierz ZAWSZE - kolejka nie może rosnąć bez HUD
        if (!this.root) return;
        this.root.classList.toggle('wylaczony', !punktacja.aktywna);
        if (!punktacja.aktywna) return;

        const l = formatujWynik(punktacja.wynik);
        if (l !== this._ostatniLicznik && this.licznik) {
            this.licznik.textContent = l;
            this._ostatniLicznik = l;
        }

        const s = punktacja.serieAktywne(now).map(tekstSerii).join('   ');
        if (s !== this._ostatnieSerie && this.serie) {
            this.serie.textContent = s;
            this._ostatnieSerie = s;
        }

        if (!this.warstwa) return;
        for (const z of zdarzenia) {
            while (this.warstwa.childElementCount >= MAX_UNOSZACYCH) this.warstwa.firstElementChild.remove();
            const el = document.createElement('span');
            el.className = `unosi unosi-${z.rodzaj}`;
            el.textContent = tekstZdarzenia(z);
            const { lewo, gora } = pozycjaWLustrze(z.miejsce, W, H);
            el.style.left = `${lewo}%`;
            el.style.top = `${gora}%`;
            this.warstwa.appendChild(el);
            // animationend nie przychodzi przy reduced-motion bez animacji -
            // setTimeout to jedyne pewne sprzątanie.
            setTimeout(() => el.remove(), CZAS_UNOSZENIA_MS + 100);
        }
    }
}
