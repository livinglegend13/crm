import { GTM_VIEW } from "./gtm-config";

export async function readSalesMaterial(file: File) {
	if (file.size > GTM_VIEW.material.maxFileBytes) {
		throw new Error("The file exceeds the 2 MB limit.");
	}
	const extension = file.name.toLowerCase().split(".").pop();
	let extracted: string;
	if (extension === "docx") {
		const mammoth = await import("mammoth");
		const result = await mammoth.extractRawText({
			arrayBuffer: await file.arrayBuffer(),
		});
		extracted = result.value;
	} else if (extension === "txt" || extension === "md") {
		extracted = await file.text();
	} else {
		throw new Error("Upload a DOCX, TXT, or Markdown file.");
	}
	if (!extracted.trim()) throw new Error("The file contains no readable text.");
	if (extracted.length > GTM_VIEW.material.maxCharacters) {
		throw new Error("The extracted text exceeds 100,000 characters.");
	}
	return extracted;
}
