import type {
	Root,
	RootContent,
	Element as HastElementObject,
	ElementContent as HastElementContent
} from "hast";
import type { VFile } from "vfile";

import path from "path";
import fs from "fs";
import crypto from "crypto";
import { imageSize as calculateImageSize } from "image-size";
import sharp from "sharp";

let outputDir = "public";
let imgLoading = "lazy";

type AstroVFile = Omit<VFile, "data"> & {
	data: {
		astro: Record<string, any>;
	};
};

const generateFileHash = (data: string) => {
	return crypto
		.createHash("shake256", {
			outputLength: 21
		})
		.update(data)
		.digest("hex");
};

const safeUrlParse = (maybeUrl: string) => {
	try {
		return new URL(maybeUrl);
	} catch {
		return null;
	}
};

type ImageFormat = "avif" | "webp" | "jpg";
const additionalImageFormats = [
	"webp",
	"avif"
] as const satisfies readonly ImageFormat[];
const storedGeneratedImageHashes = new Set<string>();
const mdImageHashes = new Set<string>();

class HastElement implements HastElementObject {
	public readonly type = "element";
	public children;
	public tagName;
	public properties?;
	constructor(
		tagName: string,
		options: {
			properties?: Record<
				any,
				string | number | boolean | (string | number)[] | null | undefined
			>;
			children?: HastElementContent[];
		}
	) {
		this.tagName = tagName;
		this.children = options.children ?? [];
		this.properties = options.properties;
	}
}

const handleImageElement = async (
	element: HastElement,
	markdownLocation: string | null,
	cwd: string
) => {
	if (element.tagName !== "img" || !element.properties) return;
	if (!markdownLocation) return;
	if (element.properties.__siena) return;
	const imgSrc = element.properties.src?.toString() ?? null;
	const imgAlt = element.properties.alt?.toString() ?? null;
	if (!imgSrc) return;
	const getBaseImageData = async (src: string) => {
		const remoteImgUrl = safeUrlParse(src);
		if (!remoteImgUrl) {
			const imagePath = path.join(
				imgSrc.startsWith(".") ? path.dirname(markdownLocation) : cwd,
				imgSrc
			);
			return fs.readFileSync(imagePath);
		}
		const response = await fetch(src);
		const data = await response.arrayBuffer();
		return Buffer.from(data);
	};
	const imageData = await getBaseImageData(imgSrc);
	const baseImage = calculateImageSize(imageData);
	if (!baseImage.width) return;
	element.tagName = "picture";
	element.properties = {};
	const imageHash = generateFileHash(imageData.toString());
	mdImageHashes.add(imageHash);
	if (!storedGeneratedImageHashes.has(imageHash)) {
	}
	const sienaDirPath = path.join(cwd, `public`, ".siena");
	const imageWidth = baseImage.width > 1920 ? 1920 : baseImage.width;
	const sharpImage = sharp(imageData);
	type ImageMetaData = {
		width: number;
		height: number;
		fileName: string;
	};
	const getGeneratedImageMetaData = async (
		format: ImageFormat
	): Promise<ImageMetaData> => {
		const getExistingImageMetaData = (): ImageMetaData | null => {
			if (!storedGeneratedImageHashes.has(imageHash)) return null;
			// image-size doesn't support avif
			// all formats have the same size so use jpg version
			const imageFileName = [imageHash, "jpg"].join(".");
			const imageFile = fs.readFileSync(path.join(sienaDirPath, imageFileName));
			const imageSize = calculateImageSize(imageFile);
			if (!imageSize.width || !imageSize.height) return null;
			return {
				fileName: imageFileName,
				width: imageSize.width,
				height: imageSize.height
			};
		};
		const generateImage = async (): Promise<ImageMetaData> => {
			const imageFileName = `${imageHash}.${format}`;
			const outputPath = path.join(sienaDirPath, imageFileName);
			const outputImage = await sharpImage
				.resize(imageWidth)
				.toFile(outputPath);
			return {
				fileName: imageFileName,
				width: outputImage.width,
				height: outputImage.height
			};
		};
		const existingImageMetaData = getExistingImageMetaData();
		if (existingImageMetaData) return existingImageMetaData;
		return await generateImage();
	};
	const generatedJpgImageMetadata = await getGeneratedImageMetaData("jpg");
	const imageElement = new HastElement("img", {
		properties: {
			__siena: true,
			src: path.join("/.siena", generatedJpgImageMetadata.fileName),
			width: generatedJpgImageMetadata.width,
			height: generatedJpgImageMetadata.height,
			loading: imgLoading,
			alt: imgAlt
		}
	});
	element.children.push(imageElement);
	for (const additionalImageFormat of additionalImageFormats) {
		const generatedImageMetaData = await getGeneratedImageMetaData(
			additionalImageFormat
		);
		const sourceElement = new HastElement("source", {
			properties: {
				srcset: path.join("/.siena", generatedImageMetaData.fileName)
			}
		});
		element.children.push(sourceElement);
	}
	storedGeneratedImageHashes.add(imageHash);
};

const readContent = async (content: Root | RootContent, file: AstroVFile) => {
	if (content.type !== "element" && content.type !== "root") return;
	if (content.type === "element") {
		await handleImageElement(content, file.history[0] ?? null, file.cwd);
	}
	await Promise.all(
		content.children.map((children) => readContent(children, file))
	);
};

export type PluginOptions = {
	outputDir?: string;
	loading?: "lazy" | "eager";
};

const plugin = async (root: Root, file: VFile) => {
	const sienaDirPath = path.join(file.cwd, "public", ".siena");
	if (!fs.existsSync(sienaDirPath)) {
		fs.mkdirSync(sienaDirPath, {
			recursive: true
		});
	}
	const preExistingGeneratedImageFileNames = fs.readdirSync(sienaDirPath);
	storedGeneratedImageHashes.clear();
	for (const imageFileName of preExistingGeneratedImageFileNames) {
		const imageHash = imageFileName.split(".")[0];
		storedGeneratedImageHashes.add(imageHash);
	}
	const astroFile = file as AstroVFile;
	await readContent(root, astroFile);
	const postGeneratedImageFileNames = fs.readdirSync(sienaDirPath);
	for (const imageHash of storedGeneratedImageHashes) {
		if (mdImageHashes.has(imageHash)) continue;
		const targetImageFileNames = postGeneratedImageFileNames.filter(
			(fileName) => fileName.startsWith(`${imageHash}.`)
		);
		for (const targetImageFileName of targetImageFileNames) {
			const targetFilePath = path.join(sienaDirPath, targetImageFileName);
			fs.rmSync(targetFilePath);
		}
	}
};

export default (options?: PluginOptions) => {
	outputDir = options?.outputDir ?? outputDir;
	imgLoading = options?.loading ?? "lazy";
	return plugin;
};
