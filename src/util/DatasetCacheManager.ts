import * as fse from "fs-extra";
import {InsightDataset, InsightDatasetKind, InsightError} from "../controller/IInsightFacade";
import * as path from "path";
export class DatasetCacheManager {
	private dataDir = "./data/"; // Class property

	// these helper methods were created with the help of chatGPT
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
}

