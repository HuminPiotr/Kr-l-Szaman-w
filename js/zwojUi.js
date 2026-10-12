/**
 * Zwój Technik, Węzły Mocy i Kamienie Pamięci - warstwa DOM działów Księgi.
 * Spec: docs/superpowers/specs/2026-10-12-pamiec-plemienia-design.md
 *
 * LOGIKI TU NIE MA (stan w js/odkrycia.js). Tekst wyłącznie przez textContent.
 *
 * NIEODKRYTE ZDRADZAJĄ TYLKO NAZWĘ I ZWĘGLONY EMBLEMAT - bez sekwencji, run
 * i podpowiedzi (decyzja właściciela). Sekret niezdobyty nie zdradza nawet nazwy.
 */
import { DWOJKI, TROJKI, TECHNIKI, WEZLY, PIECZECIE, NAZWY_PIECZECI } from './katalog.js';
import { KAMIENIE, KATEGORIE } from './osiagniecia.js';
import { EMBLEMATY, WEZLY_EMBLEMATY } from './emblematy.js';
import { nazwaOdkrycia } from './odkrycia.js';
import { rysujEmblemat } from './emblematDom.js';
import { glif } from './glify.js';

const data = (t) => new Date(t).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
const razy = (n) => (n === 1 ? '1 raz' : `${n} razy`);
const kamien = (id) => KAMIENIE.find(k => k.id === id) ?? null;

export class ZwojUi {
    /** @param {{odkrycia: import('./odkrycia.js').Odkrycia, onZmiana: () => void}} deps */
    constructor(doc, { odkrycia, onZmiana }) {
        this.doc = doc;
        this.o = odkrycia;
        this.onZmiana = onZmiana;
        this.otwarty = null;      // {rodzaj, id} karty szczegółu
        this._dzial = 'techniki';
        this.$ = (id) => doc.getElementById(id);
        this.$('zwoj-zamknij')?.addEventListener('click', () => this.zamknij());
        this.$('zwoj-siatka')?.addEventListener('keydown', (e) => this._strzalki(e));
    }

    get maSzczegol() { return !!this.otwarty; }

    otworz(rodzaj, id) {
        this.otwarty = { rodzaj, id };
        this.o.oznaczObejrzane(rodzaj, id);   // żar nowości gaśnie po otwarciu
        this.onZmiana();
        this.$('zwoj-zamknij')?.focus();
    }

    zamknij() {
        const z = this.otwarty;
        this.otwarty = null;
        this.onZmiana();
        if (z) this.doc.querySelector(`#zwoj-siatka [data-klucz="${z.rodzaj}:${z.id}"]`)?.focus();
    }

    renderPostep() {
        const runy = this.$('ksiega-runy');
        runy.replaceChildren();
        for (const id of PIECZECIE) {
            const s = this.doc.createElement('span');
            s.className = 'runa-postepu' + (this.o.ma('pieczec', id) ? ' zarzy' : '');
            s.textContent = glif(id);
            if (this.o.ma('pieczec', id)) s.title = NAZWY_PIECZECI[id];
            runy.appendChild(s);
        }
        const p = this.o.postep();
        this.$('ksiega-licznik').textContent =
            `Odkryto ${p.techniki.ile} z ${p.techniki.z} technik · ${p.wezly.ile} z ${p.wezly.z} węzłów · ${p.kamienie.ile} z ${p.kamienie.z} kamieni`;
    }

    renderuj(dzial) {
        this._dzial = dzial;
        const siatka = this.$('zwoj-siatka');
        siatka.replaceChildren();
        this.$('zwoj-szczegol').classList.toggle('hidden', !this.otwarty);
        siatka.classList.toggle('hidden', !!this.otwarty);
        if (this.otwarty) { this._renderSzczegol(); return; }
        if (dzial === 'techniki') {
            this._sekcja(siatka, 'Gesty', 'dwie pieczęcie', DWOJKI.map(id => ['technika', id]));
            this._sekcja(siatka, 'Zjawiska', 'trzy pieczęcie', TROJKI.map(id => ['technika', id]));
        } else if (dzial === 'wezly') {
            this._sekcja(siatka, 'Węzły Mocy', 'gdy techniki spotkają się w polu', WEZLY.map(w => ['wezel', w.id]));
        } else {
            for (const kat of KATEGORIE) {
                this._sekcja(siatka, kat.naglowek, '', KAMIENIE.filter(k => k.kategoria === kat.id).map(k => ['kamien', k.id]));
            }
        }
    }

    _sekcja(siatka, naglowek, podpis, pozycje) {
        const doc = this.doc;
        const sek = doc.createElement('section'); sek.className = 'zwoj-sekcja';
        const h = doc.createElement('h3'); h.textContent = naglowek;
        if (podpis) { const s = doc.createElement('small'); s.textContent = ` · ${podpis}`; h.appendChild(s); }
        const lista = doc.createElement('div'); lista.className = 'zwoj-karty';
        for (const [r, id] of pozycje) lista.appendChild(this._karta(r, id));
        sek.append(h, lista);
        siatka.appendChild(sek);
    }

    _karta(rodzaj, id) {
        const { doc, o } = this;
        const zdobyte = o.ma(rodzaj, id);
        const k = rodzaj === 'kamien' ? kamien(id) : null;
        const ukryty = !!k?.sekret && !zdobyte;
        const b = doc.createElement('button');
        b.type = 'button';
        b.dataset.klucz = `${rodzaj}:${id}`;
        b.className = `karta karta-${rodzaj} ${zdobyte ? 'odkryta' : 'zweglona'}`
            + (o.czyNowe(rodzaj, id) ? ' nowa' : '') + (ukryty ? ' sekret' : '');
        const znak = doc.createElement('span'); znak.className = 'karta-znak';
        znak.appendChild(rysujEmblemat(doc, ukryty ? 'sekret' : rodzaj, id));
        const nazwa = doc.createElement('span'); nazwa.className = 'karta-nazwa';
        nazwa.textContent = ukryty ? 'Sekret plemienia' : nazwaOdkrycia(rodzaj, id);
        b.append(znak, nazwa);
        if (k?.postep && !zdobyte && !ukryty) b.appendChild(this._naciecia(k.postep(o)));
        b.addEventListener('click', () => this.otworz(rodzaj, id));
        return b;
    }

    /** Postęp jako nacięcia na kamieniu ("3 z 5"), nie pasek braków (§2). */
    _naciecia({ ile, z }) {
        const s = this.doc.createElement('span'); s.className = 'karta-postep';
        if (z <= 16) {
            for (let i = 0; i < z; i++) {
                const n = this.doc.createElement('i'); n.className = i < ile ? 'naciecie wyryte' : 'naciecie';
                s.appendChild(n);
            }
        }
        const t = this.doc.createElement('span'); t.className = 'postep-tekst'; t.textContent = `${ile} z ${z}`;
        s.appendChild(t);
        return s;
    }

    _renderSzczegol() {
        const { doc, o } = this;
        const { rodzaj, id } = this.otwarty;
        const zdobyte = o.ma(rodzaj, id);
        const k = rodzaj === 'kamien' ? kamien(id) : null;
        const ukryty = !!k?.sekret && !zdobyte;
        const sz = this.$('zwoj-szczegol');
        sz.className = `${zdobyte ? 'odkryta' : 'zweglona'} szczegol-${rodzaj}`;
        this.$('szczegol-znak').replaceChildren(rysujEmblemat(doc, ukryty ? 'sekret' : rodzaj, id));
        this.$('szczegol-nazwa').textContent = ukryty ? 'Sekret plemienia' : nazwaOdkrycia(rodzaj, id);
        const sekw = this.$('szczegol-sekwencja'); sekw.replaceChildren();
        let opis = '', meta = '';

        if (rodzaj === 'technika') {
            if (zdobyte) {
                for (const p of TECHNIKI.find(t => t.id === id).sekwencja) {
                    const r = doc.createElement('span'); r.className = 'runa-sekwencji';
                    r.textContent = glif(p); r.title = NAZWY_PIECZECI[p];
                    sekw.appendChild(r);
                }
                opis = EMBLEMATY[id].legenda;
                meta = `Użyta ${razy(o.techniki[id].n)} · pierwszy raz ${data(o.techniki[id].t)}`;
            } else {
                opis = 'Jeszcze nie zapisana w Księdze. Tańcz, a sama się ujawni.';
            }
        } else if (rodzaj === 'wezel') {
            if (zdobyte) {
                const [a, b] = WEZLY_EMBLEMATY[id].skladowe;
                opis = WEZLY_EMBLEMATY[id].legenda;
                meta = `Splata: ${nazwaOdkrycia('technika', a)} i ${nazwaOdkrycia('technika', b)} · `
                    + `${razy(o.wezly[id].n)} · pierwszy raz ${data(o.wezly[id].t)}`;
            } else {
                opis = 'Jeszcze nie spleciony. Węzły rodzą się, gdy techniki spotkają się w polu.';
            }
        } else if (k) {
            if (ukryty) {
                opis = 'Ten kamień ujawni się sam, gdy nadejdzie jego chwila.';
            } else {
                opis = k.opis;
                if (zdobyte) meta = `Zdobyty ${data(o.kamienie[id].t)}`;
                else if (k.postep) { const p = k.postep(o); meta = `${p.ile} z ${p.z}`; }
            }
        }
        this.$('szczegol-opis').textContent = opis;
        this.$('szczegol-meta').textContent = meta;
    }

    /** Strzałki po kartach: lewo/prawo ±1, góra/dół o szerokość rzędu. */
    _strzalki(e) {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        const karty = [...this.$('zwoj-siatka').querySelectorAll('.karta')];
        const i = karty.indexOf(this.doc.activeElement);
        if (i < 0) return;
        const wRzedzie = Math.max(1, karty.filter(k => k.offsetTop === karty[i].offsetTop).length);
        const krok = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -wRzedzie, ArrowDown: wRzedzie }[e.key];
        const cel = karty[Math.min(karty.length - 1, Math.max(0, i + krok))];
        cel?.focus();
        e.preventDefault();
    }
}
