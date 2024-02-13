import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError
} from "./IInsightFacade";
import {getContentFromArchives} from "../../test/TestUtil";
import Section from "../dataModels/Section";
import JSZip from "jszip";
import CourseData from "../dataModels/CourseData";
/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	private datasetCollection: string[] = [];
	private courseDataCollection: CourseData[] = [];
	constructor() {
		console.log("InsightFacadeImpl::init()");
	}

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		let zipFile = JSZip();
		let info = Array<Promise<string>>();
		let functionPromise: Promise<string[]>;
		let dataset: CourseData;
		return new Promise<string[]>((resolve, reject) => {
			try {
				if (!id || id.includes("_") || id.trim() === "") {
					throw new InsightError("Invalid ID");
				}
				if (this.datasetCollection.includes(id)) {
					throw new InsightError("ID already exists");
				}
				if (kind !== InsightDatasetKind.Sections) {
					throw new InsightError("Invalid Kind Type");
				}
				if (content === null) {
					throw new InsightError("Content should not be empty");
				}
				zipFile.loadAsync(content, {base64: true})
					.then((zip: JSZip) => {
						if (Object.keys(zip.files)[0] !== "courses/") {
							return reject(new InsightError("Folder does not exist in the zip file"));
						}
						const coursesFolder = zip.folder("courses");
						if (!coursesFolder) {
							throw new InsightError("Folder does not exist in the zip file");
						}
						coursesFolder.forEach(function (relativePath, file) {
							info.push(file.async("text"));
						});
						Promise.all(info).then((promise: string[]) => {
							dataset = new CourseData(id, kind, promise);
							if (dataset.sections.length === 0) {
								return reject(new InsightError("No valid sections to add"));
							}
							this.datasetCollection.push(id);
							this.courseDataCollection.push(dataset);
							resolve(this.datasetCollection);
						}).catch((err: any) => {
							reject("Error");
						});
					}).catch((err: any) => {
						reject(new InsightError("Failed to add dataset"));
					});
			} catch (error) {
				reject(error);
			}
		});
	}

	public async removeDataset(id: string): Promise<string> {
		return Promise.reject("Not implemented.");

	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		return Promise.reject("Not implemented.");
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		return Promise.reject("Not implemented.");
	}
}
