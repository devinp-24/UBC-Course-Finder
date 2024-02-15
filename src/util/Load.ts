import * as fse from "fs-extra";
import * as fs from "fs";
import {InsightDatasetKind} from "../controller/IInsightFacade";
import CourseData from "../dataModels/CourseData";
import Section from "../dataModels/Section";

export class Load {
	public async loadDataset(id: string): Promise<CourseData | undefined> {
		const filePath = `./data/${id}.json`;
		try {
			if (await fse.pathExists(filePath)) {
				const data = await fse.readJson(filePath);

				// Assuming the CourseData constructor can take this data directly
				// or you have a method to transform this data back into the correct format.
				const dataset = new CourseData(data.id, data.kind, this.transformSections(data.sections));
				return dataset;
			}
			return undefined; // Dataset file does not exist
		} catch (error) {
			console.error(`Failed to load dataset ${id}:`, error);
			return undefined; // Handle errors (e.g., file read errors) gracefully
		}
	}

	private transformSections(sections: any[]): any[] {
		// Transform the sections data back into the format expected by CourseData
		// This might involve instantiating Section objects or another transformation
		// depending on how your CourseData class expects to receive this data.
		return sections.map((section) => {
			// Example transformation, adjust according to your actual data structure
			return new Section(
				section.uuid,
				section.course_id,
				section.title,
				section.instructor,
				section.dept,
				section.year,
				section.avg,
				section.pass,
				section.fail,
				section.audit,
			);
		});
	}

	public async loadExistingDatasets(): Promise<{datasetCollection: string[], courseDataCollection: CourseData[]}> {
		let datasetCollection: string[] = [];
		let courseDataCollection: CourseData[] = [];
		let dataset: CourseData;
		try {
			const files = await fse.readdir("./data");
			const datasetIds = files.filter((file) => file.endsWith(".json")).map((file) => file.replace(".json", ""));

			for (const id of datasetIds) {
				const filePath = `./data/${id}.json`;
				// eslint-disable-next-line no-await-in-loop
				let data = await fse.readJson(filePath);
				datasetCollection.push(id);
				const kind = data.kind as InsightDatasetKind;
				// Assuming the structure of data in JSON matches what CourseData expects
				const sections = data.sections;
				// console.log(sections[5]);
				// console.log(sections[1000]);
				// console.log(sections[5943]);
				// console.log(sections[5944]);
				// console.log(sections[5945]);
				dataset = new CourseData(id, kind, sections);
				courseDataCollection.push(dataset);
			}
		} catch (error) {
			console.error("Error loading datasets from disk:", error);
			// Depending on your needs, you may want to handle errors differently
			// For simplicity, we'll just log the error and continue
		}
		// console.log(datasetCollection);
		return {datasetCollection, courseDataCollection};
	}
}
