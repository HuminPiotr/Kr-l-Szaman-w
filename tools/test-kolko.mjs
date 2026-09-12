/**
 * Kółko z palców (warunek Okadzenia v8) - js/znaki/dlon.js: kolkoPalcow().
 *
 *   node tools/test-kolko.mjs
 *
 * DŁOŃ SYNTETYCZNA Z tools/_dlon-syntetyczna.mjs NIE NADAJE SIĘ do tego
 * testu i to jest ustalenie, nie wymówka: jej kciuk jest prostym łańcuchem
 * równoległym do palców, więc przy dłoni PŁASKIEJ opuszek kciuka leży 0.32
 * skali od wskazującego (na żywej dłoni ~1.0) i wychodziło z tego "kółko"
 * tam, gdzie go nie ma. Dlatego pętlę budujemy tu WPROST: opuszki złączone
 * w jednym punkcie, a stawy rozłożone na okręgu o zadanym promieniu. Test
 * sprawdza wtedy dokładnie to, co funkcja obiecuje - że wynik rośnie
 * z wielkością pętli i nie zależy od odległości od kamery.
 */
import { kolkoPalcow, PALCE, NADGARSTEK } from '../js/znaki/dlon.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

/**
 * Dłoń z pętlą kciuk+`palec` o promieniu `r` (w skalach dłoni, czyli
 * w jednostce nadgarstek→nasada środkowego = `skala`).
 */
function dlonZPetla({ palec = 'wskazujacy', r = 0.2, skala = 0.1, ox = 0.5, oy = 0.5,
                       rozchyl = 0 } = {}) {
    const lm = Array.from({ length: 21 }, () => ({ x: ox, y: oy, z: 0 }));
    lm[NADGARSTEK] = { x: ox, y: oy, z: 0 };
    lm[9] = { x: ox, y: oy - skala, z: 0 };                 // nasada środkowego (skala dłoni)
    // Pozostałe nasady rozstawione w poprzek dłoni.
    lm[5] = { x: ox - 0.3 * skala, y: oy - 0.95 * skala, z: 0 };
    lm[13] = { x: ox + 0.3 * skala, y: oy - 0.95 * skala, z: 0 };
    lm[17] = { x: ox + 0.6 * skala, y: oy - 0.85 * skala, z: 0 };
    lm[1] = { x: ox - 0.5 * skala, y: oy - 0.2 * skala, z: 0 };
    lm[2] = { x: ox - 0.7 * skala, y: oy - 0.5 * skala, z: 0 };

    // Pętla: styk opuszek na górze, stawy rozłożone po okręgu o promieniu r.
    const R = r * skala;
    const srodek = { x: ox - 0.1 * skala, y: oy - (0.95 * skala + R) };
    const styk = { x: srodek.x, y: srodek.y - R };
    const naOkregu = (kat) => ({ x: srodek.x + R * Math.sin(kat), y: srodek.y - R * Math.cos(kat), z: 0 });

    // `rozchyl` odsuwa KCIUK od pętli (w dół i w bok) - tak wygląda dłoń, która
    // trzyma palce blisko ust, ale kółka nie układa.
    lm[4] = { x: styk.x - rozchyl * skala, y: styk.y + rozchyl * skala, z: 0 };
    lm[3] = naOkregu(-2.0);
    lm[2] = naOkregu(-2.9);
    const [mcp, pip, dip, tip] = PALCE[palec];
    lm[tip] = { ...styk, z: 0 };
    lm[dip] = naOkregu(2.0);
    lm[pip] = naOkregu(2.9);
    lm[mcp] = naOkregu(3.6);

    // Palce, które nie biorą udziału w pętli - wyprostowane w górę.
    for (const nazwa of ['wskazujacy', 'srodkowy', 'serdeczny', 'maly']) {
        if (nazwa === palec) continue;
        const [m, p2, d2, t2] = PALCE[nazwa];
        const bazaX = lm[m].x, bazaY = lm[m].y;
        lm[p2] = { x: bazaX, y: bazaY - 0.3 * skala, z: 0 };
        lm[d2] = { x: bazaX, y: bazaY - 0.55 * skala, z: 0 };
        lm[t2] = { x: bazaX, y: bazaY - 0.75 * skala, z: 0 };
    }
    return lm;
}

console.log('DOMKNIĘCIE PĘTLI:');
{
    const zamkniete = kolkoPalcow(dlonZPetla({ r: 0.2 }));
    spr(`kciuk przy opuszku -> domknięcie ~1 (${zamkniete.domkniecie.toFixed(2)})`, zamkniete.domkniecie > 0.8);
    spr('...i wie, który palec tworzy pętlę', zamkniete.palec === 'wskazujacy');

    const rozwarte = kolkoPalcow(dlonZPetla({ r: 0.2, rozchyl: 0.7 }));
    spr(`kciuk odsunięty -> domknięcie ~0 (${rozwarte.domkniecie.toFixed(2)})`,
        rozwarte.domkniecie < 0.2);

    const polowa = kolkoPalcow(dlonZPetla({ r: 0.2, rozchyl: 0.14 }));
    spr(`w połowie rozwarte -> wynik POŚREDNI (${polowa.domkniecie.toFixed(2)}) - reguła "nic nie mówi źle"`,
        polowa.domkniecie > 0.2 && polowa.domkniecie < 0.8);
}

console.log('\nWIELKOŚĆ KÓŁKA:');
{
    const male = kolkoPalcow(dlonZPetla({ r: 0.18 }));
    const srednie = kolkoPalcow(dlonZPetla({ r: 0.3 }));
    const duze = kolkoPalcow(dlonZPetla({ r: 0.45 }));
    spr(`rośnie z promieniem pętli (${male.wielkosc.toFixed(2)} < ${srednie.wielkosc.toFixed(2)} < ${duze.wielkosc.toFixed(2)})`,
        male.wielkosc < srednie.wielkosc && srednie.wielkosc < duze.wielkosc);
    spr('małe kółko daleko od maksimum', male.wielkosc < 0.5);
    // Miara jest liczona po OTOCZCE siedmiu punktów, czyli po siedmiokącie
    // wpisanym w pętlę - z natury mniejszym od koła o tym promieniu. Na żywej
    // dłoni pętla kciuk-mały wychodzi poza ten zakres i nasyca się na 1.
    spr(`duże kółko blisko maksimum (${duze.wielkosc.toFixed(2)})`, duze.wielkosc > 0.7);
    spr('wynik zawsze w 0..1', [male, srednie, duze].every(k => k.wielkosc >= 0 && k.wielkosc <= 1));

    // NIEZALEŻNOŚĆ OD ODLEGŁOŚCI OD KAMERY - cała miara jest w skalach dłoni.
    const blisko = kolkoPalcow(dlonZPetla({ r: 0.3, skala: 0.2 }));
    spr(`ta sama pętla dwa razy bliżej kamery daje ten sam wynik (${srednie.wielkosc.toFixed(3)} vs ${blisko.wielkosc.toFixed(3)})`,
        Math.abs(srednie.wielkosc - blisko.wielkosc) < 0.02);

    // Pętla na dalszym palcu jest z natury większa (kciuk sięga przez dłoń).
    const naMalym = kolkoPalcow(dlonZPetla({ palec: 'maly', r: 0.4 }));
    spr('pętla kciuk+mały też jest rozpoznana', naMalym.palec === 'maly' && naMalym.domkniecie > 0.8);
}

console.log('\nBRAK DANYCH TO NIE ZERO:');
spr('null dla niepełnej dłoni', kolkoPalcow(null) === null && kolkoPalcow([]) === null);
spr('null dla NaN w punktach', (() => {
    const lm = dlonZPetla({});
    lm[8] = { x: NaN, y: 0.5, z: 0 };
    return kolkoPalcow(lm) === null;
})());
spr('zdegenerowana dłoń (wszystko w jednym punkcie) nie wywala', (() => {
    const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    const k = kolkoPalcow(lm);
    return k === null || (Number.isFinite(k.domkniecie) && Number.isFinite(k.wielkosc));
})());

console.log('\nREGRESJA (v8.1 - "zwykłe machnięcie otwartą dłonią" nie miało uruchamiać techniki):');
{
    // Dłoń OTWARTA: wszystkie palce proste, nic się nie styka. Budujemy ją
    // WPROST (nie przez dlonZPetla, która zawsze stawia palec na pętli) -
    // to jest dokładnie zgłoszony przypadek "zwykłe machnięcie".
    function dlonOtwarta({ ox = 0.5, oy = 0.5, skala = 0.1 } = {}) {
        const lm = Array.from({ length: 21 }, () => ({ x: ox, y: oy, z: 0 }));
        lm[0] = { x: ox, y: oy, z: 0 };
        lm[9] = { x: ox, y: oy - skala, z: 0 };
        lm[1] = { x: ox - 0.45 * skala, y: oy - 0.15 * skala, z: 0 };
        lm[2] = { x: ox - 0.75 * skala, y: oy - 0.35 * skala, z: 0 };
        lm[3] = { x: ox - 1.0 * skala, y: oy - 0.55 * skala, z: 0 };
        lm[4] = { x: ox - 1.2 * skala, y: oy - 0.75 * skala, z: 0 };   // kciuk WYPROSTOWANY, z dala od palców
        const nasady = { wskazujacy: -0.3, srodkowy: -0.1, serdeczny: 0.1, maly: 0.3 };
        for (const [nazwa, bok] of Object.entries(nasady)) {
            const [m, p2, d2, t2] = PALCE[nazwa];
            const bx = ox + bok * skala, by = oy - 0.95 * skala;
            lm[m] = { x: bx, y: by, z: 0 };
            lm[p2] = { x: bx, y: by - 0.35 * skala, z: 0 };
            lm[d2] = { x: bx, y: by - 0.6 * skala, z: 0 };
            lm[t2] = { x: bx, y: by - 0.8 * skala, z: 0 };            // WSZYSTKIE palce proste w górę
        }
        return lm;
    }
    const otwarta = kolkoPalcow(dlonOtwarta());
    spr(`dłoń płaska/otwarta -> domknięcie ~0 (${otwarta.domkniecie.toFixed(2)}) - BYŁ TU BŁĄD (0.77)`,
        otwarta.domkniecie < 0.1);
    spr('...i intensywność (wielkość) też ~0', otwarta.wielkosc < 0.1);

    // Pięść: wszystkie palce zwinięte, ale kciuk NIE styka się z żadnym
    // konkretnym opuszkiem w sensie "OK" - zaciśnięty NA WIERZCHU dłoni.
    function piesc({ ox = 0.5, oy = 0.5, skala = 0.1 } = {}) {
        const lm = dlonOtwarta({ ox, oy, skala });
        for (const nazwa of ['wskazujacy', 'srodkowy', 'serdeczny', 'maly']) {
            const [m, p2, d2, t2] = PALCE[nazwa];
            lm[t2] = { x: lm[m].x, y: lm[m].y - 0.15 * skala, z: 0 };
            lm[d2] = { x: lm[m].x, y: lm[m].y - 0.25 * skala, z: 0 };
            lm[p2] = { x: lm[m].x, y: lm[m].y - 0.35 * skala, z: 0 };
        }
        lm[4] = { x: ox - 0.35 * skala, y: oy - 0.55 * skala, z: 0 };
        lm[3] = { x: ox - 0.5 * skala, y: oy - 0.4 * skala, z: 0 };
        lm[2] = { x: ox - 0.6 * skala, y: oy - 0.25 * skala, z: 0 };
        return lm;
    }
    const pn = kolkoPalcow(piesc());
    spr(`pięść -> domknięcie niskie (${pn.domkniecie.toFixed(2)})`, pn.domkniecie < 0.3);
}

process.exit(ok ? 0 : 1);