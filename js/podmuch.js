/**
 * Podmuch (Aard) - technika JEDNORAZOWA: uzbrojona kombosem, wyzwalana
 * machnięciem otwartej dłoni. Kierunek fali czyta js/fala.js z tego,
 * co zwraca update() - ten plik NIE RYSUJE.
 *
 * Ten sam podział co przy płonącym palcu (plonacyPalec.js / ogien.js), ale
 * prostszy: brak stanu odpowiadającego PŁONIE - podmuch nie trwa, odpala
 * się i wraca do BEZCZYNNY w tej samej klatce.
 *
 * KIERUNEK: oś z normalnej dłoni (worldLandmarks, znak niejednoznaczny),
 * zwrot z wektora machnięcia (landmarks + zmiana skali dłoni na oś głębi).
 * Zobacz docs/superpowers/specs/2026-08-11-szczur-i-podmuch-design.md §3.
 */
import { pelnaDlon, wzorPalcow, skalaDloni, normalnaDloni } from './znaki/dlon.js';

// ZGADNIĘTE - potwierdzić z nakładki (klawisz D).
const PROG_OTWARCIA = 0.55;      // średnie wyprostowanie 4 palców bez kciuka
const PROG_PREDKOSCI = 4.0;      // skale dłoni na sekundę
const KOSZT_PODMUCHU = 0.25;     // ułamek paska mocy za jedno pchnięcie

export class Podmuch {
    constructor() {
        this.stan = 'BEZCZYNNY';
        this._poprzednie = {};   // stronność -> { x, y, skala } z poprzedniej klatki
        // Diagnostyka do nakładki - NAJLEPSZY kandydat w tej klatce, nawet
        // gdy nic się nie odpaliło. Bez tego nie da się wystroić progów.
        this.diagnostyka = { predkosc: 0, otwarcie: 0, kierunek: null };
    }

    /** Kombos złożony - technika uzbrojona. Bez licznika ważności. */
    uzbrój() {
        if (this.stan === 'BEZCZYNNY') this.stan = 'UZBROJONY';
    }

    /**
     * @param {object} frame
     * @param {number} moc  0..1
     * @param {number} dt
     * @returns {{zaczep:{x,y}, kierunek:{x,y,z}, sila:number, pobor:number}|null}
     */
    update(frame, moc, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const kandydaci = this._kandydaci(frame, krok);
        // Śledzenie idzie ZAWSZE, niezależnie od stanu - inaczej pierwsza
        // klatka po uzbrojeniu byłaby "martwa" (brak poprzedniej pozycji =
        // brak prędkości = nigdy nie odpali w tej samej klatce co uzbrojenie).
        this._zapamietaj(frame);

        let najlepszy = null;
        for (const k of kandydaci) if (!najlepszy || k.waga > najlepszy.waga) najlepszy = k;
        this.diagnostyka = najlepszy
            ? { predkosc: najlepszy.predkosc, otwarcie: najlepszy.otwarcie, kierunek: najlepszy.kierunek }
            : { predkosc: 0, otwarcie: 0, kierunek: null };

        if (this.stan !== 'UZBROJONY') return null;
        if (!najlepszy) return null;
        if (najlepszy.predkosc < PROG_PREDKOSCI) return null;
        if (najlepszy.otwarcie < PROG_OTWARCIA) return null;
        if (!najlepszy.kierunek) return null;

        this.stan = 'BEZCZYNNY';
        const mocBezpieczna = Number.isFinite(moc) ? Math.max(0, moc) : 0;
        const pobor = Math.min(mocBezpieczna, KOSZT_PODMUCHU);
        return {
            zaczep: najlepszy.zaczep,
            kierunek: najlepszy.kierunek,
            sila: pobor / KOSZT_PODMUCHU,
            pobor
        };
    }

    /**
     * Kandydaci na machnięcie: dla każdej widocznej dłoni liczymy otwartość,
     * prędkość nadgarstka w skalach dłoni na sekundę, i kierunek 3D.
     *
     * `waga` (otwartość x prędkość) decyduje, KTÓRA dłoń wygrywa, gdy obie
     * spełniają warunki naraz - ta sama zasada co przy wyborze pieczęci.
     */
    _kandydaci(frame, dt) {
        const out = [];
        for (const d of (frame.hands ?? [])) {
            if (!pelnaDlon(d.landmarks)) continue;
            const lm = d.landmarks;
            const reka = d.handedness ?? 'brak';
            const poprz = this._poprzednie[reka];

            const w = wzorPalcow(lm);
            const otwarcie = (w[1] + w[2] + w[3] + w[4]) / 4;

            const skala = skalaDloni(lm);
            // Nasada środkowego palca - stabilniejszy zaczep niż opuszek,
            // ten sam punkt, którego używa efekty.js:27 do środka dłoni.
            const zaczep = { x: lm[9].x, y: lm[9].y };

            let predkosc = 0, ruch = null;
            if (poprz && dt > 0) {
                const dx = zaczep.x - poprz.x, dy = zaczep.y - poprz.y;
                const dSkala = skala - poprz.skala;
                predkosc = Math.hypot(dx, dy) / skala / dt;
                // Głębia z ZMIANY SKALI DŁONI: rosnąca dłoń = ruch ku
                // kamerze. Wektor NIE jest metrycznie dokładny - służy
                // wyłącznie do ustalenia ZNAKU osi normalnej, więc
                // przybliżenie wystarcza (patrz normalnaDloni w dlon.js).
                ruch = { x: dx, y: dy, z: dSkala };
            }

            const os = normalnaDloni(d.worldLandmarks);
            let kierunek = null;
            if (os && ruch) {
                const zgodnosc = os.x * ruch.x + os.y * ruch.y + os.z * ruch.z;
                kierunek = zgodnosc >= 0 ? os : { x: -os.x, y: -os.y, z: -os.z };
            }

            out.push({ reka, predkosc, otwarcie, kierunek, zaczep, waga: otwarcie * predkosc });
        }
        return out;
    }

    _zapamietaj(frame) {
        const nowe = {};
        for (const d of (frame.hands ?? [])) {
            if (!pelnaDlon(d.landmarks)) continue;
            nowe[d.handedness ?? 'brak'] = {
                x: d.landmarks[9].x, y: d.landmarks[9].y, skala: skalaDloni(d.landmarks)
            };
        }
        this._poprzednie = nowe;
    }
}
