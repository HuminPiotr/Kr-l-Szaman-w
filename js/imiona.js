/**
 * Losowe szamańskie imię - przycisk 🎲 przy polu nicku ("Osmalony Borsuk").
 *
 * Przymiotnik zgadza się rodzajowo z rzeczownikiem (dwie osobne listy: męska i żeńska),
 * a KAŻDA kombinacja mieści się w limicie nicku (MAX_NICK = 16 znaków) - test wylicza
 * wszystkie, więc dopisanie za długiego słowa wywala go od razu.
 */
export const IMIONA = {
    meskie: {
        przymiotniki: ['Osmalony', 'Zadymiony', 'Płomienny', 'Leśny', 'Mglisty', 'Gromowy'],
        rzeczowniki: ['Borsuk', 'Kruk', 'Wilk', 'Żubr', 'Jeleń', 'Dąb']
    },
    zenskie: {
        przymiotniki: ['Osmalona', 'Zadymiona', 'Płomienna', 'Leśna', 'Mglista', 'Gromowa'],
        rzeczowniki: ['Sowa', 'Wrona', 'Łania', 'Iskra', 'Mgła', 'Brzoza']
    }
};

const GRUPY = [IMIONA.meskie, IMIONA.zenskie];

/** Wszystkie możliwe imiona - do testu długości i unikalności. */
export function wszystkieImiona() {
    const out = [];
    for (const g of GRUPY) for (const p of g.przymiotniki) for (const r of g.rzeczowniki) out.push(`${p} ${r}`);
    return out;
}

// Losowa spoza 0..1 (NaN, ujemna, tekst) nie może wyrzucić poza listę.
const jakoUlamek = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(0.999999, v)) : 0);
const wybierz = (lista, losowa) => lista[Math.floor(jakoUlamek(losowa()) * lista.length)];

/** @param {()=>number} [losowa]  wstrzykiwana w testach */
export function losoweImie(losowa = Math.random) {
    const g = wybierz(GRUPY, losowa);
    return `${wybierz(g.przymiotniki, losowa)} ${wybierz(g.rzeczowniki, losowa)}`;
}
