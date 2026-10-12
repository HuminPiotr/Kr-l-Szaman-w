/**
 * Emblematy Zwoju Technik - ręcznie rysowane SVG (viewBox 64×64, kreska
 * currentColor, wypełnienie z CSS: brak) i jednozdaniowe legendy.
 * Spec: docs/superpowers/specs/2026-10-12-pamiec-plemienia-design.md
 *
 * CZYSTE DANE, BEZ DOM. Łańcuchy są STATYCZNE i z repo - nigdy dane gracza -
 * dlatego wolno je wstawić jako znaczniki SVG (js/emblematDom.js).
 *
 * ZAKAZ §7 (GEMINI.md): żadnych obrotowo symetrycznych figur z zagiętymi lub
 * spiralnymi ramionami - swarzyca i kołowrót zostały zawłaszczone przez skrajną
 * prawicę. Dlatego Kołowrót to WRZECIONO prządki, a wiry (Kurzawa i węzły z nią)
 * to LEJ/trąba, nigdy koło słoneczne. Każdy nowy rysunek - przegląd w
 * tools/emblematy.html przed commitem.
 *
 * WĘZŁY NIE MAJĄ WŁASNYCH RYSUNKÓW: emblemat węzła to dwa emblematy technik
 * splecione nicią (svgEmblematu('wezel', ...)).
 */
import { glif } from './glify.js';
import { KAMIENIE } from './osiagniecia.js';

const kropla = (x, y) => `<path d="M${x} ${y}a5 5 0 0 1-5-5c0-4 5-9 5-9s5 5 5 9a5 5 0 0 1-5 5z"/>`;

export const EMBLEMATY = {
    tecza: {
        svg: '<path d="M8 46a24 24 0 0 1 48 0"/><path d="M15 46a17 17 0 0 1 34 0"/><path d="M22 46a10 10 0 0 1 20 0"/><path d="M4 52h56"/>',
        legenda: 'Mokosz rozpina wstęgę między ogniem, wodą a wiatrem.'
    },
    gromWOgniu: {
        svg: '<path d="M32 60c-12 0-19-9-17-20 1-8 8-12 9-22 6 5 8 11 8 16 3-3 5-8 4-13 9 7 14 15 13 24-1 9-7 15-17 15z"/><path d="M35 30l-7 13h7l-5 11"/>',
        legenda: 'Iskra Peruna wpada w kuźnię Swaroga — palec zapłonie.'
    },
    aard: {
        svg: '<path d="M6 20h32a7 7 0 1 0-7-7"/><path d="M6 32h44a7 7 0 1 1-7 7"/><path d="M6 44h26a6 6 0 1 0-6-6"/>',
        legenda: 'Dwa tchnienia Striboga złożone w jeden podmuch.'
    },
    gromWZiemie: {
        svg: '<path d="M38 4L26 26h11l-9 20"/><path d="M4 46h56"/><path d="M28 46l-7 12M28 46l3 13M28 46l13 7"/>',
        legenda: 'Perun bije w rozgrzaną skorupę Welesa — odwieczny spór.'
    },
    kolowrot: {
        // WRZECIONO prządki losu, nie koło (§7).
        svg: '<path d="M32 4v56"/><path d="M32 10c6 6 7 16 0 26c-7-10-6-20 0-26z"/><ellipse cx="32" cy="46" rx="13" ry="4"/><path d="M38 20c8 2 14 8 18 16"/>',
        legenda: 'Prządka losu toczy wrzeciono, gdy burza ucichnie.'
    },
    dym: {
        svg: '<path d="M16 50h32l-5 9H21z"/><path d="M27 46c-7-6 7-10 0-17s7-10 0-17"/><path d="M38 46c-6-5 6-9 0-15s5-8 2-12"/>',
        legenda: 'Żar niesiony wiatrem — dym, który można podpalić.'
    },
    kamiennaTarcza: {
        svg: '<circle cx="32" cy="20" r="5"/><path d="M32 25v20M23 33h18M32 45l-6 12M32 45l6 12"/><path d="M6 30l5-5 5 2-1 6-7 1z"/><path d="M48 24l6-2 4 5-4 4-5-2z"/><path d="M10 50l6-3 4 4-4 4-5-1z"/><path d="M45 48l6-2 3 5-5 3-4-2z"/>',
        legenda: 'Trzykroć wezwany Weles otacza tancerza kamieniem.'
    },
    kurzawa: {
        // LEJ pyłu, nie spirala (§7).
        svg: '<path d="M8 10c4 14 14 30 24 48"/><path d="M56 10c-4 14-14 30-24 48"/><path d="M14 18h34M18 28h24M22 38h16M26 47h9"/><circle cx="10" cy="44" r="1.5"/><circle cx="54" cy="40" r="1.5"/><circle cx="50" cy="52" r="1.5"/>',
        legenda: 'Wiatr porywa ziemię w lej pyłu wokół tancerza.'
    },
    lukPeruna: {
        svg: '<path d="M12 56V28"/><path d="M52 56V28"/><path d="M12 30l7-6 5 8 6-9 5 9 6-8 5 7 6-5"/><path d="M8 22l-3-3M56 22l3-3"/>',
        legenda: 'Woda przewodzi piorun — łuk skacze z dłoni do dłoni.'
    },
    kregiMokoszy: {
        svg: '<circle cx="32" cy="12" r="4"/><path d="M32 16v28"/><ellipse cx="32" cy="46" rx="8" ry="3"/><ellipse cx="32" cy="46" rx="17" ry="6"/><ellipse cx="32" cy="46" rx="27" ry="10"/>',
        legenda: 'Mać Ziemia Wilgotna — stoisz po pas w wodzie.'
    },
    mglaMokoszy: {
        svg: '<path d="M26 26a6 6 0 0 1 12 0"/><path d="M4 28q6-6 12 0t12 0 12 0 12 0 12 0"/><path d="M4 40q6-6 12 0t12 0 12 0 12 0 12 0"/><path d="M10 52q6-6 12 0t12 0 12 0 12 0"/>',
        legenda: 'Wiatr niesie wilgoć — tancerz wynurza się z mgły.'
    },
    bania: {
        svg: '<path d="M16 60c0-11 7-17 16-17s16 6 16 17"/><circle cx="32" cy="34" r="7"/><path d="M25 22c-4-4 4-7 0-12M32 22c-4-4 4-7 0-12M39 22c-4-4 4-7 0-12"/>',
        legenda: 'Woda na rozgrzane ciało — bucha para jak w bani.'
    },
    grzmot: {
        svg: '<path d="M35 8l-9 22h10l-7 24"/><path d="M18 20a16 16 0 0 0 0 24"/><path d="M46 20a16 16 0 0 1 0 24"/><path d="M10 14a24 24 0 0 0 0 36"/><path d="M54 14a24 24 0 0 1 0 36"/>',
        legenda: 'Błyskawica rozdziera powietrze — fala bije z piersi.'
    },
    zawierucha: {
        svg: '<path d="M4 20c14 5 32 3 50-6"/><path d="M4 34c16 5 36 2 56-8"/><path d="M8 48c14 4 28 1 42-7"/><path d="M52 44l4-2 2 4-4 2z"/><circle cx="58" cy="30" r="1.5"/><circle cx="46" cy="54" r="1.5"/>',
        legenda: 'Ziemia oddaje pył wiatrowi — poryw przez cały kadr.'
    },
    bledneOgniki: {
        svg: `${kropla(16, 38)}${kropla(32, 26)}${kropla(48, 40)}<path d="M4 56q28-14 56 0"/>`,
        legenda: 'Weles wypuszcza duszyczki, Swaróg je rozpala.'
    },
    dodola: {
        svg: '<path d="M16 32a8 8 0 0 1 1-16 12 12 0 0 1 22-4 9 9 0 0 1 9 20z"/><path d="M20 40l-3 8M30 40l-3 8M40 40l-3 8M25 52l-3 8M35 52l-3 8"/>',
        legenda: 'Woda w misie, wiatr niesie ją w chmury — pada deszcz.'
    }
};

export const WEZLY_EMBLEMATY = {
    pozoga: { skladowe: ['dym', 'gromWOgniu'], legenda: 'Ogień trafia w dym — chmura wybucha kłąb po kłębie.' },
    rozwianie: { skladowe: ['dym', 'aard'], legenda: 'Podmuch rozpędza dym na cztery strony.' },
    wirDymu: { skladowe: ['dym', 'kurzawa'], legenda: 'Kurzawa wciąga dym w swoje pasy.' },
    ognistyWir: { skladowe: ['kurzawa', 'gromWOgniu'], legenda: 'Płonąca trąba — ogień w lej Kurzawy.' },
    przewodzenie: { skladowe: ['lukPeruna', 'kregiMokoszy'], legenda: 'Łuk Peruna biegnie po kręgach wody.' },
    burzaWMgle: { skladowe: ['mglaMokoszy', 'lukPeruna'], legenda: 'Mgła błyska od wyładowań.' },
    rozdarcie: { skladowe: ['grzmot', 'mglaMokoszy'], legenda: 'Grzmot rozdziera mgłę i pył.' },
    zawianie: { skladowe: ['zawierucha', 'mglaMokoszy'], legenda: 'Zawierucha znosi mgłę i pył w swoją stronę.' },
    latarnie: { skladowe: ['bledneOgniki', 'mglaMokoszy'], legenda: 'Ogniki świecą we mgle jak latarnie.' },
    wirOgnikow: { skladowe: ['kurzawa', 'bledneOgniki'], legenda: 'Kurzawa porywa ogniki na orbitę.' },
    teczaPoDeszczu: { skladowe: ['dodola', 'tecza'], legenda: 'Po deszczu Dodoli wschodzi Wstęga Mokoszy.' },
    burzaWDeszczu: { skladowe: ['dodola', 'lukPeruna'], legenda: 'Krople zapalają się światłem pioruna.' },
    syk: { skladowe: ['dodola', 'gromWOgniu'], legenda: 'Deszcz gasi płonący palec z sykiem pary.' }
};

const KAMIEN = '<path class="kamien-obrys" d="M14 50c-6-8-4-26 6-34 8-6 20-6 28 2 8 8 9 24 2 32-8 8-28 8-36 0z"/>';
const PEKNIECIE = '<path d="M30 12l-4 12 7 6-6 10 5 12"/>';
const runa = (znak) => (znak ? `<text x="32" y="34" text-anchor="middle" dominant-baseline="central" class="emblemat-runa">${znak}</text>` : '');

/** Wnętrze <svg viewBox="0 0 64 64"> dla odkrycia; '' dla nieznanego. */
export function svgEmblematu(rodzaj, id) {
    if (rodzaj === 'technika') return Object.hasOwn(EMBLEMATY, id) ? EMBLEMATY[id].svg : '';
    if (rodzaj === 'wezel') {
        if (!Object.hasOwn(WEZLY_EMBLEMATY, id)) return '';
        const [a, b] = WEZLY_EMBLEMATY[id].skladowe;
        return `<g class="skladowa" transform="translate(1 1) scale(.56)">${EMBLEMATY[a].svg}</g>`
            + `<g class="skladowa" transform="translate(27 27) scale(.56)">${EMBLEMATY[b].svg}</g>`
            + '<path class="nic" d="M6 58C22 46 42 18 58 6"/>';
    }
    if (rodzaj === 'pieczec') return runa(glif(id));
    if (rodzaj === 'kamien') {
        const k = KAMIENIE.find(x => x.id === id);
        return k ? KAMIEN + runa(k.runa) : '';
    }
    if (rodzaj === 'sekret') return KAMIEN + PEKNIECIE;
    return '';
}
