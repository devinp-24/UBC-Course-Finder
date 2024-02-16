import * as fse from "fs-extra";
import {InsightDataset, InsightDatasetKind, InsightError} from "../controller/IInsightFacade";
import * as path from "path";
import CourseData from "../dataModels/CourseData";
export class DatasetCacheManager {
	private dataDir = "./data/"; // Class property

	public async saveDataset(id: string, data: any): Promise<void> {
		await fse.ensureDir(this.dataDir); // Use the class property
		const filePath = `${this.dataDir}${id}.json`;
		await fse.writeJson(filePath, data);
	}

	public async removeDataset(id: string): Promise<void> {
		const filePath = `${this.dataDir}${id}.json`; // Use the class property
		try {
			await fse.remove(filePath);
			console.log(`Dataset ${id} removed successfully from disk.`);
		} catch (error) {
			console.error(`Error removing dataset ${id} from disk: ${error}`);
			throw new InsightError("o");
		}
	}

	public async listDatasetIds(): Promise<string[]> {
		try {
			const files = await fse.readdir(this.dataDir);
			const ids = files
				.filter((file) => path.extname(file) === ".json")
				.map((file) => path.basename(file, ".json"));
			return ids;
		} catch (error) {
			console.error(`Error listing dataset IDs: ${error}`);
			throw new InsightError("Failed to list dataset IDs from disk.");
		}
	}

	public async loadDataset(id: string): Promise<CourseData> {
		const filePath = path.join(this.dataDir, `${id}.json`);
		try {
			// Assuming data is read correctly as an object from the JSON file
			const data = await fse.readJson(filePath);
			console.log(data);
			// Extract the sections array from the loaded data
			const sectionsArray = data.sections;

			// Now pass this sectionsArray to the CourseData constructor
			// Also, make sure to pass the correct InsightDatasetKind, which you might need to determine based on the data
			const datasetKind = data.insightDatasetKind = InsightDatasetKind.Sections;
			return new CourseData(id, datasetKind, sectionsArray);
		} catch (error) {
			console.error(`Error loading dataset ${id} from disk: ${error}`);
			throw new Error(`Failed to load dataset ${id} from disk.`);
		}
	}
}

