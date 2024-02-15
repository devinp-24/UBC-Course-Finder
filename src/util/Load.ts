import * as fse from "fs-extra";
import * as fs from "fs";
import {InsightDatasetKind} from "../controller/IInsightFacade";
import CourseData from "../dataModels/CourseData";
import Section from "../dataModels/Section";

export class Load {
	// public async loadDataset(id: string): Promise<CourseData | undefined> {
	// 	const filePath = `./data/${id}.json`;
	// 	try {
	// 		if (await fse.pathExists(filePath)) {
	// 			const data = await fse.readJson(filePath);
	//
	// 			// Assuming the CourseData constructor can take this data directly
	// 			// or you have a method to transform this data back into the correct format.
	// 			const dataset = new CourseData(data.id, data.kind, this.transformSections(data.sections));
	// 			return dataset;
	// 		}
	// 		return undefined; // Dataset file does not exist
	// 	} catch (error) {
	// 		console.error(`Failed to load dataset ${id}:`, error);
	// 		return undefined; // Handle errors (e.g., file read errors) gracefully
	// 	}
	// }
	//
	// private transformSections(sections: any[]): any[] {
	// 	// Transform the sections data back into the format expected by CourseData
	// 	// This might involve instantiating Section objects or another transformation
	// 	// depending on how your CourseData class expects to receive this data.
	// 	return sections.map((section) => {
	// 		// Example transformation, adjust according to your actual data structure
	// 		return new Section(
	// 			section.uuid,
	// 			section.course_id,
	// 			section.title,
	// 			section.instructor,
	// 			section.dept,
	// 			section.year,
	// 			section.avg,
	// 			section.pass,
	// 			section.fail,
	// 			section.audit,
	// 		);
	// 	});
	// }
	//
	public async loadExistingDatasets(): Promise<{datasetCollection: string[], courseDataCollection: CourseData[]}> {
		let datasetCollection: string[] = [];
		let courseDataCollection: CourseData[] = [];

		try {
			const files = await fse.readdir("./data");
			const jsonFiles = files.filter((file) => file.endsWith(".json"));
			const readJsonPromises = jsonFiles.map((file) => {
				return fse.readJson(`./data/${file}`);
			});

			const datasets = await Promise.all(readJsonPromises);

			datasets.forEach((data, index) => {
				const id = jsonFiles[index].replace(".json", "");
				datasetCollection.push(id);
				const kind = data.kind as InsightDatasetKind;
				const sections = data.sections;
				const dataset = new CourseData(id, kind, sections);
				courseDataCollection.push(dataset);
			});
		} catch (error) {
			console.error("Error loading datasets from disk:", error);
			// Depending on your needs, you may want to handle errors differently
			// For simplicity, we'll just log the error and continue
		}

		return {datasetCollection, courseDataCollection};
	}

	public async checkDatasetExists(id: string): Promise<boolean> {
		const dataDir = "./data"; // Adjust based on your project directory structure
		const filePath = `${dataDir}/${id}.json`;
		try {
			// Using fs.access to check for the existence of the file
			await fse.access(filePath);
			return true; // The file exists
		} catch (error) {
			return false; // The file does not exist
		}
	}

	public checkDatasetExistsSync(id: string, callback: (exists: boolean) => void): void {
		const dataDir = "./data"; // Adjust based on your project directory structure
		const filePath = `${dataDir}/${id}.json`;
		fse.pathExists(filePath)
			.then((exists) => callback(exists))
			.catch(() => callback(false));
	}
}
