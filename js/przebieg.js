/**
 * Przebieg - orkiestrator rundy, Zewu i Kręgu.
 * Spec: docs/superpowers/specs/2026-10-01-tryby-design.md
 *
 * CZYSTA LOGIKA, BEZ DOM. main.js woła update(now) co klatkę i reaguje na
 * ZDARZENIA (PUSH jak przy punktach): 'trwa' (reset modułów, start pieśni),
 * 'wybrzmienie' (zanik pieśni), 'koniecRundy' (zapis wyniku). Wynik żyje
 * w Punktacja, nie tutaj - Przebieg dostaje go przez zapiszWynik().
 *
 * Tryb swobodny NIE MA przebiegu (main.js trzyma `przebieg = null`):
 * bez rundy nie ma czego orkiestrować, a punkty są wtedy wyłączone.
 */
import { Runda, Zew, Krag } from './tryby.js';

export class Przebieg {
    /**
     * @param {{tryb:string, dlugoscS:number, zew:boolean, krag:string[]|null}} konfig  z parsujKonfiguracje()
     * @param {{losowa?:()=>number}} [opcje]  wstrzykiwana losowa (testy)
     */
    constructor(konfig, { losowa = Math.random } = {}) {
        if (!konfig || (konfig.tryb !== 'proba' && konfig.tryb !== 'obrzed')) {
            throw new Error('Przebieg wymaga trybu proba/obrzed (swobodny nie ma przebiegu)');
        }
        this.konfig = konfig;
        this._losowa = losowa;
        this.krag = konfig.krag ? new Krag(konfig.krag) : null;
        this.runda = null;
        this.zew = null;
        this.nick = null;
        this.podsumowanie = null;
        this._zalegle = [];         // zdarzenia wywołane poza update() (zakonczPiesn)
        this.stan = 'NIEZACZETY';   // RUNDA | PODSUMOWANIE | PRZERWANY
    }

    start(now) { this._nowaRunda(now); }

    _nowaRunda(now) {
        this.nick = this.krag ? this.krag.biezacy : null;
        this.runda = new Runda({ dlugoscS: this.konfig.dlugoscS, zapowiedz: !!this.krag });
        this.zew = this.konfig.zew ? new Zew(this._losowa) : null;
        this.podsumowanie = null;
        this.runda.start(now);
        this.stan = 'RUNDA';
    }

    /**
     * @returns {{typ:'trwa'|'wybrzmienie'|'koniecRundy'}[]} zdarzenia z tej klatki
     */
    update(now) {
        if (this.stan !== 'RUNDA') return [];
        const zdarzenia = this._zalegle.splice(0);   // 'wybrzmienie' z zakonczPiesn()
        const przed = this.runda.stan;
        const po = this.runda.update(now);
        if (this.zew && po === 'TRWA') this.zew.update(this.runda.czasRundyS);
        if (przed !== po) {
            if (po === 'TRWA') zdarzenia.push({ typ: 'trwa' });
            if (po === 'WYBRZMIENIE') zdarzenia.push({ typ: 'wybrzmienie' });
            if (po === 'KONIEC') zdarzenia.push({ typ: 'koniecRundy' });
        }
        return zdarzenia;
    }

    /**
     * Pieśń skończyła się wcześniej niż czas (`ended`). Runda zmienia stan poza
     * update(), więc zdarzenie 'wybrzmienie' trafia do kolejki NAJBLIŻSZEGO
     * update() - main.js odbiera je tą samą drogą co pozostałe. Drugie `ended`
     * (albo `ended` po czasie) nie dubluje zdarzenia: Runda.zakonczPiesn() działa
     * tylko z TRWA.
     */
    zakonczPiesn() {
        if (this.stan !== 'RUNDA') return;
        const przed = this.runda.stan;
        this.runda.zakonczPiesn();
        if (przed === 'TRWA' && this.runda.stan === 'WYBRZMIENIE') this._zalegle.push({ typ: 'wybrzmienie' });
    }

    przerwij() {
        if (this.stan !== 'RUNDA') return;
        this.runda.przerwij();
        this.stan = 'PRZERWANY';
    }

    /**
     * Zapis wyniku PO koniecRundy. Poprawny raz: w każdym innym stanie null
     * (w trakcie rundy, po przerwaniu, drugi raz) - żeby podwójne wywołanie nie
     * zapisało dwóch wyników ani wyniku przerwanej rundy.
     */
    zapiszWynik(wynik, rozbicie, momenty) {
        if (this.stan !== 'RUNDA' || this.runda.stan !== 'KONIEC') return null;
        const w = Number.isFinite(wynik) && wynik > 0 ? wynik : 0;
        const pods = { tryb: this.konfig.tryb, nick: this.nick, wynik: w, rozbicie, momenty,
                       kragKoniec: null, nastepny: null, podium: null };
        if (this.krag) {
            this.krag.zapiszWynik(w, rozbicie, momenty);
            pods.kragKoniec = this.krag.czyKoniec;
            pods.nastepny = this.krag.czyKoniec ? null : this.krag.biezacy;
            pods.podium = this.krag.czyKoniec ? this.krag.podium : null;
        }
        this.podsumowanie = pods;
        this.stan = 'PODSUMOWANIE';
        return pods;
    }

    /** Enter na podsumowaniu: następny gracz Kręgu albo ta sama runda od nowa. */
    dalej(now) {
        if (this.stan !== 'PODSUMOWANIE') return false;
        if (this.krag && this.krag.czyKoniec) this.krag = new Krag(this.konfig.krag);
        this._nowaRunda(now);
        return true;
    }

    /** Mnożnik Zewu dla Punktacja.mnoznikZewu - tylko, gdy punkty faktycznie płyną. */
    mnoznikZewu(rodzaj, arg) {
        if (!this.zew || this.stan !== 'RUNDA' || !this.runda.punktuje) return 1;
        return this.zew.mnoznik(rodzaj, arg);
    }
}
