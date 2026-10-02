/**
 * Kurzawa v2 - pas wiatru: start z dołu ekranu, pasy wokół ciała, smugi; bez document.
 *   node tools/test-kurzawa.mjs
 */
import { Kurzawa, obwiednia, geometriaPasa, glowaPodmuchu, punktyOgona, punktyMgielki, ziarnoNaTorze, CZAS_TRWANIA, NASTAWY } from '../js/kurzawa.js';
import { klatka, kontekst, przepusc, atrapaCtx, H } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const ZACZEP = { x: 960, y: 430, skala: 190 };
const blisko = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

console.log('PASY:');
const pasy = [0, 1, 2, 3].map(i => geometriaPasa(i, ZACZEP, H));
spr('pasy na różnych wysokościach, pas 0 najniżej', pasy.every((p, i) => i === 0 || p.cy < pasy[i - 1].cy));
spr('sąsiednie pasy kręcą się w PRZECIWNE strony', pasy.every((p, i) => i === 0 || p.kierunek === -pasy[i - 1].kierunek));
spr('sąsiednie podmuchy wchodzą z PRZECIWNYCH stron', pasy.every((p, i) => i === 0 || p.strona === -pasy[i - 1].strona));
const nisko = geometriaPasa(0, { x: 960, y: 0.8 * H, skala: 190 }, H);
spr('pas nigdy nie ucieka pod dół kadru', nisko.cy <= H * NASTAWY.DOL_EKRANU + 1e-9);

console.log('\nGŁOWA PODMUCHU:');
spr('przed swoim startem podmuch nie istnieje', glowaPodmuchu(0, -0.01, ZACZEP, H) === null);
spr('start POD dolną krawędzią ekranu', glowaPodmuchu(0, 0, ZACZEP, H).y >= H);
spr('...także gdy gracz stoi wysoko w kadrze', glowaPodmuchu(1, 0, { x: 960, y: 150, skala: 190 }, H).y >= H);
const wejscie = glowaPodmuchu(0, NASTAWY.T_WZNOSZENIA, ZACZEP, H);
spr('po wzniesieniu podmuch jest w skrajnym punkcie swojego pasa',
    blisko(wejscie.x, pasy[0].cx + Math.cos(pasy[0].katWejscia) * pasy[0].R, 1e-3) && blisko(wejscie.y, pasy[0].cy, 1e-3));
const naOrbicie = glowaPodmuchu(0, NASTAWY.T_WZNOSZENIA + 0.7, ZACZEP, H);
spr('potem krąży po elipsie pasa wokół gracza',
    blisko(((naOrbicie.x - pasy[0].cx) / pasy[0].R) ** 2 + ((naOrbicie.y - pasy[0].cy) / (pasy[0].R * NASTAWY.SQUASH)) ** 2, 1, 1e-6));
const tuzPo = glowaPodmuchu(0, NASTAWY.T_WZNOSZENIA + 0.02, ZACZEP, H);
spr('wejście w orbitę idzie W GÓRĘ (gładko z ruchu od dołu)', tuzPo.y < wejscie.y);

console.log('\nOGON (SMUGA):');
const t = NASTAWY.T_WZNOSZENIA + (Math.PI + 0.5) / NASTAWY.PREDKOSC_KATOWA;   // ogon przecina oś przód/tył
const ogon = punktyOgona(0, t, ZACZEP, H);
spr(`ogon ma ${NASTAWY.PUNKTOW_OGONA + 1} punktów`, ogon.length === NASTAWY.PUNKTOW_OGONA + 1);
spr('pierwszy punkt to głowa', blisko(ogon[0].x, glowaPodmuchu(0, t, ZACZEP, H).x));
const k = 5, krokOgona = NASTAWY.DLUGOSC_OGONA_S / NASTAWY.PUNKTOW_OGONA;
spr('ogon leci torem głowy (punkt k = głowa sprzed k kroków)', blisko(ogon[k].y, glowaPodmuchu(0, t - k * krokOgona, ZACZEP, H).y));
spr('ogon zwęża się ku końcowi', ogon.every((p, i) => i === 0 || p.zwezenie < ogon[i - 1].zwezenie));
spr('smuga ma część PRZED i część ZA graczem', ogon.some(p => p.przod) && ogon.some(p => !p.przod));
spr('podmuchy startują po kolei (najwyższy jeszcze nie wystartował)', punktyOgona(3, 0.5, ZACZEP, H).length === 0);

console.log('\nMGIEŁKA KURZU (punkty na ogonie):');
const mgla = punktyMgielki(0, t, ZACZEP, H);
spr(`kłęby co ${NASTAWY.MGLA_CO}. punkt ogona (${Math.floor(NASTAWY.PUNKTOW_OGONA / NASTAWY.MGLA_CO) + 1})`, mgla.length === Math.floor(NASTAWY.PUNKTOW_OGONA / NASTAWY.MGLA_CO) + 1);
spr('kłęby leżą dokładnie na torze ogona', mgla.every((m, j) => blisko(m.x, ogon[j * NASTAWY.MGLA_CO].x) && blisko(m.y, ogon[j * NASTAWY.MGLA_CO].y)));
spr('wiek kłębu rośnie od głowy (0) do końca ogona (1)', mgla[0].wiek === 0 && blisko(mgla[mgla.length - 1].wiek, 1, 0.1) && mgla.every((m, j) => j === 0 || m.wiek > mgla[j - 1].wiek));
spr('przed startem podmuchu brak mgiełki', punktyMgielki(3, 0.5, ZACZEP, H).length === 0);

console.log('\nZIARNA PIASKU:');
const zOs = { podmuch: 0, opoznienie: 0, dx: 0, dy: 0, faza: 0 };
const g0 = glowaPodmuchu(0, t, ZACZEP, H);
const z0 = ziarnoNaTorze(zOs, t, ZACZEP, H);
spr('ziarno bez rozrzutu leży na torze głowy', blisko(z0.x, g0.x) && blisko(z0.y, g0.y));
const dalekie = ziarnoNaTorze({ ...zOs, opoznienie: NASTAWY.DLUGOSC_OGONA_S, dx: 1, dy: 1 }, t, ZACZEP, H);
const wzgl = ziarnoNaTorze({ ...zOs, opoznienie: NASTAWY.DLUGOSC_OGONA_S }, t, ZACZEP, H);
spr('rozrzut rośnie ku końcowi ogona (ziarno z końca dalej od toru)',
    Math.hypot(dalekie.x - wzgl.x, dalekie.y - wzgl.y) > 0.5 * ZACZEP.skala * NASTAWY.ROZRZUT_ZIARNA);
const blizkie = ziarnoNaTorze({ ...zOs, opoznienie: 0.01, dx: 1, dy: 1 }, t, ZACZEP, H);
const blizkieBez = ziarnoNaTorze({ ...zOs, opoznienie: 0.01 }, t, ZACZEP, H);
spr('...a przy głowie prawie na torze', Math.hypot(blizkie.x - blizkieBez.x, blizkie.y - blizkieBez.y) < Math.hypot(dalekie.x - wzgl.x, dalekie.y - wzgl.y) / 4);
spr('ziarno ma kierunek ruchu (wektor jednostkowy)', blisko(Math.hypot(z0.kierunek.x, z0.kierunek.y), 1, 1e-6));
spr('przed startem podmuchu brak ziarna', ziarnoNaTorze({ ...zOs, podmuch: 3 }, 0.5, ZACZEP, H) === null);

console.log('\nSTYLISTYKA (nie "kula mocy"):');
{
    const ops = new Set(); const wywolania = { stroke: 0, fill: 0, drawImage: 0 };
    const nic = () => {};
    const rejestrator = new Proxy({ canvas: { width: 1920, height: 1080 } }, {
        get(cel, klucz) {
            if (klucz in cel) return cel[klucz];
            if (klucz === 'stroke' || klucz === 'fill' || klucz === 'drawImage' || klucz === 'fillRect') return () => { wywolania[klucz === 'fillRect' ? 'fill' : klucz]++; };
            if (klucz === 'createRadialGradient' || klucz === 'createLinearGradient') return () => ({ addColorStop: nic });
            return nic;
        },
        set(cel, klucz, wartosc) { if (klucz === 'globalCompositeOperation') ops.add(wartosc); cel[klucz] = wartosc; return true; }
    });
    const kd = new Kurzawa();
    kd.zapal(1);
    for (let i = 0; i < 90; i++) kd.updateAndDraw(rejestrator, kontekst(klatka()), 1 / 60);
    spr('coś faktycznie się rysuje (kreski ziaren/linie prądu)', wywolania.stroke > 0);
    spr('żadnego blendowania addytywnego "lighter" (to robi z wiatru kulę mocy)', !ops.has('lighter'));
}

console.log('\nOBWIEDNIA I CYKL ŻYCIA:');
spr('obwiednia zero na końcach, NaN -> 0', obwiednia(0) === 0 && obwiednia(CZAS_TRWANIA) === 0 && obwiednia(NaN) === 0);
const kz = new Kurzawa();
spr('bezczynna na starcie', kz.aktywny === false);
kz.zapal(1); kz.zapal(1);
spr('ponowny zapal() restartuje, nie podwaja pyłu ani ziaren', kz._pyl.length === NASTAWY.LICZBA_PYLU && kz._ziarna.length === NASTAWY.LICZBA_ZIAREN && kz._t === 0);
przepusc(kz, klatka({ barki: [0.3, 0.4, 0.4, 0.4] }), 0.5);
const x1 = kz.zaczep.x;
przepusc(kz, klatka({ barki: [0.6, 0.4, 0.7, 0.4] }), 0.5);
spr('zaczep podąża za barkami', kz.zaczep.x > x1 + 100);
const x2 = kz.zaczep.x;
przepusc(kz, klatka({ barki: null }), 0.3);
spr('poza znika -> zaczep stoi', kz.zaczep.x === x2);
let rzucil = false;
try { kz.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60); } catch (e) { rzucil = e; }
spr('rysowanie bez assetów i bez document nie rzuca', rzucil === false);
przepusc(kz, klatka(), CZAS_TRWANIA);
spr('gaśnie po CZAS_TRWANIA', kz.aktywny === false);

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
