/**
 * PLIK GENEROWANY - nie edytuj ręcznie.
 *
 *   node tools/progi.mjs --zapisz
 *
 * Każda liczba pochodzi z nagrania żywego ciała w tools/probki/, nie
 * z wyobraźni. Reguła wyprowadzania i jej uzasadnienie: tools/progi.mjs.
 * Strojenie = zmiana reguły albo dogranie próbki, NIGDY ręczna poprawka
 * liczby tutaj - poprawiona ręcznie liczba jest znowu ZGADNIĘTA.
 *
 * Wygenerowano: 2026-09-03T19:50:16.582Z
 * Powtórzenia w materiale: 22
 */
export const PROGI = {
    ogien: {
        WYSOKOSC_DOL_PELNY: -0.542,  // ogien#1, ogien#2, ogien#3 (probki-2026-09-03-18-04-18.json), p05, n=263
        WYSOKOSC_GORA_PELNY: -0.351,  // ogien#1, ogien#2, ogien#3 (probki-2026-09-03-18-04-18.json), p95, n=263
        WYSOKOSC_DOL_ZERO: -0.895,  // woda#1, woda#2, woda#3 (probki-2026-09-03-18-04-18.json), p50, n=286
        WYSOKOSC_GORA_ZERO: 0.234,  // taniec#1 (probki-2026-09-03-17-59-00.json, probki-2026-09-03-18-04-18.json), p90, n=1500
    },
    ziemia: {
        STYK_PELNY: 0.941,  // ziemia#1, ziemia#2, ziemia#3 (probki-2026-09-03-18-04-18.json), p75, n=281
        STYK_ZERO: 1.416,  // taniec#1 (probki-2026-09-03-17-59-00.json, probki-2026-09-03-18-04-18.json), p10, n=1500
    },
    powietrze: {
        STYK_PELNY: 0.770,  // powietrze#1, powietrze#2, powietrze#3 (probki-2026-09-03-18-04-18.json), p75, n=294
        STYK_ZERO: 0.872,  // taniec#1 (probki-2026-09-03-17-59-00.json, probki-2026-09-03-18-04-18.json), p10, n=1500
        WYSOKOSC_PELNY: -0.116,  // powietrze#1, powietrze#2, powietrze#3 (probki-2026-09-03-18-04-18.json), p25, n=294
        WYSOKOSC_ZERO: -0.227,  // taniec#1 (probki-2026-09-03-17-59-00.json, probki-2026-09-03-18-04-18.json), p90, n=1500
    },
    woda: {
        GLEBOKOSC_PELNY: 0.858,  // woda#1, woda#2, woda#3 (probki-2026-09-03-18-04-18.json), p25, n=286  ⚠ OBSZARY ZACHODZĄ - PELNY i ZERO NIE rozdzielają pozy od tańca (patrz task-6-report.md). NIE WPINAĆ bez zmiany POZY.
        GLEBOKOSC_ZERO: 0.966,  // taniec warunkowy (spełnia miska i palceWDol >= PELNY), p90, n=13  ⚠ OBSZARY ZACHODZĄ - PELNY i ZERO NIE rozdzielają pozy od tańca (patrz task-6-report.md). NIE WPINAĆ bez zmiany POZY.
        MISKA_PELNY: 0.607,  // woda#1, woda#2, woda#3 (probki-2026-09-03-18-04-18.json), p25, n=286
        MISKA_ZERO: 0.440,  // taniec warunkowy (spełnia glebokosc i palceWDol >= PELNY), p90, n=55  ⚠ ZA MAŁO KLATEK TAŃCA (po warunkowaniu) - próg ZERO to szum, dograj krok 8
        PALCEWDOL_PELNY: 1.000,  // woda#1, woda#2, woda#3 (probki-2026-09-03-18-04-18.json), p25, n=286  ⚠ OBSZARY ZACHODZĄ - PELNY i ZERO NIE rozdzielają pozy od tańca (patrz task-6-report.md). NIE WPINAĆ bez zmiany POZY.
        PALCEWDOL_ZERO: 1.000,  // taniec warunkowy (spełnia glebokosc i miska >= PELNY), p90, n=6  ⚠ OBSZARY ZACHODZĄ - PELNY i ZERO NIE rozdzielają pozy od tańca (patrz task-6-report.md). NIE WPINAĆ bez zmiany POZY.
    },
    blyskawica: {
        WYSNADG_PELNY: 1.098,  // blyskawica#1, blyskawica#2, blyskawica#3 (probki-2026-09-03-18-41-44.json), p25, n=294
        WYSNADG_ZERO: -0.227,  // taniec#1 (probki-2026-09-03-17-59-00.json, probki-2026-09-03-18-04-18.json), p90, n=1500
        WYSLOK_PELNY: 0.533,  // blyskawica#1, blyskawica#2, blyskawica#3 (probki-2026-09-03-18-41-44.json), p25, n=294
        WYSLOK_ZERO: -0.438,  // taniec#1 (probki-2026-09-03-17-59-00.json, probki-2026-09-03-18-04-18.json), p90, n=1500
    },
};
