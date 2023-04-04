# Siena

An Astro integration that makes working with images inside markdown easier.

- **Any image source**: Now you can use relative or absolute images and view all your markdown images in text editors and on Github
- **Image optimization**: Converts all images to newer formats (`avif`, `webp`)

### Setup

1. Install Siena as a dev dependency:

```
npm i -D siena
pnpm add -D siena
yarn add -D siena
```

2. Add Siena as a Astro integration in Astro config (`astro.config.cjs`):

```ts
import siena from "siena";

// https://astro.build/config
export default defineConfig({
	integrations: [siena()]
});
```

3. Add `public/.siena` to `.gitignore`:

```
public/.siena
```

### How it works

It will find all images used in your markdown files, convert it to `avif`, `webp`, `jpg`, store them inside `.siena` directory (which is inside `public` or the specified directory), and replace all `<img/>` with `<picture/>` elements.

### Options

```ts
import siena from "siena";

// https://astro.build/config
export default defineConfig({
	integrations: [
		siena({
			loading: "eager"
		})
	]
});
```

- `outputDir` (`string`): Where Siena will generate a `.siena` directory
- `loading` (`lazy` default, `eager`)
