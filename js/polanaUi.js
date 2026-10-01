/**
 * Polana - warstwa DOM menu. Renderuje stan modelu Menu (js/menu.js) i przekazuje
 * akcje użytkownika; LOGIKI tu nie ma (walidacja, przejścia - w modelu).
 *
 * Tekst gracza (nick!) wyłącznie przez textContent - nigdy innerHTML. Wartości
 * pól formularzy czytamy przez .value, a nie wstawiamy do DOM jako HTML.
 */
import { formatCzasu } from './rundaHud.js';
import { nazwaTablicy } from './ksiega.js';
import { PROBA_DLUGOSCI } from './tryby.js';

const EKRAN_ID = { polana: 'polana', konfig: 'konfig', ksiega: 'ksiega-ekran', kronika: 'kronika' };
const TYTULY = { obrzed: 'Obrzęd: taniec do pieśni', proba: 'Próba: taniec na czas', swobodny: 'Swobodny taniec' };

/** Przycisk-pigułka (textContent). */
function pigulka(doc, tekst, wcisniety, atrybut = 'aria-pressed') {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = tekst;
    b.setAttribute(atrybut, String(!!wcisniety));
    return b;
}

export class PolanaUi {
    /**
     * @param {Document} doc
     * @param {{menu, ksiega, losoweImie:()=>string, onStart:(konfig)=>void, onJeszczeRaz:()=>void, onDoPolany:()=>void}} deps
     */
    constructor(doc, { menu, ksiega, losoweImie, onStart, onJeszczeRaz, onDoPolany }) {
        this.doc = doc;
        this.menu = menu;
        this.ksiega = ksiega;
        this.losoweImie = losoweImie;
        this.onStart = onStart;
        this.onJeszczeRaz = onJeszczeRaz;
        this.onDoPolany = onDoPolany;
        this.zakladka = null;           // aktywny klucz tablicy w Księdze
        this.swiezy = null;             // {klucz, nick, wynik} - świeży wpis do podświetlenia
        this.potwierdzaWyczysc = false;
        this.infoKsiegi = '';
        const $ = (id) => doc.getElementById(id);
        this.$ = $;
        this.root = $('menu');
        if (!this.root) return;         // strona bez menu (np. test) - cicho nic nie robi
        this._podepnij();
    }

    _podepnij() {
        const { $, menu } = this;
        const odswiez = () => this.render();

        for (const k of this.doc.querySelectorAll('.kamien')) {
            k.addEventListener('click', () => { menu.wybierz(k.dataset.kamien); this._poWyborzeKamienia(); odswiez(); });
        }
        $('opt-zew').addEventListener('change', (e) => { menu.ustaw('zew', e.target.checked); odswiez(); });
        $('opt-krag').addEventListener('change', (e) => { menu.ustaw('krag', e.target.checked); odswiez(); });
        $('nick-solo').addEventListener('input', (e) => { menu.ustaw('nick', e.target.value); this._odswiezPrzyciskStartu(); });
        $('nick-solo').addEventListener('keydown', (e) => { if (e.key === 'Enter') this._start(); });
        $('nick-kosci').addEventListener('click', () => { menu.ustaw('nick', this.losoweImie()); odswiez(); });
        $('krag-dodaj').addEventListener('click', () => { menu.dodajGracza(); odswiez(); });
        $('konfig-wstecz').addEventListener('click', () => { menu.wstecz(); odswiez(); });
        $('rozpal-btn').addEventListener('click', () => this._start());
        $('ksiega-wstecz').addEventListener('click', () => { this.potwierdzaWyczysc = false; menu.wstecz(); odswiez(); });
        $('ksiega-eksport').addEventListener('click', () => this._eksport());
        $('ksiega-import').addEventListener('change', (e) => this._import(e.target));
        $('ksiega-wyczysc').addEventListener('click', () => { this.potwierdzaWyczysc = true; odswiez(); });
        $('ksiega-wyczysc-tak').addEventListener('click', () => {
            this.ksiega.wyczysc(); this.potwierdzaWyczysc = false; this.swiezy = null;
            this.infoKsiegi = 'Księga jest czysta — zaczynacie od nowa.'; odswiez();
        });
        $('kronika-jeszcze').addEventListener('click', () => this.onJeszczeRaz());
        $('kronika-polana').addEventListener('click', () => this.onDoPolany());

        // Klawiatura: strzałki chodzą po kamieniach, Esc cofa o krok (Polana i Kronika/gra - w main.js).
        this.doc.addEventListener('keydown', (e) => {
            if (this.root.classList.contains('hidden')) return;
            if (e.key === 'Escape' && (menu.ekran === 'konfig' || menu.ekran === 'ksiega')) {
                this.potwierdzaWyczysc = false;
                menu.wstecz(); odswiez();
            } else if (menu.ekran === 'polana' && ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
                this._ruchPoKamieniach(e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1);
                e.preventDefault();
            }
        });
    }

    _ruchPoKamieniach(krok) {
        const k = [...this.doc.querySelectorAll('.kamien')].filter(x => !x.disabled);
        if (!k.length) return;
        const i = k.indexOf(this.doc.activeElement);
        k[(i + krok + k.length) % k.length].focus();
    }

    _poWyborzeKamienia() {
        if (this.menu.ekran === 'ksiega') {
            this.zakladka = this.ksiega.klucze()[0] ?? null;
            this.potwierdzaWyczysc = false;
            this.infoKsiegi = '';
        }
    }

    _start() {
        const konf = this.menu.konfiguracja();
        if (konf && !this.menu.zajety) this.onStart(konf);
    }

    _odswiezPrzyciskStartu() {
        const btn = this.$('rozpal-btn');
        const bledy = this.menu.bledy();
        btn.disabled = bledy.length > 0 || this.menu.zajety;
        this.$('konfig-info').textContent = this.menu.zajety ? 'Duchy się budzą — kamera i model ruchu…' : (bledy[0] ?? '');
    }

    _eksport() {
        const blob = new Blob([this.ksiega.eksportuj()], { type: 'application/json' });
        const a = this.doc.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ksiega-plemienia.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    _import(input) {
        const plik = input.files?.[0];
        input.value = '';
        if (!plik) return;
        const r = new FileReader();
        r.onload = () => {
            const wynik = this.ksiega.importuj(String(r.result));
            if (wynik.ok) {
                this.infoKsiegi = wynik.dodano > 0 ? `Dopisano ${wynik.dodano} wpisów do Księgi.` : 'Te wyniki już są w Księdze.';
                this.zakladka = this.ksiega.klucze()[0] ?? null;
            } else {
                this.infoKsiegi = wynik.powod === 'rozmiar'
                    ? 'Ten plik jest za duży na Księgę — spróbuj mniejszego.'
                    : 'Ten plik nie wygląda jak Księga Plemienia.';
            }
            this.render();
        };
        r.onerror = () => { this.infoKsiegi = 'Nie udało się odczytać pliku.'; this.render(); };
        r.readAsText(plik);
    }

    /** Wpis do podświetlenia po powrocie z Kroniki do Księgi. */
    pokazSwiezy(klucz, nick, wynik) { this.swiezy = { klucz, nick, wynik }; }

    render() {
        if (!this.root) return;
        const { menu, doc } = this;
        const widoczne = menu.ekran in EKRAN_ID;
        this.root.classList.toggle('hidden', !widoczne);
        for (const [ekran, id] of Object.entries(EKRAN_ID)) doc.getElementById(id).classList.toggle('hidden', menu.ekran !== ekran);
        doc.body.classList.toggle('w-menu', menu.ekran === 'polana' || menu.ekran === 'konfig' || menu.ekran === 'ksiega');
        if (menu.ekran === 'polana') this._renderPolana();
        else if (menu.ekran === 'konfig') this._renderKonfig();
        else if (menu.ekran === 'ksiega') this._renderKsiega();
        else if (menu.ekran === 'kronika') this._renderKronika();
    }

    _renderPolana() {
        const { menu } = this;
        for (const k of this.doc.querySelectorAll('.kamien')) k.disabled = !menu.dostepne(k.dataset.kamien) || menu.zajety;
        this.$('polana-podpowiedz').textContent = menu.podpowiedz('obrzed');
    }

    _renderKonfig() {
        const { menu, doc, $ } = this;
        $('konfig-tytul').textContent = TYTULY[menu.tryb] ?? '';
        const obrzed = menu.tryb === 'obrzed', proba = menu.tryb === 'proba', swobodny = menu.tryb === 'swobodny';
        $('konfig-piesn').classList.toggle('hidden', !obrzed);
        $('konfig-czas').classList.toggle('hidden', !proba);
        $('konfig-opcje').classList.toggle('hidden', swobodny);
        $('konfig-nick-solo').classList.toggle('hidden', swobodny || menu.krag);
        $('konfig-krag-lista').classList.toggle('hidden', swobodny || !menu.krag);
        $('opt-zew').checked = menu.zew;
        $('opt-krag').checked = menu.krag;
        if (doc.activeElement !== $('nick-solo')) $('nick-solo').value = menu.nick;

        const piesni = $('konfig-piesni'); piesni.replaceChildren();
        menu.piesni.forEach((p, i) => {
            const b = pigulka(doc, p.dlugoscS > 0 ? `${p.tytul} (${formatCzasu(p.dlugoscS)})` : p.tytul, i === menu.piesn);
            b.addEventListener('click', () => { menu.ustaw('piesn', i); this.render(); });
            piesni.appendChild(b);
        });
        const czasy = $('konfig-czasy'); czasy.replaceChildren();
        for (const c of PROBA_DLUGOSCI) {
            const b = pigulka(doc, `${c} s`, c === menu.czas);
            b.addEventListener('click', () => { menu.ustaw('czas', c); this.render(); });
            czasy.appendChild(b);
        }
        const lista = $('krag-nicki'); lista.replaceChildren();
        menu.nicki.forEach((n, i) => {
            const w = doc.createElement('div'); w.className = 'krag-wiersz';
            const inp = doc.createElement('input');
            inp.type = 'text'; inp.maxLength = 16; inp.value = n; inp.autocomplete = 'off';
            inp.setAttribute('aria-label', `Tancerz ${i + 1}`);
            inp.addEventListener('input', () => { menu.ustawNick(i, inp.value); this._odswiezPrzyciskStartu(); });
            const kosci = doc.createElement('button'); kosci.type = 'button'; kosci.className = 'krag-usun'; kosci.textContent = '🎲';
            kosci.setAttribute('aria-label', `Wylosuj imię dla tancerza ${i + 1}`);
            kosci.addEventListener('click', () => { menu.ustawNick(i, this.losoweImie()); this.render(); });
            w.append(inp, kosci);
            if (menu.nicki.length > 2) {
                const x = doc.createElement('button'); x.type = 'button'; x.className = 'krag-usun'; x.textContent = '×';
                x.setAttribute('aria-label', `Usuń tancerza ${i + 1}`);
                x.addEventListener('click', () => { menu.usunGracza(i); this.render(); });
                w.append(x);
            }
            lista.appendChild(w);
        });
        $('krag-dodaj').disabled = menu.nicki.length >= 6;
        this._odswiezPrzyciskStartu();
    }

    _renderKsiega() {
        const { doc, $, ksiega, menu } = this;
        const klucze = ksiega.klucze();
        if (!klucze.includes(this.zakladka)) this.zakladka = klucze[0] ?? null;
        const zak = $('ksiega-zakladki'); zak.replaceChildren();
        for (const k of klucze) {
            const b = pigulka(doc, nazwaTablicy(k, menu.piesni), k === this.zakladka, 'aria-selected');
            b.setAttribute('role', 'tab');
            b.addEventListener('click', () => { this.zakladka = k; this.render(); });
            zak.appendChild(b);
        }
        const lista = $('ksiega-lista'); lista.replaceChildren();
        for (const w of this.zakladka ? ksiega.tablica(this.zakladka) : []) {
            const li = doc.createElement('li');
            const nick = doc.createElement('span'); nick.textContent = w.nick;
            const wynik = doc.createElement('span'); wynik.className = 'wpis-wynik'; wynik.textContent = String(w.wynik);
            li.append(nick, wynik);
            if (this.swiezy && this.swiezy.klucz === this.zakladka && this.swiezy.nick === w.nick && this.swiezy.wynik === w.wynik) li.classList.add('swiezy');
            lista.appendChild(li);
        }
        let info = this.infoKsiegi;
        if (!info && !klucze.length) info = 'Księga czeka na pierwszy wpis — zatańcz obrzęd.';
        if (!info && !ksiega.trwala) info = 'Ta przeglądarka nie pozwala zapisać Księgi — wyniki przetrwają do zamknięcia karty.';
        $('ksiega-info').textContent = info;
        $('ksiega-wyczysc').classList.toggle('hidden', this.potwierdzaWyczysc);
        $('ksiega-wyczysc-tak').classList.toggle('hidden', !this.potwierdzaWyczysc);
    }

    _renderKronika() {
        const { doc, $ } = this;
        const k = this.menu.kronika;
        if (!k) return;
        $('kronika-tytul').textContent = k.tytul;
        $('kronika-wynik').textContent = k.wynik;
        $('kronika-szaman').textContent = k.szaman.tytul;
        $('kronika-zdanie').textContent = k.szaman.zdanie;
        const prz = $('kronika-przydomki'); prz.replaceChildren();
        for (const p of k.przydomki) { const s = doc.createElement('span'); s.className = 'przydomek'; s.textContent = p; prz.appendChild(s); }
        const mi = $('kronika-miejsce'); mi.textContent = k.miejsce; mi.classList.toggle('rekord', /rekord/i.test(k.miejsce));
        const linie = $('kronika-linie'); linie.replaceChildren();
        for (const l of k.linie) { const d = doc.createElement('div'); d.textContent = l; linie.appendChild(d); }
        const pod = $('kronika-podium'); pod.replaceChildren();
        if (k.podium) {
            const h = doc.createElement('div'); h.className = 'etykieta'; h.textContent = 'Podium Kręgu'; pod.appendChild(h);
            for (const w of k.podium) { const d = doc.createElement('div'); d.textContent = `${w.miejsce}. ${w.nick}: ${w.wynik}`; pod.appendChild(d); }
        }
        $('kronika-podpis').textContent = k.podpis;
    }
}
