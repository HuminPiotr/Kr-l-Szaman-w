/**
 * Powiadomienie na żywo o odkryciu (Pamięć Plemienia, spec 2026-10-12).
 * Cichy znak w prawym górnym rogu - pod licznikiem czasu rundy, z dala od
 * komunikatu techniki (ostatniKomunikat) i licznika wyniku. Gra się nie zatrzymuje.
 *
 * KolejkaPowiadomien to czysta logika (test w node); OdkryciaHud tylko renderuje.
 * Pod menu (body.w-menu) znak jest schowany w CSS.
 */
import { rysujEmblemat } from './emblematDom.js';
import { nazwaOdkrycia } from './odkrycia.js';

export const CZAS_POWIADOMIENIA_MS = 2600;
// Kilka odkryć w jednej klatce to norma (pieczęć + technika + kamień); 8 to ~20 s
// znaków - dalsze i tak czekają w Kronice i Księdze.
export const MAX_KOLEJKI = 8;

const NAGLOWKI = { pieczec: 'Nowa pieczęć', technika: 'Odkryto technikę', wezel: 'Nowy Węzeł Mocy', kamien: 'Kamień Pamięci' };

export class KolejkaPowiadomien {
    constructor() {
        this._kolejka = [];
        this._biezacy = null;
        this._od = 0;
    }

    dodaj(pozycje) {
        if (!Array.isArray(pozycje)) return;
        for (const p of pozycje) {
            if (p && typeof p.rodzaj === 'string' && typeof p.id === 'string' && this._kolejka.length < MAX_KOLEJKI) this._kolejka.push(p);
        }
    }

    aktualny(now) {
        if (this._biezacy && now - this._od < CZAS_POWIADOMIENIA_MS) return this._biezacy;
        this._biezacy = this._kolejka.shift() ?? null;
        this._od = now;
        return this._biezacy;
    }
}

export class OdkryciaHud {
    constructor(root) {
        this.root = root ?? null;
        this.kolejka = new KolejkaPowiadomien();
        this._pokazany = null;
    }

    dodaj(pozycje) { this.kolejka.dodaj(pozycje); }

    update(now) {
        const p = this.kolejka.aktualny(now);
        if (!this.root || p === this._pokazany) return;
        this._pokazany = p;
        if (!p) { this.root.classList.remove('widoczny'); return; }
        const doc = this.root.ownerDocument;
        this.root.querySelector('.odkrycie-znak').replaceChildren(rysujEmblemat(doc, p.rodzaj, p.id));
        this.root.querySelector('.odkrycie-rodzaj').textContent = NAGLOWKI[p.rodzaj] ?? '';
        this.root.querySelector('.odkrycie-nazwa').textContent = nazwaOdkrycia(p.rodzaj, p.id);
        // Restart animacji rozpalenia dla kolejnego znaku pod rząd.
        this.root.classList.remove('widoczny');
        void this.root.offsetWidth;
        this.root.classList.add('widoczny');
    }
}
