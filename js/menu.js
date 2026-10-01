/**
 * Menu - model ekranów i konfiguracji (CZYSTA LOGIKA, bez DOM).
 * Spec: docs/superpowers/specs/2026-10-01-polana-ksiega-design.md
 *
 * Model trzyma stan i wybory, warstwa DOM (js/polanaUi.js) tylko je renderuje.
 * `konfiguracja()` zwraca DOKŁADNIE kształt parsujKonfiguracje (+ nick), więc menu
 * i adres prowadzą do tej samej uruchomZKonfiguracji w main.js - jedna ścieżka
 * wejścia do gry.
 *
 * TON (§2): błędy konfiguracji to zaproszenia ("Dopisz jeszcze jednego tancerza"),
 * nigdy wyrok ani czerwony komunikat.
 */
import { PROBA_DLUGOSCI, PIESN_AWARYJNA_S, MAX_NICK, MIN_KRAG, MAX_KRAG } from './tryby.js';

export const KAMIENIE = ['obrzed', 'proba', 'swobodny', 'ksiega'];
export const EKRANY = ['polana', 'konfig', 'ksiega', 'gra', 'kronika'];

// Nick trzymamy SUROWY (tylko ucięty do limitu) - przycięcie spacji w trakcie pisania
// zjadałoby spację między imionami ("Ola " -> "Ola" przed wpisaniem "Maria").
// Przycinamy dopiero w bledy()/konfiguracja().
const ciety = (s) => String(s ?? '').slice(0, MAX_NICK);
const przytnij = (s) => String(s ?? '').trim().slice(0, MAX_NICK);

export class Menu {
    /**
     * @param {{piesni?: Array<{plik:string, tytul:string, dlugoscS:number}>, ostatniNick?: string}} [opcje]
     */
    constructor({ piesni = [], ostatniNick = '' } = {}) {
        this.piesni = Array.isArray(piesni) ? piesni : [];
        this.ekran = 'polana';
        this.tryb = null;
        this.piesn = 0;
        this.czas = 90;
        this.zew = false;
        this.krag = false;
        this.nicki = Array.from({ length: MIN_KRAG }, () => '');
        this.nick = typeof ostatniNick === 'string' ? ciety(ostatniNick) : '';
        this.zajety = false;    // trwa ładowanie kamery - UI blokuje przycisk startu
        this.kronika = null;
    }

    /**
     * Czy gra reaguje na ruch gracza (pieczęcie, techniki, ich dźwięki). Pod menu - nie:
     * gracz stoi przed kamerą, pisze nick, a hałas Gromów za półprzezroczystym panelem
     * byłby zaskoczeniem. Kronika to nadal gra (efekty po rundzie są jej częścią).
     */
    get graAktywna() { return this.ekran === 'gra' || this.ekran === 'kronika'; }

    /** Manifest pieśni wczytuje się asynchronicznie - Obrzęd odblokowuje się po fakcie. */
    ustawPiesni(lista) {
        this.piesni = Array.isArray(lista) ? lista : [];
        if (this.piesn >= this.piesni.length) this.piesn = 0;
    }

    dostepne(kamien) {
        if (!KAMIENIE.includes(kamien)) return false;
        return kamien !== 'obrzed' || this.piesni.length > 0;
    }

    podpowiedz(kamien) {
        return kamien === 'obrzed' && !this.dostepne('obrzed') ? 'Duchy jeszcze nie przyniosły pieśni' : '';
    }

    wybierz(kamien) {
        if (this.zajety || !this.dostepne(kamien)) return false;
        if (kamien === 'ksiega') { this.ekran = 'ksiega'; return true; }
        this.tryb = kamien;
        this.ekran = 'konfig';
        return true;
    }

    ustaw(pole, wartosc) {
        switch (pole) {
            case 'piesn':
                if (!Number.isInteger(wartosc) || wartosc < 0 || wartosc >= this.piesni.length) return false;
                this.piesn = wartosc; return true;
            case 'czas':
                if (!PROBA_DLUGOSCI.includes(wartosc)) return false;
                this.czas = wartosc; return true;
            case 'zew': this.zew = !!wartosc; return true;
            case 'krag': this.krag = !!wartosc; return true;
            case 'nick':
                if (typeof wartosc !== 'string') return false;
                this.nick = ciety(wartosc); return true;
            default: return false;
        }
    }

    ustawNick(i, tekst) {
        if (!Number.isInteger(i) || i < 0 || i >= this.nicki.length || typeof tekst !== 'string') return false;
        this.nicki[i] = ciety(tekst);
        return true;
    }

    dodajGracza() {
        if (this.nicki.length >= MAX_KRAG) return false;
        this.nicki.push('');
        return true;
    }

    usunGracza(i) {
        if (!Number.isInteger(i) || i < 0 || i >= this.nicki.length || this.nicki.length <= MIN_KRAG) return false;
        this.nicki.splice(i, 1);
        return true;
    }

    /** @returns {string[]} ciepłe zaproszenia; pusta lista = konfiguracja poprawna */
    bledy() {
        if (!this.tryb || this.tryb === 'swobodny') return [];
        const b = [];
        if (this.tryb === 'obrzed' && !this.dostepne('obrzed')) b.push(this.podpowiedz('obrzed'));
        if (this.krag) {
            if (this.nicki.some(n => !przytnij(n))) b.push('Każdy tancerz potrzebuje imienia');
        } else if (!przytnij(this.nick)) {
            b.push('Powiedz, jak Cię zwą — wpisz imię albo rzuć kośćmi 🎲');
        }
        return b;
    }

    /** @returns {{tryb,dlugoscS,piesn,zew,krag,nick}|null} ten sam kształt co parsujKonfiguracje (+ nick) */
    konfiguracja() {
        if (!this.tryb || this.bledy().length) return null;
        const swobodny = this.tryb === 'swobodny';
        return {
            tryb: this.tryb,
            dlugoscS: this.tryb === 'proba' ? this.czas : this.tryb === 'obrzed' ? PIESN_AWARYJNA_S : 0,
            piesn: this.tryb === 'obrzed' ? this.piesn : 0,
            zew: swobodny ? false : this.zew,
            krag: swobodny || !this.krag ? null : this.nicki.map(przytnij),
            nick: swobodny || this.krag ? null : przytnij(this.nick)
        };
    }

    /** Krok wstecz. Podczas ładowania kamery menu stoi w miejscu. */
    wstecz() {
        if (this.zajety || this.ekran === 'polana') return false;
        this.doPolany();
        return true;
    }

    doPolany() {
        this.ekran = 'polana';
        this.tryb = null;
        this.kronika = null;
    }

    naGre() {
        this.ekran = 'gra';
        this.kronika = null;
    }

    naKronike(kronika) {
        this.ekran = 'kronika';
        this.kronika = kronika ?? null;
    }

    /**
     * Skrót dewelopera: wypełnia konfigurację z adresu (?tryb=proba&czas=60&zew=1&krag=Ola,Bartek).
     * @returns {boolean} true = otwarto konfigurację
     */
    zUrl(konf) {
        if (!konf || (konf.tryb !== 'proba' && konf.tryb !== 'obrzed')) return false;
        if (!this.wybierz(konf.tryb)) return false;
        if (konf.tryb === 'obrzed') this.ustaw('piesn', konf.piesn);
        else this.ustaw('czas', konf.dlugoscS);
        this.zew = !!konf.zew;
        if (Array.isArray(konf.krag) && konf.krag.length >= MIN_KRAG) {
            this.krag = true;
            this.nicki = konf.krag.slice(0, MAX_KRAG).map(ciety);
        }
        return true;
    }
}
