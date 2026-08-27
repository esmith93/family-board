import { defineConfig } from 'vite'

export default defineConfig({
  /*
   * Relative asset paths.
   *
   * The brief asks for a static build "deployable to GitHub Pages or itch.io",
   * and neither of them serves from the root of a domain: Pages puts a project
   * site at /<repo>/ and itch.io serves from a hashed subpath. Vite's default
   * base of '/' emits the script tag as an absolute path, so the built page
   * came up blank on both - it asked for /assets/index.js and got the host's
   * 404. './' works in all three places, including at the root.
   */
  base: './',
  build: {
    // The whole game is meant to fit in five megabytes, so a warning at half
    // a megabyte is noise rather than news.
    chunkSizeWarningLimit: 1024,
  },
})
