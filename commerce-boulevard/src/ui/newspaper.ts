/**
 * The Fairview Ledger, as printed.
 *
 * Everything on this page came from `composeFrontPage`, which knows nothing
 * about the simulation beyond one year's observation. This module knows even
 * less: it sets type, screens the photograph, and gets out of the way.
 *
 * The photograph is a crop of the live corridor, taken at the place the lead
 * story is about, put through a coarse dot screen. It is the only picture in
 * the game the player is shown rather than allowed to look at, and it is
 * deliberately bad - a small paper's photograph, not an illustration.
 */

import { IsometricRenderer } from '../render/renderer'
import { halftone } from '../render/photo'
import type { Scene } from '../render/scene'
import type { LightName, SeasonName } from '../render/palette'
import type { FrontPage } from '../paper/paper'
import type { Story } from '../paper/stories'

const PHOTO_W = 468
const PHOTO_H = 286

/**
 * The paper's one camera. Kept alive between years so the sprite cache is
 * built once, rather than re-rasterising the whole corridor every December.
 */
class PhotoDesk {
  private readonly plate = document.createElement('canvas')
  private readonly renderer: IsometricRenderer
  private sceneId = -1

  constructor() {
    this.plate.width = PHOTO_W
    this.plate.height = PHOTO_H
    this.renderer = new IsometricRenderer(this.plate)
    // Wide enough to take in the whole cross-section: the carriageway, both
    // frontages and whatever is standing on them. An isometric view held too
    // close reads as texture, not as a street.
    this.renderer.camera.zoom = 0.8
  }

  /** Shoot the corridor at `at` (0 west, 1 east) and screen it for the press. */
  shoot(scene: Scene, id: number, at: number, season: SeasonName, light: LightName): Uint8ClampedArray | null {
    const ctx = this.plate.getContext('2d')
    if (!ctx) return null
    if (id !== this.sceneId) {
      this.renderer.setScene(scene)
      this.sceneId = id
    }
    this.renderer.setSeason(season)
    this.renderer.setLight(light)
    // Stand the photographer in the middle of the carriageway, which is where
    // a local paper's photographer would in fact stand.
    const roadRow = scene.lanes.length > 0
      ? scene.lanes.reduce((sum, lane) => sum + lane.gy, 0) / scene.lanes.length
      : 34
    this.renderer.lookAt(at, roadRow)
    this.renderer.camera.gy = roadRow
    this.renderer.render(performance.now())
    const raw = ctx.getImageData(0, 0, PHOTO_W, PHOTO_H)
    return halftone(raw.data, PHOTO_W, PHOTO_H, { cell: 3, angle: 45, gamma: 1.3, autoLevels: true })
  }
}

let desk: PhotoDesk | null = null

export interface PaperShot {
  scene: Scene
  /** Changes whenever the corridor is rebuilt, so the camera reloads. */
  sceneId: number
  season: SeasonName
  light: LightName
}

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const storyBlock = (story: Story, cls: string): string => `
  <article class="${cls}">
    <h3>${escapeHtml(story.headline)}</h3>
    ${story.subhead ? `<p class="sub">${escapeHtml(story.subhead)}</p>` : ''}
    ${story.body ? `<p class="body">${escapeHtml(story.body)}</p>` : ''}
  </article>`

/**
 * Print the front page and wait for the reader to put it down.
 *
 * Resolves when the player dismisses it, so the caller can carry straight on
 * into the next year.
 */
export function showFrontPage(page: FrontPage, shot: PaperShot): Promise<void> {
  const veil = document.getElementById('paper')!
  const sheet = document.getElementById('papersheet')!

  const briefs = page.briefs.map((b) => `<li>${escapeHtml(b.headline)}</li>`).join('')
  const letter = page.letter
    ? `<div class="letters">
         <h4>Letters to the Editor</h4>
         <p>${escapeHtml(page.letter.text)}</p>
         <p class="sig">&mdash; ${escapeHtml(page.letter.signature)}</p>
       </div>`
    : ''

  sheet.innerHTML = `
    <div class="masthead">
      <div class="rule"></div>
      <h1>${escapeHtml(page.masthead)}</h1>
      <div class="rule"></div>
      <div class="folio">
        <span>${escapeHtml(page.volume)}</span>
        <span>${escapeHtml(page.dateline)}</span>
        <span>${escapeHtml(page.price)}</span>
      </div>
    </div>
    <div class="columns">
      <div class="col lead">
        ${storyBlock(page.lead, 'top')}
        ${page.photo ? `<figure><canvas id="paperphoto" width="${PHOTO_W}" height="${PHOTO_H}"></canvas>
           <figcaption>${escapeHtml(page.photo.caption)}</figcaption></figure>` : ''}
      </div>
      <div class="col side">
        ${page.seconds.map((s) => storyBlock(s, 'second')).join('')}
        ${briefs ? `<div class="briefs"><h4>In Brief</h4><ul>${briefs}</ul></div>` : ''}
        ${letter}
      </div>
    </div>
    <button class="fold" id="paperclose">Put the paper down</button>`

  if (page.photo) {
    const canvas = document.getElementById('paperphoto') as HTMLCanvasElement | null
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      desk ??= new PhotoDesk()
      const screened = desk.shoot(shot.scene, shot.sceneId, page.photo.at, shot.season, shot.light)
      if (screened) {
        const image = ctx.createImageData(PHOTO_W, PHOTO_H)
        image.data.set(screened)
        ctx.putImageData(image, 0, 0)
      }
    }
  }

  veil.classList.remove('hidden')
  veil.classList.toggle('turned', page.turned)
  sheet.scrollTop = 0

  return new Promise((resolve) => {
    const done = (): void => {
      veil.classList.add('hidden')
      document.removeEventListener('keydown', onKey)
      resolve()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') done()
    }
    document.getElementById('paperclose')!.addEventListener('click', done, { once: true })
    document.addEventListener('keydown', onKey)
  })
}
