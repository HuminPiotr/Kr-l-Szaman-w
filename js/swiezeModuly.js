/**
 * Równy start rundy - nowe instancje WSZYSTKICH modułów ze stanem rundy.
 *
 * W Kręgu następny gracz nie może odziedziczyć cudzej uzbrojonej techniki
 * (Okadzenie ma zegar 4 min!), chmury dymu ani paska mocy. Większość modułów
 * nie ma reset(), a ukryty stan (cząstki, zegary, uzbrojenie) łatwo pominąć -
 * dlatego fabryka zwraca NOWE instancje zamiast resetować pole po polu.
 * Cache sprite'ów (iskry, runy, dym) są leniwe i odbudowują się przy pierwszym
 * użyciu, tak jak w świeżej grze.
 *
 * ZOSTAJĄ (stan nie należy do rundy): trackery, aura (zależna od płótna),
 * audioEngine, debugHud, znaki (rejestr bezstanowy), wynikHud, Histereza pelnaMoc.
 * Punktacja ma własne reset().
 *
 * tools/test-swieze-moduly.mjs pilnuje bezczynności każdej instancji ORAZ tego,
 * że każdy `let x = new Klasa()` z main.js jest tu albo jawnie poza rundą.
 */
import { MotionMeter } from './motionMeter.js';
import { Plynnosc } from './plynnosc.js';
import { SkladaniePieczeci } from './pieczecie.js';
import { KomboSilnik } from './kombosy.js';
import { Efekty } from './efekty.js';
import { Runy } from './runa.js';
import { PasekSekwencji } from './sekwencja.js';
import { Ogien } from './ogien.js';
import { PlonacyPalec } from './plonacyPalec.js';
import { Dmuchanie } from './dmuchanie.js';
import { Dym } from './dym.js';
import { Podmuch } from './podmuch.js';
import { Fala } from './fala.js';
import { Tecza } from './tecza.js';
import { Iskry } from './iskry.js';
import { Zaplon } from './zaplon.js';
import { Ekran } from './ekran.js';
import { Piorun } from './piorun.js';
import { Kolowrot } from './kolowrot.js';
import { KamiennaTarcza } from './kamiennaTarcza.js';
import { MglaMokoszy } from './mglaMokoszy.js';
import { KregiMokoszy } from './kregiMokoszy.js';
import { LukPeruna } from './lukPeruna.js';
import { Kurzawa } from './kurzawa.js';
import { Bania } from './bania.js';
import { Grzmot } from './grzmot.js';
import { Zawierucha } from './zawierucha.js';
import { BledneOgniki } from './bledneOgniki.js';
import { ReakcjeTechnik } from './reakcjeTechnik.js';

// Nazwy kluczy = nazwy zmiennych w main.js (destrukturyzacja po przypisaniu).
export const KLUCZE_MODULOW = [
    'motionMeter', 'plynnoscMiara', 'skladanie', 'kombosy', 'efekty', 'runy', 'sekwencja',
    'ogien', 'plonacyPalec', 'dmuchanie', 'dym', 'podmuch', 'fala', 'tecza', 'iskry',
    'zaplon', 'ekran', 'piorun', 'kolowrot', 'kamiennaTarcza', 'kurzawa', 'lukPeruna', 'kregiMokoszy', 'mglaMokoszy', 'bania', 'grzmot', 'zawierucha', 'bledneOgniki', 'reakcjeTechnik'
];

/**
 * @param {{slotySekwencji?:HTMLElement|null, nazwaSekwencji?:HTMLElement|null}} [dom]
 *   elementy paska sekwencji - nowa instancja zaczyna na PUSTYM DOM, bez slotów poprzednika
 */
export function swiezeModuly({ slotySekwencji = null, nazwaSekwencji = null } = {}) {
    slotySekwencji?.replaceChildren?.();
    if (nazwaSekwencji) nazwaSekwencji.textContent = '';
    return {
        motionMeter: new MotionMeter(),
        plynnoscMiara: new Plynnosc(),
        skladanie: new SkladaniePieczeci(),
        kombosy: new KomboSilnik(),
        efekty: new Efekty(),
        runy: new Runy(),
        sekwencja: new PasekSekwencji(slotySekwencji, nazwaSekwencji),
        ogien: new Ogien(),
        plonacyPalec: new PlonacyPalec(),
        dmuchanie: new Dmuchanie(),
        dym: new Dym(),
        podmuch: new Podmuch(),
        fala: new Fala(),
        tecza: new Tecza(),
        iskry: new Iskry(),
        zaplon: new Zaplon(),
        ekran: new Ekran(),
        piorun: new Piorun(),
        kolowrot: new Kolowrot(),
        kamiennaTarcza: new KamiennaTarcza(),
        kurzawa: new Kurzawa(),
        lukPeruna: new LukPeruna(),
        kregiMokoszy: new KregiMokoszy(),
        mglaMokoszy: new MglaMokoszy(),
        bania: new Bania(),
        grzmot: new Grzmot(),
        zawierucha: new Zawierucha(),
        bledneOgniki: new BledneOgniki(),
        reakcjeTechnik: new ReakcjeTechnik()
    };
}
