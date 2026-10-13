/**
 * Woda Mokoszy na GPU - fragment shader WebGL2 dla Fali Mokoszy (VFX v2,
 * 2026-10-13, spec docs/superpowers/specs/2026-10-13-fala-i-kruki-design.md).
 *
 * DLACZEGO OSOBNE PŁÓTNO, A NIE PRZEPISANIE GRY NA WEBGL: cała gra rysuje
 * w Canvas2D. Shader renderuje się na MAŁYM offscreen płótnie WebGL2 (pół
 * rozdzielczości), a wynik wkleja się zwykłym ctx.drawImage - reszta
 * potoku nie wie, że istnieje GPU. Brak WebGL2 albo błąd kompilacji ->
 * gotowa() === false i falaMokoszy.js rysuje starą wersję Canvas2D
 * (GEMINI.md §2: nic nie mówi źle - gracz dalej widzi falę).
 *
 * WEJŚCIE: powierzchnia wody jako KOLUMNY (KOLUMN próbek przez szerokość
 * kadru), każda vec4: y powierzchni (0 = góra kadru, 1 = dół), piana
 * grzbietu 0..1, alfa 0..1, gejzer 0..1. Tło (obraz kamery z już
 * narysowanymi warstwami) to ctx.canvas - z niego refrakcja.
 *
 * Import NIE dotyka document (testy w Node) - płótno powstaje leniwie.
 */

export const KOLUMN = 128;

const VERT = `#version 300 es
in vec2 a_poz;
out vec2 v_uv;
void main() {
    v_uv = vec2(a_poz.x * 0.5 + 0.5, 0.5 - a_poz.y * 0.5);   // y w dół, jak w Canvas2D
    gl_Position = vec4(a_poz, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform vec4 u_kol[${KOLUMN}];
uniform sampler2D u_tlo;
uniform float u_maTlo;
uniform float u_czas;
uniform vec2 u_res;
uniform vec3 u_glebia, u_grzbiet, u_piana;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
}
vec4 kolumna(float x) {
    float f = clamp(x, 0.0, 1.0) * float(${KOLUMN - 1});
    int i = int(floor(f));
    int j = min(i + 1, ${KOLUMN - 1});
    return mix(u_kol[i], u_kol[j], fract(f));
}

void main() {
    vec2 uv = v_uv;
    float asp = u_res.x / u_res.y;
    vec4 k = kolumna(uv.x);
    float alfa = k.z;
    if (alfa < 0.003) { o = vec4(0.0); return; }
    float t = u_czas;
    // Powierzchnia faluje drobnym szumem; w gejzerze mocniej i szybciej w górę.
    float drgania = (fbm(vec2(uv.x * 9.0 * asp, t * 1.7)) - 0.5) * (0.012 + 0.03 * k.w);
    float pw = k.x + drgania;
    float d = uv.y - pw;                       // > 0 = pod powierzchnią
    float glab = clamp(d / max(0.08, 1.0 - pw), 0.0, 1.0);

    // Wnętrze: domain warp -> płynąca masa wody; gejzer ciągnie strukturę w górę.
    vec2 p = vec2(uv.x * asp, uv.y) * 3.0;
    vec2 q = vec2(fbm(p + vec2(0.0, t * (0.4 + 2.5 * k.w))), fbm(p + vec2(5.2, 1.3) - vec2(t * 0.3, 0.0)));
    float n = fbm(p * 1.6 + 3.0 * q);

    // Refrakcja tła: przesunięcie z szumu, mocniejsze w głębi.
    vec2 off = (q - 0.5) * (0.025 + 0.03 * glab);
    vec3 tlo = texture(u_tlo, clamp(uv + off, 0.001, 0.999)).rgb;
    vec3 woda = mix(u_grzbiet, u_glebia, smoothstep(0.0, 0.7, glab));
    woda *= 0.85 + 0.35 * n;
    // Kaustyki: jasne żyłki z ostrego grzbietu szumu.
    float kaus = pow(1.0 - abs(fbm(p * 2.5 + q * 2.0 + t * 0.6) * 2.0 - 1.0), 8.0);
    woda += u_piana * kaus * 0.35 * (1.0 - glab);
    vec3 kolor = mix(woda, tlo * vec3(0.55, 0.8, 0.95) + woda * 0.35, u_maTlo * (0.45 - 0.25 * glab));

    // Krawędź: ostra, antyaliasowana, z jasnym połyskiem (fresnel).
    float px = 1.5 / u_res.y;
    float wnetrze = smoothstep(-px, px, d);
    float polysk = exp(-abs(d) * u_res.y * 0.25);
    kolor += u_piana * polysk * 0.6;

    // Piana: pas pod grzbietem rwany szumem + spieniony słup gejzeru.
    float pas = smoothstep(0.045 + 0.05 * k.w, 0.0, d) * wnetrze;
    float rwanie = smoothstep(0.38, 0.62, fbm(vec2(uv.x * 40.0 * asp, uv.y * 30.0) - vec2(0.0, t * 2.0)));
    float spien = k.w * smoothstep(0.35, 0.7, fbm(vec2(uv.x * 22.0 * asp, uv.y * 9.0 + t * 3.5))) * wnetrze;
    float piana = clamp(pas * rwanie * (0.4 + 0.6 * k.y) + spien * 0.8, 0.0, 1.0);
    kolor = mix(kolor, u_piana, piana);

    // Pióropusz nad gejzerem: mgiełka kropel ponad powierzchnią.
    float nad = max(0.0, -d);
    float mgla = k.w * exp(-nad * 14.0) * smoothstep(0.45, 0.75, fbm(vec2(uv.x * 30.0 * asp, uv.y * 18.0 + t * 4.0)));

    float a = alfa * max(wnetrze * (0.82 + 0.15 * glab), mgla * 0.75);
    vec3 c = mix(u_piana, kolor, wnetrze);
    o = vec4(c * a, a);                          // premultiplied - drawImage oczekuje tego
}`;

export class WodaShader {
    constructor() {
        this._gl = null;
        this._stan = 'nowy';      // nowy | gotowy | brak
        this._kol = new Float32Array(KOLUMN * 4);
    }

    /** Leniwa inicjalizacja; false = brak WebGL2 (fallback Canvas2D). */
    gotowa() {
        if (this._stan === 'nowy') this._stan = this._inicjuj() ? 'gotowy' : 'brak';
        return this._stan === 'gotowy';
    }

    _inicjuj() {
        try {
            if (typeof document === 'undefined') return false;
            const cv = document.createElement('canvas');
            const gl = cv.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false });
            if (!gl) return false;
            const shader = (typ, zrodlo) => {
                const s = gl.createShader(typ);
                gl.shaderSource(s, zrodlo);
                gl.compileShader(s);
                if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
                return s;
            };
            const prog = gl.createProgram();
            gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
            gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
            gl.linkProgram(prog);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
            gl.useProgram(prog);
            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
            const loc = gl.getAttribLocation(prog, 'a_poz');
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            const u = (n) => gl.getUniformLocation(prog, n);
            this._u = { kol: u('u_kol'), tlo: u('u_tlo'), maTlo: u('u_maTlo'), czas: u('u_czas'), res: u('u_res'),
                        glebia: u('u_glebia'), grzbiet: u('u_grzbiet'), piana: u('u_piana') };
            gl.uniform1i(this._u.tlo, 0);
            this._gl = gl;
            this._cv = cv;
            return true;
        } catch (e) {
            console.warn('[wodaShader] WebGL2 niedostępny - Fala Mokoszy w Canvas2D:', e?.message ?? e);
            return false;
        }
    }

    /**
     * Renderuje wodę i wkleja ją na ctx.
     * @param {CanvasRenderingContext2D} ctx  płótno gry (jego zawartość = tło do refrakcji)
     * @param {Float32Array} kolumny  KOLUMN × [y 0..1, piana, alfa, gejzer]
     * @param {{czas:number, glebia:number[], grzbiet:number[], piana:number[]}} o  barwy 0..255
     */
    rysuj(ctx, kolumny, o) {
        if (!this.gotowa()) return false;
        const gl = this._gl, cv = this._cv, U = this._u;
        const zrodlo = ctx.canvas;
        const W = zrodlo?.width ?? 0, H = zrodlo?.height ?? 0;
        if (!(W > 0 && H > 0)) return false;
        const w = Math.max(2, Math.round(W / 2)), h = Math.max(2, Math.round(H / 2));
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
        gl.viewport(0, 0, w, h);
        let maTlo = 0;
        try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, zrodlo);
            maTlo = 1;
        } catch { maTlo = 0; }
        const b = (c) => c.map(v => v / 255);
        gl.uniform4fv(U.kol, kolumny);
        gl.uniform1f(U.maTlo, maTlo);
        gl.uniform1f(U.czas, o.czas);
        gl.uniform2f(U.res, w, h);
        gl.uniform3fv(U.glebia, b(o.glebia));
        gl.uniform3fv(U.grzbiet, b(o.grzbiet));
        gl.uniform3fv(U.piana, b(o.piana));
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.drawImage(cv, 0, 0, W, H);
        ctx.restore();
        return true;
    }
}
