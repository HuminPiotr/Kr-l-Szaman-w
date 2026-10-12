/**
 * Emblemat jako element <svg> - wspólne dla Zwoju (js/zwojUi.js), powiadomienia
 * na żywo (js/odkryciaHud.js) i Kroniki. Nic na poziomie modułu nie dotyka DOM.
 * Wnętrze to statyczne łańcuchy z js/emblematy.js (nigdy dane gracza).
 */
import { svgEmblematu } from './emblematy.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function rysujEmblemat(doc, rodzaj, id) {
    const s = doc.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 64 64');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    s.setAttribute('class', `emblemat emblemat-${rodzaj}`);
    s.innerHTML = svgEmblematu(rodzaj, id);
    return s;
}
