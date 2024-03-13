import CourseData from "../dataModels/CourseData";
import JSZip from "jszip";
import {InsightDatasetKind, InsightError} from "../controller/IInsightFacade";

export class AddSectionsHelper {

	public async addSectionsDataset(id: string, content: string, idCollection: string[],
		dataCollection: any[]): Promise<string[]> {

		let dataset: CourseData;
		let filePromises = Array<Promise<string>>();

		const zip = await JSZip.loadAsync(content, {base64: true});
		const coursesFolder = zip.folder("courses");

		if (!coursesFolder) {
			throw new InsightError("Folder does not exist in the zip file");
		}

		coursesFolder.forEach((relativePath, file) => {
			filePromises.push(file.async("text"));
		});

		const filesContent: string[] = await Promise.all(filePromises);
		dataset = new CourseData(id, InsightDatasetKind.Sections, filesContent);

		if (dataset.sections.length === 0) {
			throw new InsightError("No valid sections to add");
		}

		idCollection.push(id);
		dataCollection.push(dataset);

		return idCollection;
	}
}
