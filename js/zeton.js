/**
 * Żeton asynchronicznego startu rundy.
 *
 * `uruchomZKonfiguracji` czeka na sieć (manifest pieśni) i na metadane audio - do kilku
 * sekund. W tym czasie gracz może wcisnąć Esc (wraca na Polanę) albo wybrać inny tryb.
 * Bez żetonu spóźniony start i tak zbudowałby rundę: odliczanie niewidoczne pod menu,
 * punkty naliczane, pieśń grająca na Polanie, wynik wpisany do Księgi. Każdy start bierze
 * nowy żeton, po każdym `await` sprawdza `aktualny(id)`, a Esc/nowy start unieważnia stare.
 */
export class ZetonStartu {
    constructor() { this._n = 0; }

    /** Nowy start; unieważnia wszystkie poprzednie. */
    nowy() { return ++this._n; }

    /** Esc na Polanę: żaden oczekujący start nie ma już prawa dokończyć. */
    uniewaznij() { this._n++; }

    // id >= 1: żeton 0 nigdy nie został wydany (świeża instancja nie może go uznać za aktualny).
    aktualny(id) { return Number.isInteger(id) && id >= 1 && id === this._n; }
}
