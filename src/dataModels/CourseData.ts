import {InsightDataset, InsightDatasetKind} from "../controller/IInsightFacade";
import Section from "./Section";

export default class CourseData {

	public id: string;
	public insightDatasetKind: InsightDatasetKind;
	public insightDataset: InsightDataset;
	public sections: Section[];

	constructor(id: string, insightDatasetKind: InsightDatasetKind, coursesList: string[]) {
		this.id = id;
		this.insightDatasetKind = insightDatasetKind;
		this.sections = [];
		this.insightDataset = {id: id, kind: insightDatasetKind, numRows: this.sections.length};

		for (let course of coursesList) {
			let parsedSection: JSON;
			parsedSection = JSON.parse(course);
			this.parse(parsedSection);
		}
	}

	public parse(courses: any) {
		for (let counter of courses) {
			let uuid = courses.result[counter].id;
			let courseID = courses.result[counter].Course;
			let title = courses.result[counter].Title;
			let instructor = courses[counter].result.Professor;
			let dept = courses.result[counter].Subject;
			let year = courses.result[counter].Year;
			let avg = courses.result[counter].Avg;
			let pass = courses.result[counter].Pass;
			let fail = courses.result[counter].Fail;
			let audit = courses.result[counter].Audit;

			if (courses.result[counter].Section === "overall") {
				year = 1900;
			}

			let section = new Section(uuid, courseID, title, instructor, dept, year, avg,
				pass, fail, audit);
			this.sections.push(section);
		}
		this.insightDataset.numRows = this.sections.length;
	}
}
