import { defineConfig } from "astro/config";
import siena from "../src";

// https://astro.build/config
export default defineConfig({
	integrations: [siena()]
});
