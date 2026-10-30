/**
 * Skąd gra zna rytm w tej klatce (spec 2026-10-30-sluch-design.md). Czysta logika.
 *
 * Kolejność - od najdokładniejszego:
 *  1. 'plik'     - pieśń z rytmem wyliczonym z pliku (manifest, własny plik z dysku),
 *  2. 'nauczona' - pieśń z YouTube, której rytm gra już poznała słuchem (czas z odtwarzacza),
 *  3. 'sluch'    - słuch na żywo z mikrofonu, gdy pewny (każdy tryb, dowolna muzyka w pokoju).
 * Inaczej null: brak rytmu, trans łagodnie gaśnie (nic nie mówi "źle").
 *
 * Każde źródło daje ten sam interfejs siatki (js/rytm/siatka.js): faza(tS), nastepneUderzenieS, okresS
 * - reszta transu (zgodność, aura, efekty, kolejka taktu) nie wie, skąd rytm przyszedł.
 *
 * @param {object} z
 * @param {{siatka:object, czasS:number|null}|null} [z.plik]
 * @param {{siatka:object, czasS:number|null}|null} [z.nauczona]
 * @param {{siatka:object|null, czasS:number|null, pewny:boolean}|null} [z.sluch]
 * @returns {{siatka:object, czasS:number, zrodlo:'plik'|'nauczona'|'sluch'} | null}
 */
export function wybierzRytm({ plik = null, nauczona = null, sluch = null } = {}) {
    const gotowe = (r) => !!r?.siatka && Number.isFinite(r.czasS);
    if (gotowe(plik)) return { siatka: plik.siatka, czasS: plik.czasS, zrodlo: 'plik' };
    if (gotowe(nauczona)) return { siatka: nauczona.siatka, czasS: nauczona.czasS, zrodlo: 'nauczona' };
    if (gotowe(sluch) && sluch.pewny) return { siatka: sluch.siatka, czasS: sluch.czasS, zrodlo: 'sluch' };
    return null;
}
