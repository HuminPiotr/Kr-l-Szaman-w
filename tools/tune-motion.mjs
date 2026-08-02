/**
 * Strojenie MotionMeter bez kamery i bez zgadywania.
 *
 *   node tools/tune-motion.mjs
 *
 * Symuluje ciało poruszające się z zadaną prędkością i sprawdza, czy stałe
 * w js/motionMeter.js trafiają w cele: pełne naładowanie w 6-10 s spokojnego
 * tańca, zanik do zera po ~15 s bezruchu.
 *
 * Jak używać: włącz nakładkę debug (klawisz D), zatańcz, odczytaj zakres "v ... m/s".
 * Wstaw swoje realne wartości do PREDKOSCI poniżej i sprawdź, czy czasy pasują.
 * Jeśli nie - popraw stałe w motionMeter.js i uruchom ponownie.
 */
import { MotionMeter } from '../js/motionMeter.js';

const DT = 1 / 60;
// Amplitudy dobrane tak, by kolumna "zmierz." pokryła realny zakres gracza:
// stanie w miejscu -> 0.00, spokojny taniec -> 0.30, energiczny -> 0.67.
const PREDKOSCI = [0.07, 0.2, 0.3, 0.42, 0.6, 0.92, 1.4, 2.0];

// Syntetyczne ciało: śledzone kończyny oscylują tak, by średnia |v| ≈ zadanej
function cialo(t, predkoscMs) {
    const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
    const f = 1.0; // Hz
    const amp = predkoscMs / (2 * Math.PI * f) * (Math.PI / 2);
    for (const i of [15, 16, 13, 14, 27, 28]) {
        lm[i] = { x: amp * Math.sin(2 * Math.PI * f * t), y: 0, z: 0 };
    }
    return lm;
}

function symuluj({ predkosc, sekundy, mocPoczatkowa = 0, pose = true }) {
    const m = new MotionMeter();
    m.moc = mocPoczatkowa;
    let t = 0;
    const slad = [];
    for (let i = 0; i < sekundy / DT; i++) {
        t += DT;
        m.update({
            hands: [],
            pose: pose ? { landmarks: [], worldLandmarks: cialo(t, predkosc) } : null,
            width: 1920, height: 1080, dt: DT, now: t * 1000
        });
        slad.push({ t, moc: m.moc });
    }
    return { m, slad };
}

const czasDo = (slad, cel, rosnaco) =>
    slad.find(s => rosnaco ? s.moc >= cel : s.moc <= cel)?.t ?? null;

console.log('CEL: pełna moc w 6-10 s spokojnego tańca | zanik do zera po ~15 s');
console.log('     stanie w miejscu MUSI dawać zanik (efektywna 0.00)\n');
// "zmierz." to odczyt z nakładki (po filtrze), a nie zadana amplituda -
// tylko tę kolumnę da się porównać z tym, co gracz widzi na ekranie.
console.log('  zmierz.  efektyw.  responsyw.   czas do pełnej mocy');
console.log('  ' + '-'.repeat(52));

for (const v of PREDKOSCI) {
    const { m, slad } = symuluj({ predkosc: v, sekundy: 60 });
    const t = czasDo(slad, 0.99, true);
    const ocena = t === null ? '  ← zanik (dobrze dla bezruchu)' : (t >= 6 && t <= 12 ? '  ← w celu' : '');
    console.log(
        `  ${m.predkosc.toFixed(2).padStart(6)}  ${m.predkoscEfektywna.toFixed(2).padStart(8)}  ${m.responsywnosc.toFixed(2).padStart(10)}   ` +
        `${(t ? t.toFixed(1) + ' s' : 'nigdy').padStart(9)}${ocena}`
    );
}

const { slad: bezruch } = symuluj({ predkosc: 0, sekundy: 60, mocPoczatkowa: 1 });
const { slad: pozaKadrem } = symuluj({ predkosc: 0, sekundy: 120, mocPoczatkowa: 1, pose: false });

console.log(`\n  bezruch     moc 1.0 -> 0 w ${czasDo(bezruch, 0.001, false)?.toFixed(1) ?? 'nigdy'} s`);
console.log(`  poza kadrem moc 1.0 -> 0 w ${czasDo(pozaKadrem, 0.001, false)?.toFixed(1) ?? 'nigdy'} s  (ma być wolniej - wyjście z kadru nie karze)`);
