// ============================================================================
// FENICIA · Sonido (docs/arte/Instrucciones_Sonidos.txt)
//  · Menú: música del menú en bucle.
//  · Juego: ambiente «Pueblo» en toda la ciudad y «Muelle» al acercar la cámara al muelle
//    (fundido entre ambos), en bucle. Al pausar el juego SÓLO el ambiente baja hasta 0 y se detiene;
//    al reanudar sube de 0 al volumen elegido. Música de juego: 7 pistas en orden aleatorio; sigue
//    sonando en pausa y NUNCA se acelera aunque el tiempo vaya a ×6.
//  · Efectos: abrir interfaz, anuncio emergente, botones del mercado, notificación, selección.
//  · Ajustes: volumen de música, ambiente y efectos (se guardan en el navegador).
// Los navegadores sólo permiten sonar tras un toque: unlock() se llama en el primer toque.
// ============================================================================
const BASE = './assets/audio';
// AAC (.m4a) si el navegador lo reproduce; si no, Ogg Opus (.ogg)
const EXT = (() => { try { return new Audio().canPlayType('audio/mp4; codecs="mp4a.40.2"') ? 'm4a' : 'ogg'; } catch { return 'm4a'; } })();
export type Sfx = 'abrir' | 'anuncio' | 'compra' | 'notificacion' | 'seleccion';
export interface Volumes { music: number; ambient: number; sfx: number }

const KEY = 'fenicia.audio';
function loadVol(): Volumes {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? ''); if (v && typeof v.music === 'number') return v; } catch { /* */ }
  return { music: 0.5, ambient: 0.6, sfx: 0.8 };
}

function track(src: string, loop: boolean): HTMLAudioElement {
  const a = new Audio(); a.src = src; a.loop = loop; a.preload = 'auto'; a.volume = 0;
  return a;
}

export class AudioManager {
  vol: Volumes = loadVol();
  unlocked = false;
  private mode: 'menu' | 'game' | 'none' = 'none';
  private menu = track(`${BASE}/ambiente/menu.${EXT}`, true);
  private pueblo = track(`${BASE}/ambiente/pueblo.${EXT}`, true);
  private muelle = track(`${BASE}/ambiente/muelle.${EXT}`, true);
  private songs = [1, 2, 3, 4, 5, 6, 7].map(i => `${BASE}/musica/juego0${i}.${EXT}`);
  private order: number[] = [];
  private song: HTMLAudioElement | null = null;
  private dockMix = 0;              // 0 = pueblo, 1 = muelle
  private ambPaused = false;
  private ambFade = 1;              // 0..1: fundido del ambiente al pausar/reanudar
  private sfxPool = new Map<Sfx, HTMLAudioElement[]>();

  constructor() {
    for (const n of ['abrir', 'anuncio', 'compra', 'notificacion', 'seleccion'] as Sfx[]) this.sfxPool.set(n, [0, 1, 2].map(() => track(`${BASE}/sfx/${n}.${EXT}`, false)));
  }

  save() { try { localStorage.setItem(KEY, JSON.stringify(this.vol)); } catch { /* */ } this.apply(); }

  /** Primer toque del jugador: a partir de aquí el navegador deja sonar. */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.setMode(this.mode === 'none' ? 'menu' : this.mode, true);
  }

  setMode(m: 'menu' | 'game', force = false) {
    if (m === this.mode && !force) return;
    this.mode = m;
    if (!this.unlocked) return;
    if (m === 'menu') {
      this.stopSong(); this.pueblo.pause(); this.muelle.pause();
      this.play(this.menu);
    } else {
      this.menu.pause();
      if (!this.ambPaused) { this.play(this.pueblo); this.play(this.muelle); }
      if (!this.song) this.nextSong();
    }
    this.apply();
  }

  /** Pausa del juego: el ambiente se funde a 0 y se detiene; la música sigue. */
  setGamePaused(paused: boolean) {
    if (paused === this.ambPaused) return;
    this.ambPaused = paused;
    if (!paused && this.mode === 'game' && this.unlocked) { this.play(this.pueblo); this.play(this.muelle); }
  }

  /** 0 = cámara en la ciudad, 1 = cámara en el muelle. Fundido suave entre ambientes (se llama cada fotograma). */
  setDockMix(t: number, dt = 1 / 60) {
    this.dockMix += (Math.max(0, Math.min(1, t)) - this.dockMix) * 0.08;
    const target = this.ambPaused ? 0 : 1;
    this.ambFade = target > this.ambFade ? Math.min(1, this.ambFade + dt / 1.2) : Math.max(0, this.ambFade - dt / 0.8);
    if (this.ambPaused && this.ambFade <= 0) { if (!this.pueblo.paused) this.pueblo.pause(); if (!this.muelle.paused) this.muelle.pause(); }
    this.apply();
  }

  sfx(n: Sfx) {
    if (!this.unlocked || this.vol.sfx <= 0) return;
    const pool = this.sfxPool.get(n)!;
    const a = pool.find(x => x.paused || x.ended) ?? pool[0];
    a.volume = this.vol.sfx; a.currentTime = 0;
    a.play().catch(() => { /* bloqueado */ });
  }

  private play(a: HTMLAudioElement) { a.play().catch(() => { /* el navegador aún no deja */ }); }
  private stopSong() { if (this.song) { this.song.pause(); this.song = null; } }
  private nextSong() {
    if (!this.order.length) this.order = [0, 1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5);
    const i = this.order.shift()!;
    this.stopSong();
    const a = track(this.songs[i], false);
    a.addEventListener('ended', () => { if (this.song === a) this.nextSong(); });
    this.song = a;
    a.playbackRate = 1;                       // la música nunca se acelera
    this.apply();
    if (this.mode === 'game') this.play(a);
  }
  private apply() {
    this.menu.volume = this.vol.music;
    if (this.song) this.song.volume = this.vol.music * 0.7;
    this.pueblo.volume = this.vol.ambient * (1 - this.dockMix) * 0.8 * this.ambFade;
    this.muelle.volume = this.vol.ambient * this.dockMix * 0.8 * this.ambFade;
  }
}
