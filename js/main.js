import { HandTracker } from './handTracker.js';
import { PoseTracker } from './poseTracker.js';
import { AudioEngine } from './audioEngine.js';
import { DebugHud } from './debugHud.js';
import { MotionMeter } from './motionMeter.js';
import { Plynnosc } from './plynnosc.js';
import { Aura } from './aura.js';
import { ZnakRegistry } from './znaki/registry.js';
import { perun } from './znaki/perun.js';
import { mokosz } from './znaki/mokosz.js';
import { weles } from './znaki/weles.js';
import { SkladaniePieczeci } from './pieczecie.js';
import { KomboSilnik } from './kombosy.js';
import { Efekty } from './efekty.js';
import { computeCoverFit, drawVideoCover, mapLandmarks } from './frameMapper.js';
import { wzorPalcow, pelnaDlon, odlegloscNadgarstkow, zbieznoscOpuszek,
         skierowanaWGore, rownolegle, NAZWY_PALCOW } from './znaki/dlon.js';

// ODPIĘTE, NIE USUNIĘTE: powerBall.js, wiatr.js.
//
// Dłonie są WPIĘTE od nowa. Postawy ciała (perun/mokosz/weles) działały, ale
// wymagały kadru z barkami I biodrami plus zapasem - kamera laptopa tego nie
// daje. Pieczęcie przechodzą na dłonie, a te wystarczy trzymać przed sobą.
// Zmierzone na żywym tańcu: ~60 FPS z ciałem i maską, więc 8 ms na dłonie
// mieści się z ogromnym zapasem.

const uiStartScreen = document.getElementById('start-screen');
const uiLoadingScreen = document.getElementById('loading-screen');
const uiInstructionHud = document.getElementById('instruction-hud');
const uiInstructionIcon = document.getElementById('instruction-icon');
const uiInstructionText = document.getElementById('instruction-text');
const uiEnergyHud = document.getElementById('energy-hud');
const uiEnergyFill = document.getElementById('energy-fill');
const uiEnergyPercentage = document.getElementById('energy-percentage');

const startBtn = document.getElementById('start-btn');
const video = document.getElementById('webcam');
const canvas = document.getElementById('output-canvas');
const ctx = canvas.getContext('2d');

let handTracker = new HandTracker();
let poseTracker = new PoseTracker();
let audioEngine = new AudioEngine();
let debugHud = new DebugHud();
let motionMeter = new MotionMeter();
let plynnoscMiara = new Plynnosc();
let aura = null;

let znaki = new ZnakRegistry();
znaki.zarejestruj(perun);
znaki.zarejestruj(mokosz);
znaki.zarejestruj(weles);
let skladanie = new SkladaniePieczeci();
let kombosy = new KomboSilnik();
let efekty = new Efekty();

// Ostatnia rzecz, którą gracz zrobił - HUD ma o niej mówić przez chwilę,
// zamiast natychmiast wracać do zaproszenia do tańca.
let ostatniKomunikat = null, ostatniKomunikatDo = 0;

let lastVideoTime = -1;
let isRunning = false;
let lastPoseResults = null;   // wynik PoseLandmarker z ostatniej klatki wideo
let lastHandResults = null;   // wynik HandLandmarker z ostatniej klatki wideo
let lastFrameTime = 0;

// Maska sylwetki, przepisana na CPU. Trzymamy poza wynikiem detekcji, bo
// obiekt maski trzeba zwolnić od razu po odczycie (patrz pobierzMaske).
let maskaDane = null, maskaSzer = 0, maskaWys = 0;

// Skalowanie płótna do rozmiarów okna
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

startBtn.addEventListener('click', async () => {
    // 1. Ukryj start i pokaż ładowanie
    uiStartScreen.classList.add('hidden');
    uiLoadingScreen.classList.remove('hidden');

    try {
        // 2. Inicjalizacja kamery (WebRTC)
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            }
        });
        video.srcObject = stream;

        // Czekamy na załadowanie metadanych, żeby znać oryginalne wymiary wideo
        await new Promise(resolve => {
            video.onloadedmetadata = () => resolve();
        });
        video.play();

        // 3. Inicjalizacja AI (MediaPipe)
        await Promise.all([
            poseTracker.initialize(),
            handTracker.initialize()
        ]);

        // 4. Aura tancerza
        aura = new Aura(canvas, ctx);

        // 5. Inicjalizacja syntezatora audio
        audioEngine.init();

        uiLoadingScreen.classList.add('hidden');
        uiInstructionHud.classList.remove('hidden');
        uiEnergyHud.classList.remove('hidden');

        isRunning = true;
        requestAnimationFrame(renderLoop);

    } catch (e) {
        alert("Błąd dostępu do kamery lub inicjalizacji AI: " + e.message);
        console.error(e);
        uiStartScreen.classList.remove('hidden');
        uiLoadingScreen.classList.add('hidden');
    }
});

/**
 * Przepisuje maskę segmentacji z GPU do zwykłej tablicy i ZWALNIA obiekt maski.
 *
 * Bez close() tekstury GPU zostają przy życiu klatka po klatce - to wyciek,
 * który przy 30 klatkach na sekundę widać po kilkunastu sekundach.
 */
function pobierzMaske(wynik) {
    const maski = wynik?.segmentationMasks;
    if (!maski || !maski.length) return;
    const m = maski[0];
    try {
        const dane = m.getAsUint8Array();
        if (!maskaDane || maskaDane.length !== dane.length) {
            maskaDane = new Uint8Array(dane.length);
        }
        maskaDane.set(dane);
        maskaSzer = m.width;
        maskaWys = m.height;
    } finally {
        m.close();
    }
}

/**
 * Kontrakt klatki - jedyny interfejs między trackingiem a resztą gry.
 *
 * hands zostaje pustą listą, żeby kontrakt się nie zmieniał, gdy dłonie
 * wrócą razem ze znakami.
 */
function buildFrame(fit, dt, now) {
    // W tasks-vision 0.10.3 pole nazywa się handednesses (liczba mnoga).
    const hands = [];
    if (lastHandResults?.landmarks) {
        for (let i = 0; i < lastHandResults.landmarks.length; i++) {
            hands.push({
                landmarks: mapLandmarks(lastHandResults.landmarks[i], fit),
                worldLandmarks: lastHandResults.worldLandmarks?.[i] ?? null,
                handedness: lastHandResults.handednesses?.[i]?.[0]?.categoryName ?? null
            });
        }
    }

    let pose = null;
    if (lastPoseResults?.landmarks?.length) {
        pose = {
            landmarks: mapLandmarks(lastPoseResults.landmarks[0], fit),
            worldLandmarks: lastPoseResults.worldLandmarks?.[0] ?? null
        };
    }
    return { hands, pose, width: canvas.width, height: canvas.height, dt, now };
}

// Połączenia między punktami dłoni - pięć łańcuchów palców plus poprzeczka
// przez nasady, żeby dłoń czytała się jako dłoń, a nie chmura kropek.
const SZKIELET = [
    [0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [0, 9, 10, 11, 12],
    [0, 13, 14, 15, 16], [0, 17, 18, 19, 20], [5, 9, 13, 17]
];

function rysujDlonie(frame) {
    if (!frame.hands.length) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const dlon of frame.hands) {
        const lm = dlon.landmarks;
        if (!lm || lm.length < 21) continue;
        const px = (i) => ({ x: lm[i].x * frame.width, y: lm[i].y * frame.height });

        ctx.strokeStyle = 'rgba(150, 220, 255, 0.30)';
        ctx.lineWidth = 3;
        for (const lancuch of SZKIELET) {
            ctx.beginPath();
            lancuch.forEach((i, k) => {
                const p = px(i);
                k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
        }

        // Opuszki jaśniej - to one niosą znaczenie pieczęci
        for (let i = 0; i < 21; i++) {
            const p = px(i);
            const opuszek = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
            ctx.fillStyle = opuszek ? 'rgba(200, 240, 255, 0.85)' : 'rgba(150, 220, 255, 0.45)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, opuszek ? 5 : 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}

/**
 * Podpis sylwetki dłoni do nakładki.
 *
 * To NIE jest ozdoba - progi pieczęci są zgadywane, a to jedyne liczby,
 * z których da się je wystroić. Precedens: PROG_SZARPNIECIA i PROG_POSTAWY
 * oba były zgadnięte i oba wymagały odczytu z ekranu (GEMINI.md §6).
 */
function opiszDlonie(frame) {
    const h = frame.hands.filter(d => pelnaDlon(d.landmarks));
    if (!h.length) return null;

    const linie = h.map(d => {
        const w = wzorPalcow(d.landmarks);
        const wzor = w.map(v => v > 0.6 ? '1' : (v > 0.25 ? '~' : '0')).join('');
        const suma = w.reduce((a, b) => a + b, 0);
        return `${(d.handedness ?? '?').slice(0, 1)} ${wzor} ${suma.toFixed(1)} palc.` +
               `  góra ${skierowanaWGore(d.landmarks).toFixed(2)}`;
    });

    if (h.length === 2) {
        const [a, b] = [h[0].landmarks, h[1].landmarks];
        linie.push(`nadgarstki ${odlegloscNadgarstkow(a, b).toFixed(2)}` +
                   `  opuszki ${zbieznoscOpuszek(a, b).toFixed(2)}` +
                   `  równol. ${rownolegle(a, b).toFixed(2)}`);
    }
    return linie;
}

function renderLoop(now) {
    if (!isRunning) return;

    // Bez wymiarów wideo computeCoverFit dzieli przez zero, ratio robi się
    // Infinity i WSZYSTKIE przemapowane punkty stają się NaN.
    if (!video.videoWidth || !video.videoHeight) {
        requestAnimationFrame(renderLoop);
        return;
    }

    const dt = lastFrameTime ? (now - lastFrameTime) / 1000 : 0;
    lastFrameTime = now;
    debugHud.tick(now);

    // --- 1. Podgląd z kamery ---
    const fit = computeCoverFit(video, canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Płótno jest odwrócone przez CSS (scaleX(-1)), więc wideo działa jak lustro
    drawVideoCover(ctx, video, fit);

    // Przyciemnienie dla kontrastu - aura ma się na czym odcinać
    ctx.fillStyle = 'rgba(5, 5, 16, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- 2. Wykrywanie ciała (detekcja idzie na pomniejszonej klatce) ---
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const ts = performance.now();
        lastPoseResults = poseTracker.detect(video, ts);
        pobierzMaske(lastPoseResults);
        lastHandResults = handTracker.detect(video, ts);
    }

    // --- 3. Kontrakt klatki ---
    const frame = buildFrame(fit, dt, now);

    // --- 4. Płynność ruchu ---
    // Liczona z SUROWYCH worldLandmarks - filtr Savitzky'ego-Golaya robi
    // własne wygładzanie. Podanie tu pozycji już wygładzonych przez
    // MotionMeter zabiłoby sygnał, którego szukamy.
    const plynnosc = plynnoscMiara.update(frame.pose?.worldLandmarks ?? null, dt);

    // --- 5. Postawy i składanie pieczęci ---
    // KOLEJNOŚĆ MA ZNACZENIE: składanie musi policzyć się PRZED mocą, bo
    // to ono decyduje, czy zanik jest w tej klatce zamrożony.
    const postawy = znaki.ocen(frame);
    const skl = skladanie.update(postawy, motionMeter.moc, dt);

    // --- 6. Ciągłość ruchu razy płynność -> moc ---
    const moc = motionMeter.update(frame, plynnosc, skladanie.zamrazaZanik);

    // --- 6a. Pieczęć się złożyła ---
    if (skl.zlozona) {
        motionMeter.zuzyj(skl.zlozona.koszt);
        efekty.odpal(skl.zlozona.id);
        aura.rozblysk(1);
        // playFireSFX, NIE update('FIRING'): 'FIRING' tylko WYCISZA hum
        // (audioEngine.js:100-103), a klatkę później update('CHARGING') na
        // dole pętli i tak go przywraca - pieczęć wyszłaby bezgłośna.
        // Argument steruje wysokością startową, więc pieczęć brzmi lżej
        // niż technika.
        audioEngine.playFireSFX(0.3);

        const technika = kombosy.dodaj(skl.zlozona.id, now);
        if (technika) {
            efekty.odpal(technika.id);
            aura.rozblysk(1);
            audioEngine.playFireSFX(1.0);
            ostatniKomunikat = `${technika.nazwa} ✨`;
        } else {
            const znak = znaki.znaki.find(z => z.id === skl.zlozona.id);
            ostatniKomunikat = `${znak?.nazwa ?? 'Pieczęć'} złożona`;
        }
        ostatniKomunikatDo = now + 1600;
    }

    // --- 7. Aura ---
    aura.updateAndDraw(frame.pose ? maskaDane : null, maskaSzer, maskaWys,
                       moc, plynnosc, fit, dt);

    // --- 7a. Efekty pieczęci i technik ---
    efekty.updateAndDraw(ctx, frame, dt);

    // --- 7. HUD i audio ---
    const mocPct = Math.round(moc * 100);
    uiEnergyPercentage.textContent = `${mocPct}%`;
    uiEnergyFill.style.width = `${mocPct}%`;
    uiEnergyFill.classList.toggle('charged-glow', moc >= 0.95);
    document.body.className = moc >= 0.95 ? 'ready-pulse' : '';

    // Komunikaty mówią, co jest dostępne DALEJ, nigdy co gracz robi ŹLE.
    let text, icon;
    if (ostatniKomunikat && now < ostatniKomunikatDo) {
        text = ostatniKomunikat;
        icon = "✨";
    } else if (!frame.pose) {
        text = "Odsuń się, żeby kamera widziała całą sylwetkę 🕺";
        icon = "🕺";
    } else if (skl.brakMocy) {
        // ZAPROSZENIE, nie odmowa. Nigdy "za mało mocy" ani "nie stać cię".
        text = "Pieczęć czeka — tańcz jeszcze chwilę 🔥";
        icon = "🔥";
    } else if (skl.skladana) {
        text = "Trzymaj — pieczęć się składa 🌀";
        icon = "🌀";
    } else if (moc >= 0.95) {
        text = "Moc wypełniła cię po brzegi — układaj pieczęcie ✨";
        icon = "✨";
    } else if (plynnoscMiara.aktywnychStawow === 0) {
        text = "Zacznij się poruszać — moc budzi się w ruchu 🔥";
        icon = "🔥";
    } else if (plynnosc > 0.6) {
        text = "Płyniesz. Moc rośnie 🌀";
        icon = "🌀";
    } else {
        // Zaproszenie, nie poprawka. Nadal ładuje, tylko wolniej.
        text = "Rozpuść ruch w łagodne łuki, a moc popłynie szybciej 〰️";
        icon = "〰️";
    }
    uiInstructionText.textContent = text;
    uiInstructionIcon.textContent = icon;

    audioEngine.update('CHARGING', moc, plynnosc);

    // --- 7b. Szkielet dłoni ---
    // Rysowany ZAWSZE, nie tylko w trybie debug. Bez tego gracz nie ma
    // żadnego potwierdzenia, że palce są w ogóle śledzone - a to była
    // pierwsza rzecz, o którą zapytał po przejściu na pieczęcie dłoniowe.
    rysujDlonie(frame);

    // --- 8. Nakładka diagnostyczna (klawisz D) ---
    debugHud.drawOverlay(ctx, frame);
    debugHud.updatePanel(frame, {
        ruch: motionMeter.responsywnosc,
        predkosc: motionMeter.predkosc,
        predkoscSurowa: motionMeter.predkoscSurowa,
        predkoscEfektywna: motionMeter.predkoscEfektywna,
        szumPunktow: motionMeter.szumPunktow,
        moc,
        plynnosc,
        szarpniecie: plynnoscMiara.szarpniecie,
        aktywnychStawow: plynnoscMiara.aktywnychStawow,
        zaWolno: plynnoscMiara.zaWolno,
        oknoKlatek: plynnoscMiara._polOkna * 2 + 1,
        dt,
        wspPlynnosci: motionMeter.wspolczynnikPlynnosci,
        maska: maskaDane ? `${maskaSzer}x${maskaWys}` : 'brak',
        dlonie: opiszDlonie(frame),
        postawy,
        skladana: skl.skladana,
        postep: skl.postep,
        brakMocy: skl.brakMocy,
        bufor: kombosy.bufor.map(w => w.id).join(' → ') || '—'
    });

    requestAnimationFrame(renderLoop);
}
