/**
 * Nakładka diagnostyczna. Przełącznik: klawisz D. Reset zakresu v: R.
 * Zrzut śladu runy do konsoli (Krok 0b, spec run): klawisz N.
 * Sesja nagraniowa (spec pięciu pieczęci): klawisz Z (od kroku 1) albo
 * cyfra 1-8 (od wybranego kroku), Escape przerywa.
 *
 * Nie ma tu testów jednostkowych do napisania - wejściem jest strumień z kamery,
 * a wyjściem wrażenie wzrokowe. Ta nakładka JEST narzędziem weryfikacji.
 * Bez niej "działa" znaczy tylko "nie wyrzuciło wyjątku".
 *
 * Cały DOM i style tworzy sama, żeby dało się ją usunąć jednym importem mniej.
 */
import { znormalizujSlad } from './runy/ksztalt.js';
import { SesjaNagraniowa, SCENARIUSZ } from './nagrywanie/sesja.js';
import { ZapisProbek } from './nagrywanie/zapis.js';

const PANEL_ID = 'debug-hud';
const UPDATE_HZ = 10; // DOM aktualizowany 10x/s, nie 60x/s - zapis do DOM w pętli klatek to marnotrawstwo

export class DebugHud {
    constructor() {
        this.visible = false;
        this.frameTimes = [];   // znaczniki czasu ostatnich klatek (okno 1s)
        this.lastPanelUpdate = 0;
        this.panel = this._createPanel();

        // Podtrzymanie min/max prędkości. Surowa wartość skacze za bardzo,
        // żeby dało się ją odczytać z ekranu - a to właśnie te liczby są
        // potrzebne do strojenia. Reset klawiszem R.
        this.vMin = Infinity;
        this.vMax = 0;

        this._zrzucSladPrzyNastepnejKlatce = false;

        // --- Sesja nagraniowa (spec pięciu pieczęci, Krok 0) ---
        // Ekran prowadzący jest OSOBNYM elementem, nie linijką w panelu
        // diagnostycznym: gracz czyta go z drugiego końca pokoju, a panel
        // jest monospace 12px pod lewym górnym rogiem.
        this.sesja = new SesjaNagraniowa();
        this.zapis = null;
        this.ekranSesji = this._utworzEkranSesji();
        this._lastEkranSesjiUpdate = 0;

        window.addEventListener('keydown', (e) => {
            if (e.key === 'd' || e.key === 'D') this.toggle();
            if (e.key === 'r' || e.key === 'R') this.resetujZakres();
            // Zrzut na klawisz, nie natychmiast tutaj - w handlerze klawiatury
            // nie mamy dostępu do bieżącego stanu śladów (przychodzi dopiero
            // w updatePanel()). Flaga przenosi żądanie do następnej klatki.
            if (e.key === 'n' || e.key === 'N') this._zrzucSladPrzyNastepnejKlatce = true;

            // Sesja nagraniowa: Z od początku, cyfra 1-8 od wybranego kroku.
            // Cyfry, a nie Shift+Z z wyborem - dogranie jednej zepsutej pozy
            // ma być jednym naciśnięciem, bo gracz stoi wtedy przy klawiaturze
            // tylko po to i zaraz musi odejść.
            if (e.key === 'z' || e.key === 'Z') this._startSesji(1);
            if (/^[1-8]$/.test(e.key)) this._startSesji(Number(e.key));
            if (e.key === 'Escape' && this.sesja.aktywna) this._przerwijSesje();
        });
    }

    resetujZakres() {
        this.vMin = Infinity;
        this.vMax = 0;
    }

    _startSesji(odKroku) {
        if (this.sesja.aktywna) return;      // drugie naciśnięcie nie restartuje
        this.zapis = new ZapisProbek();
        this.sesja.start(odKroku);
        this.ekranSesji.style.display = 'flex';
        // AudioContext utworzony/wznowiony TU, w prawdziwym geście użytkownika
        // (naciśnięcie klawisza) - nie w _piknij() 12 s później w pętli rAF.
        // Kontekst utworzony poza gestem startuje jako 'suspended' i wtedy
        // _piknij() gra w ciszę bez żadnego wyjątku do złapania - sygnał
        // startu byłby niesłyszalny bez śladu w konsoli.
        try {
            const ctx = (this._audio ??= new (window.AudioContext || window.webkitAudioContext)());
            if (ctx.state === 'suspended') ctx.resume();
        } catch (e) {
            console.warn('[sesja] AudioContext niedostępny:', e.message);
        }
        console.log(`[Z] Sesja nagraniowa od kroku ${odKroku}. Escape przerywa.`);
    }

    /**
     * Escape PRZERYWA scenariusz, ale nie kasuje już nagranego materiału -
     * nagranie jest nieodtwarzalne bez powtórnej ~4-minutowej sesji z żywym
     * ciałem, więc przerwanie musi być tak samo bezpieczne jak naturalny
     * koniec scenariusza (sygnał 'koniec' w aktualizujSesje). Ta sama ścieżka
     * zapisu, tylko wyzwolona inaczej - żeby dogranie JEDNEGO kroku cyfrą nie
     * wymagało doczekania końca całego ogona scenariusza: gracz nagrywa swój
     * krok, naciska Escape i ma plik. Pusty zapis (Escape zanim cokolwiek się
     * nagrało) nie generuje pliku - nie ma czego zapisywać.
     */
    _przerwijSesje() {
        const klatek = this.zapis?.liczbaKlatek ?? 0;
        this.sesja.przerwij();
        this._ukryjEkranSesji();
        if (klatek > 0) {
            console.log(`[Escape] Sesja przerwana - materiał ZAPISANY (${klatek} klatek). Zaraz pobranie pliku.`);
            this._zapiszProbki();
        } else {
            console.log('[Escape] Sesja przerwana - nic jeszcze nie nagrano, brak pliku do zapisania.');
        }
    }

    /**
     * Raz na klatkę z main.js, ZAWSZE - tak jak tick(). Sesja musi chodzić
     * także przy schowanym panelu: gracz nagrywa z drugiego końca pokoju
     * i nie ma jak włączyć nakładki po drodze.
     */
    aktualizujSesje(frame, dt) {
        if (!this.sesja.aktywna) return;

        const s = this.sesja.tick(dt);

        // Klatki zbierane WYŁĄCZNIE w stanie nagrywania - przerwy i dojście
        // to spacer i szukanie pozycji, czyli materiał, którego nikt nie użyje.
        if (s.stan === 'nagrywanie') this.zapis.dodaj(s.etykieta, frame);

        if (s.sygnal === 'start') this._piknij(880, 0.35);
        if (s.sygnal === 'stop') this._piknij(440, 0.12);
        if (s.sygnal === 'koniec') {
            this._piknij(220, 0.6);
            this._zapiszProbki();
            this._ukryjEkranSesji();
            return;
        }

        // Odświeżanie DOM ograniczone do UPDATE_HZ, tak jak panel diagnostyczny
        // (ten sam powód: przepisywanie innerHTML w pętli 60 kl/s obok dwóch
        // modeli MediaPipe kosztowałoby klatkaż DOKŁADNIE w trakcie nagrywania -
        // czyli w chwili, kiedy najbardziej na nim zależy).
        const teraz = performance.now();
        if (teraz - this._lastEkranSesjiUpdate >= 1000 / UPDATE_HZ) {
            this._lastEkranSesjiUpdate = teraz;
            this._rysujEkranSesji(s);
        }
    }

    /**
     * Sygnał dźwiękowy przez własny, jednorazowy oscylator.
     *
     * NIE przez audioEngine.js: tamten prowadzi ciągłą warstwę muzyczną gry
     * i jego stan zależy od mocy i płynności. Sygnały sesji muszą być słyszalne
     * niezależnie od tego, co robi ścieżka dźwiękowa, i nie mogą jej zaburzać.
     *
     * Dźwięk jest tu ważniejszy niż ekran: przy błyskawicy gracz stoi bokiem
     * do kamery i monitora może w ogóle nie widzieć.
     */
    _piknij(hz, sekundy) {
        try {
            const ctx = (this._audio ??= new (window.AudioContext || window.webkitAudioContext)());
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = hz;
            gain.gain.setValueAtTime(0.18, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + sekundy);
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + sekundy);
        } catch (e) {
            // Brak dźwięku nie może przerwać sesji - gracz ma jeszcze ekran.
            console.warn('[sesja] sygnał dźwiękowy niedostępny:', e.message);
        }
    }

    _utworzEkranSesji() {
        const el = document.createElement('div');
        el.style.cssText = `
            position: fixed; inset: 0; z-index: 1000; display: none;
            flex-direction: column; align-items: center; justify-content: center;
            gap: 18px; pointer-events: none; text-align: center;
            font: 600 28px/1.3 system-ui, sans-serif; color: #eafff8;
            text-shadow: 0 2px 18px rgba(0,0,0,0.9);
        `;
        document.body.appendChild(el);
        return el;
    }

    _rysujEkranSesji(s) {
        const szer = Math.round(s.postep * 100);
        const kolor = s.stan === 'nagrywanie' ? '#00ffcc' : '#ffb347';
        this.ekranSesji.innerHTML = `
            <div style="font-size:15px;opacity:0.75">krok ${s.krok.nr}/${SCENARIUSZ.length}
                 · powtórzenie ${s.powtorzenie}/${s.krok.powtorzenia}</div>
            <div style="font-size:54px;color:${kolor}">${s.krok.nazwa}</div>
            <div style="max-width:70vw;font-size:24px;font-weight:400">${s.krok.opis}</div>
            <div style="font-size:19px;opacity:0.8">${s.wskazowka}</div>
            <div style="font-size:64px;color:${kolor}">
                ${s.stan === 'nagrywanie' ? '● NAGRYWAM' : Math.ceil(s.pozostaloS)}
            </div>
            <div style="width:60vw;height:10px;background:rgba(255,255,255,0.15);border-radius:5px">
                <div style="width:${szer}%;height:100%;background:${kolor};border-radius:5px"></div>
            </div>
            <div style="font-size:14px;opacity:0.5">Escape przerywa</div>
        `;
    }

    _ukryjEkranSesji() {
        this.ekranSesji.style.display = 'none';
        this.ekranSesji.innerHTML = '';
    }

    /**
     * Pobranie pliku przez <a download>. Przeglądarka nie zapisze do
     * tools/probki/ sama - plik ląduje w katalogu pobierania i trzeba go
     * tam przenieść ręcznie. Nazwa pliku niesie datę, więc kolejne sesje
     * się nie nadpisują.
     */
    _zapiszProbki() {
        const dane = this.zapis.doJson();
        const nazwa = this.zapis.nazwaPliku();

        // Nagranie jest NIEODTWARZALNE bez powtórnej ~4-minutowej sesji z
        // kamerą - zanim cokolwiek zrobi przeglądarka, dane trafiają do
        // window._ostatnieProbki. MAPA kluczowana nazwą pliku, NIE pojedynczy
        // nadpisywany slot: gdyby był jeden slot, druga sesja z rzędu (choćby
        // dogrywka zakończona Escape) po cichu skasowałaby pierwszą, jeśli
        // JEJ pobranie zawiodło niezauważenie - dokładnie ten sam stan
        // porażki, który naprawia _przerwijSesje(), tylko bez komunikatu.
        // Cena tego zabezpieczenia to NIE "śmieć w globalnej przestrzeni
        // nazw" - to retencja sterty: każdy wpis trzyma cały bufor klatek tej
        // sesji plus (przy próbie odzyskania) string z JSON.stringify.
        // Akceptowalne, bo dzieje się PO nagrywaniu, poza gorącą pętlą (w
        // odróżnieniu od throttlingu ekranu niżej), a strona i tak prędzej
        // czy później zostanie przeładowana.
        (window._ostatnieProbki ??= {})[nazwa] = dane;

        const blob = new Blob([JSON.stringify(dane)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nazwa;
        // Zaczepiony w drzewie i z revoke odroczonym na następny tick -
        // odłączony <a> i revoke tuż po click() zawodzi w części przeglądarek
        // (Firefox/Safari potrafią nie zdążyć pobrać obiektu przed revoke).
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(a.href);
            a.remove();
        }, 0);
        console.log(`[sesja] Zapisano ${dane.liczbaKlatek} klatek w ${Object.keys(dane.kroki).length} powtórzeniach ` +
                    `-> ${nazwa}. PRZENIEŚ ten plik do tools/probki/. ` +
                    `Gdyby pobieranie zawiodło: copy(JSON.stringify(window._ostatnieProbki['${nazwa}'])).`);
    }

    _createPanel() {
        const el = document.createElement('div');
        el.id = PANEL_ID;
        el.style.cssText = `
            position: fixed; top: 12px; left: 12px; z-index: 999;
            font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
            color: #b8f5e4; background: rgba(5, 5, 16, 0.82);
            border: 1px solid rgba(0, 255, 204, 0.25); border-radius: 8px;
            padding: 10px 14px; white-space: pre; pointer-events: none;
            display: none; backdrop-filter: blur(4px);
        `;
        document.body.appendChild(el);
        return el;
    }

    toggle() {
        this.visible = !this.visible;
        this.panel.style.display = this.visible ? 'block' : 'none';
    }

    /** Wywoływane raz na klatkę, ZAWSZE - licznik FPS musi zbierać dane także gdy panel jest schowany. */
    tick(now) {
        this.frameTimes.push(now);
        while (this.frameTimes.length && now - this.frameTimes[0] > 1000) {
            this.frameTimes.shift();
        }
    }

    get fps() {
        if (this.frameTimes.length < 2) return 0;
        const span = this.frameTimes[this.frameTimes.length - 1] - this.frameTimes[0];
        if (span <= 0) return 0;
        return (this.frameTimes.length - 1) * 1000 / span;
    }

    /**
     * @param {object} frame  kontrakt klatki (hands, pose, dt, ...)
     * @param {object} stats  { ruch, moc, znaki: {id: wynik}, stan }
     */
    updatePanel(frame, stats = {}) {
        // Min/max zbieramy CO KLATKĘ, przed odcięciem przez próg odświeżania -
        // panel rysuje się 10x/s, więc inaczej gubiłby szczyty.
        if (Number.isFinite(stats.predkosc) && frame.pose) {
            if (stats.predkosc < this.vMin) this.vMin = stats.predkosc;
            if (stats.predkosc > this.vMax) this.vMax = stats.predkosc;
        }

        // Zrzut śladu do konsoli - NIEZALEŻNY od tego, czy panel jest widoczny
        // (klawisz N ma działać nawet z ukrytą nakładką, tak jak licznik FPS
        // zbiera dane zawsze).
        if (this._zrzucSladPrzyNastepnejKlatce) {
            this._zrzucSladPrzyNastepnejKlatce = false;
            if (stats.slady) this._zrzucSlad(stats.slady);
        }

        if (!this.visible) return;

        const now = performance.now();
        if (now - this.lastPanelUpdate < 1000 / UPDATE_HZ) return;
        this.lastPanelUpdate = now;

        const fps = this.fps;
        const hands = frame.hands || [];
        const pose = frame.pose;

        // Skąd wiadomo, że handednesses i worldLandmarks faktycznie docierają,
        // a nie są po cichu gubione po drodze (jak przed refaktorem).
        const rece = hands.length
            ? hands.map(h => `${h.handedness ?? '?'}${h.worldLandmarks ? '+w' : '-w'}`).join(' ')
            : '—';

        const lines = [];
        // Błąd w pętli jest GŁOŚNY. Wcześniej wyjątek zabijał całą pętlę
        // w ciszy i wyglądało to jak zwis aplikacji.
        if (stats.bledyPetli) {
            lines.push(`⚠ BŁĄD PĘTLI x${stats.bledyPetli}: ${stats.ostatniBladPetli}`);
            lines.push('');
        }
        lines.push(
            `FPS   ${fps.toFixed(1).padStart(5)}   ${this._bar(fps / 60)}${fps < 24 ? '  ⚠ PONIŻEJ 24' : ''}`,
            `pose  ${pose ? 'TAK' : 'NIE '}${pose?.worldLandmarks ? ' +world' : ' -world'}    dłonie ${hands.length}`,
            `ręce  ${rece}`,
            ''
        );

        // Prędkość wygładzona jest tym, co naprawdę steruje grą - surowa tylko
        // podglądowo. Min/max podtrzymane, bo z chwilowej wartości nic się nie
        // odczyta. Zatańcz, przeczytaj zakres, zresetuj klawiszem R.
        if (stats.predkosc !== undefined) {
            lines.push(`v     ${this._num(stats.predkosc)} m/s zmierzone (surowa ${this._num(stats.predkoscSurowa)})`);
            // Po odjęciu podłogi szumu. TA wartość steruje grą - jeśli przy
            // nieruchomym staniu nie schodzi do 0.00, podłoga jest za niska.
            lines.push(`      ${this._num(stats.predkoscEfektywna)} m/s efektywne  <- to steruje grą`);
            const min = this.vMin === Infinity ? 0 : this.vMin;
            lines.push(`      zakres zmierzonej ${this._num(min)} – ${this._num(this.vMax)}   [R = reset]`);
        }
        // Rozbicie na kończyny: gdy przy bezruchu któraś wystaje ponad resztę,
        // to ona generuje szum (typowo kostki - stopy poza kadrem albo zasłonięte).
        if (stats.szumPunktow && Object.keys(stats.szumPunktow).length) {
            const czesci = Object.entries(stats.szumPunktow)
                .map(([k, v]) => `${k} ${this._num(v)}`).join('  ');
            lines.push(`      ${czesci}`);
        }
        if (stats.ruch !== undefined) lines.push(`ruch  ${this._num(stats.ruch)}   ${this._bar(stats.ruch)}`);

        // Płynność i jej surowe źródło. PROG_SZARPNIECIA w js/plynnosc.js
        // jest wyprowadzony z sygnałów syntetycznych i wymaga potwierdzenia
        // na żywym ciele - dlatego SKALA ODNIESIENIA jest wypisana obok
        // wartości. Sama liczba "9.2" nic nikomu nie mówi.
        if (stats.plynnosc !== undefined) {
            lines.push(`płyn. ${this._num(stats.plynnosc)}   ${this._bar(stats.plynnosc)}`);
            lines.push(`      szarpnięcie ${this._num(stats.szarpniecie)} /s     stawów ${stats.aktywnychStawow ?? 0}/6`);
            lines.push(`      skala: okrąg 1.5 · gładko 7 · szarpanie 56`);
            // Miara jest DRUGĄ pochodną pozycji, więc skaluje się jak 1/dt.
            // Przy załamaniu klatkażu nie szumi - po cichu maleje kilkadziesiąt
            // razy i udaje "bardzo płynny ruch". Dlatego to ostrzeżenie.
            if (stats.zaWolno) {
                lines.push(`      ⚠ KLATKAŻ ZA NISKI - pomiar wstrzymany`);
            } else if (stats.dt) {
                lines.push(`      okno ${stats.oknoKlatek} kl. = ${(stats.oknoKlatek * stats.dt * 1000).toFixed(0)} ms`);
            }
            lines.push(`      tempo ładowania x${this._num(stats.wspPlynnosci)}`);
        }

        if (stats.moc !== undefined)  lines.push(`moc   ${this._num(stats.moc)}   ${this._bar(stats.moc)}`);
        // Wyniki postaw i stan pierścienia. Progi w pieczecie.js są ZGADNIĘTE
        // i stroi się je właśnie stąd - liczba "0.62" przy konkretnej pozycji
        // ciała jest jedynym sposobem, żeby ustawić PROG_POSTAWY sensownie.
        if (stats.postawy) {
            const p = Object.entries(stats.postawy)
                .map(([k, v]) => `${k.slice(0, 3)} ${this._num(v)}`).join('  ');
            lines.push(`znak  ${p}`);
            const cel = stats.skladana ?? '—';
            lines.push(`pieczęć ${cel}  ${this._num(stats.postep ?? 0)}  ${this._bar(stats.postep ?? 0)}${stats.brakMocy ? '  ⏳ brak mocy' : ''}`);
            lines.push(`kombo ${stats.bufor ?? '—'}`);

            // Diagnostyka śladu run (spec run, GEMINI.md wzorzec: liczba przy
            // konkretnym ruchu jest jedynym sposobem wystrojenia progów).
            // 'N' zrzuca znormalizowany ślad do konsoli jako gotowy do
            // wklejenia szablon (Krok 0b - zastąpienie syntetycznych
            // szablonów w runy/szablony.js nagraniem z żywego ciała).
            if (stats.slady) {
                const { sladLewy: sl, sladPrawy: sp } = stats.slady;
                lines.push(`ślad L dł ${this._num(sl.dlugoscDrogi())} m  pokr.dłoni ${this._num(sl.pokrycieDloni())}` +
                           `   P dł ${this._num(sp.dlugoscDrogi())} m  pokr.dłoni ${this._num(sp.pokrycieDloni())}` +
                           `   [N = zrzuć do konsoli]`);
            }

            // KTÓRY warunek blokuje. Wynik pieczęci to minimum tych wartości,
            // więc najniższa liczba w tej linijce mówi, co poprawić.
            // Bez tego zostaje zgadywanie ułożenia palców.
            if (stats.rozbicie) {
                const s = stats.rozbicie.sk;
                const naj = Math.min(...Object.values(s));
                const opis = Object.entries(s)
                    .map(([k, v]) => `${k} ${this._num(v)}${v === naj ? '<' : ' '}`).join(' ');
                lines.push(`  ${stats.rozbicie.id}: ${opis}`);
            }
        }

        // Sylwetka dłoni. Wzór palców w kolejności kciuk-wskazujący-środkowy-
        // serdeczny-mały: 1 = wyprostowany, ~ = w połowie, 0 = złożony.
        // Z tych liczb stroi się progi pieczęci.
        if (stats.dlonie) {
            lines.push('');
            lines.push('dłonie  (KWŚSM)');
            for (const l of stats.dlonie) lines.push(`  ${l}`);
        }

        // Stan techniki kanałowanej i liczba cząsteczek - ta druga pilnuje
        // klatkażu, bo ogień jest pierwszą rzeczą w tej grze, która może go zjeść.
        if (stats.ogien) {
            // Dwa RÓŻNE sygnały: "wskazanie" decyduje o ZAPŁONIE (dokładnie
            // jeden palec), "utrzym." o tym, czy ogień PŁONIE DALEJ (sam palec
            // nadal wyprostowany). Rozdzielenie ich było naprawą tego, że
            // płomień gasł za łatwo - iloczyn w ocenie zapłonu jest bezlitosny.
            lines.push(`ogień ${stats.ogien.stan}  cząstek ${stats.ogien.czastki}`);
            lines.push(`      zapłon ${this._num(stats.ogien.wskazanie)} (prog 0.40)` +
                       `   utrzym. ${this._num(stats.ogien.utrzymanie)} (prog 0.30)` +
                       `${stats.ogien.barkiNiepewne ? '   ⚠ barki niepewne' : ''}`);
            // Zwłoka pokazuje, że technika PRZECZEKUJE przeskok trackingu,
            // zamiast się kończyć. Bez tego nie widać, że osłona działa.
            if (stats.ogien.powodZwloki) {
                lines.push(`      przeczekuje: ${stats.ogien.powodZwloki} ${stats.ogien.zwloka.toFixed(2)} s`);
            }
        }

        // Stan Podmuchu i jego fali. `diagnostyka` to NAJLEPSZY kandydat
        // w tej klatce, nawet gdy nic się nie odpaliło - bez tego nie da
        // się wystroić PROG_PREDKOSCI/PROG_OTWARCIA (patrz podmuch.js).
        if (stats.podmuch) {
            const d = stats.podmuch.diagnostyka;
            lines.push(`podmuch ${stats.podmuch.stan}  cząstek fali ${stats.podmuch.czastkiFali}`);
            lines.push(`      prędkość ${this._num(d.predkosc)} sk/s (prog ${this._num(stats.podmuch.progPredkosci)})` +
                       `   otwarcie ${this._num(d.otwarcie)} (prog ${this._num(stats.podmuch.progOtwarcia)})`);
            if (d.kierunek) {
                lines.push(`      kierunek (${d.kierunek.x.toFixed(2)}, ${d.kierunek.y.toFixed(2)}, ${d.kierunek.z.toFixed(2)})`);
            }
        }

        // Stan Wstęgi Mokoszy - progi Splotu (KRZYZ_MIN/PELNY, WYSOKOSC_*)
        // widać już przez ogólny mechanizm stats.rozbicie (znak ma
        // skladniki()), więc tu tylko licznik i barwa samej nagrody.
        if (stats.tecza) {
            const t = stats.tecza;
            lines.push(`tecza ${t.aktywna ? 'AKTYWNA' : 'nieaktywna'}` +
                       `${t.aktywna ? `  pozostało ${t.pozostaloS.toFixed(1)} s` : ''}` +
                       `${t.aktywna ? `  hue ${t.barwaHue.toFixed(0)}°` : ''}` +
                       `${t.aktywna ? `  siła śladu ${this._num(t.silaSladu)}` : ''}`);
        }

        // Iskry Gromu w Ziemię - tylko licznik, żeby widać było, że wystrzał
        // faktycznie coś emituje i dogasa w rozsądnym czasie.
        if (stats.iskry && stats.iskry.czastki > 0) {
            lines.push(`iskry Gromu w Ziemię: cząstek ${stats.iskry.czastki}`);
        }

        // Zapłon sylwetki i wstrząs ekranu - tylko gdy aktywne, żeby nie
        // zaśmiecać panelu przez 99% czasu gry, w którym obie warstwy śpią.
        if (stats.zaplon && stats.zaplon.aktywny) {
            lines.push(`zapłon sylwetki: aktywny`);
        }
        if (stats.ekran && stats.ekran.sila > 0.01) {
            lines.push(`wstrząs ekranu: siła ${this._num(stats.ekran.sila)}`);
        }
        if (stats.piorun && stats.piorun.aktywny) {
            lines.push(`piorun: aktywny`);
        }
        if (stats.kolowrot && stats.kolowrot.aktywny) {
            lines.push(`kołowrót: mgła ${stats.kolowrot.mgla}  drobiny ${stats.kolowrot.drobiny}`);
        }

        // Okadzenie - `gest` to NAJLEPSZY kandydat do strojenia progu
        // dłoń-usta (PELNY_SKALI/ZERO_SKALI/PROG_WEJSCIA/PROG_WYJSCIA w
        // js/dmuchanie.js są ZGADNIĘTE, tak jak progi pięciu pieczęci) -
        // bez tej liczby nie da się odróżnić "gest za daleko" od "gest
        // prawie trafiony". Ten sam wzorzec co ogień (zapłon/utrzym.).
        if (stats.dmuchanie && stats.dmuchanie.stan !== 'BEZCZYNNY') {
            lines.push(`okadzenie ${stats.dmuchanie.stan}  gest ${this._num(stats.dmuchanie.gest)}` +
                       ` (wejście 0.55 / wyjście 0.35)   siła ${this._num(stats.dmuchanie.sila)}` +
                       `   pozostało ${stats.dmuchanie.pozostaloS.toFixed(0)} s`);
        }
        if (stats.dym && (stats.dym.kleby > 0 || stats.dym.strumien > 0 || stats.dym.plonacych > 0)) {
            lines.push(`dym: kłębów ${stats.dym.kleby}  strumień ${stats.dym.strumien}  płonących ${stats.dym.plonacych}`);
        }

        if (stats.maska) lines.push(`maska ${stats.maska}`);
        if (stats.stan) lines.push(`stan  ${stats.stan}`);

        if (stats.znaki && Object.keys(stats.znaki).length) {
            lines.push('');
            lines.push('znaki:');
            for (const [id, wynik] of Object.entries(stats.znaki)) {
                lines.push(`  ${id.padEnd(9)} ${this._num(wynik)} ${this._bar(wynik)}`);
            }
        }

        this.panel.textContent = lines.join('\n');
    }

    _num(v) {
        return (Number.isFinite(v) ? v : 0).toFixed(2);
    }

    /**
     * Zrzut znormalizowanego śladu do konsoli jako GOTOWY DO WKLEJENIA
     * literał - nie tabela, nie opis. To jest cały sens Kroku 0b (spec run):
     * szablony w runy/szablony.js są dziś SYNTETYCZNE (ZGADNIĘTE amplitudy,
     * okresy) i wymagają zastąpienia nagraniem z żywego ciała. Transkrypcja
     * ręczna z tabeli liczb byłaby na tyle uciążliwa, że nikt by tego nie
     * zrobił - stąd literał wprost do wklejenia w miejsce `punkty:` szablonu.
     *
     * Bierze dowolny ślad z NIEPUSTYM buforem (ten, który akurat coś kreśli) -
     * przy dwóch dłoniach rysujących naraz zrzuca dłuższy ślad.
     */
    _zrzucSlad({ sladLewy, sladPrawy }) {
        const kandydaci = [
            { etykieta: 'L', slad: sladLewy },
            { etykieta: 'P', slad: sladPrawy }
        ].filter(k => k.slad.punkty().length >= 2);

        if (!kandydaci.length) {
            console.log('[N] Zrzut śladu: brak narysowanego kształtu (żaden bufor nie ma >= 2 punktów).');
            return;
        }

        kandydaci.sort((a, b) => b.slad.dlugoscDrogi() - a.slad.dlugoscDrogi());
        const { etykieta, slad } = kandydaci[0];
        const norm = znormalizujSlad(slad.punkty());
        if (!norm) {
            console.log(`[N] Zrzut śladu (${etykieta}): kształt zdegenerowany (RMS=0) - narysuj wyraźniejszy kształt.`);
            return;
        }

        const literal = norm.map(p => `  { x: ${p.x.toFixed(4)}, y: ${p.y.toFixed(4)} }`).join(',\n');
        console.log(
            `[N] Ślad ${etykieta} (${slad.dlugoscDrogi().toFixed(2)} m) - wklej jako 'punkty' szablonu ` +
            `w js/runy/szablony.js (zamiast wywołania znormalizowanySzablon(generuj...(), {...}) ` +
            `użyj wprost: { punkty: [...], cykliczny: ?, odwracalny: ? }):
[
${literal}
]`
        );
    }

    _bar(v, width = 14) {
        const filled = Math.max(0, Math.min(width, Math.round((v || 0) * width)));
        return '▓'.repeat(filled) + '░'.repeat(width - filled);
    }

    /**
     * Znaczniki punktów ciała rysowane wprost na płótnie.
     *
     * Służy do EMPIRYCZNEGO rozstrzygnięcia sprawy lustra: płótno ma CSS
     * transform: scaleX(-1), więc przemapowany x żyje w przestrzeni NIEODBITEJ,
     * a gracz widzi odbitą. Podnieś lewą rękę i zobacz, po której stronie
     * ekranu pojawi się "L". Nie zgaduj - sprawdź.
     */
    drawOverlay(ctx, frame) {
        if (!this.visible || !frame.pose) return;

        const { landmarks } = frame.pose;
        if (!landmarks) return;

        const punkty = [
            { i: 15, etykieta: 'L-nadgarstek' },
            { i: 16, etykieta: 'P-nadgarstek' },
            { i: 11, etykieta: 'L-bark' },
            { i: 12, etykieta: 'P-bark' }
        ];

        ctx.save();
        for (const { i, etykieta } of punkty) {
            const p = landmarks[i];
            if (!p) continue;

            const x = p.x * frame.width;
            const y = p.y * frame.height;

            ctx.fillStyle = 'rgba(0, 255, 204, 0.9)';
            ctx.beginPath();
            ctx.arc(x, y, 7, 0, Math.PI * 2);
            ctx.fill();

            // Płótno jest odbite przez CSS, więc tekst wyszedłby lustrzany
            // i nieczytelny. Odkręcamy odbicie lokalnie, tylko dla glifów.
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(-1, 1);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 13px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(etykieta, 0, -14);
            ctx.restore();
        }
        ctx.restore();
    }
}
