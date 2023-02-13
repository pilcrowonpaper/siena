# Siena

A Rehype plugin for Astro that makes working with images inside markdown easier.

- **Relative image paths**: Now you can view all your images inside markdown in text editors and on Github
- **Image optimization**: Converts all images to newer formats (`avif`, `webp`)

### How it works

It will find all images used in your markdown files, convert it to `avif`, `webp`, `jpg`, store them inside `.siena` directory (which is inside `public` or the specified directory), and replace all `<img/>` with `<picture/>` elements.

### Options

- `outputDir` (`string`): Where Siena will generate a `.siena` directory
- `loading` (`lazy` default, `eager`)
