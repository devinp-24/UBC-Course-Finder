import {InsightDataset, InsightDatasetKind} from "../controller/IInsightFacade";
import Section from "./Section";

export default class CourseData {
	public id: string;
	public insightDatasetKind: InsightDatasetKind;
	public insightDataset: InsightDataset;
	public sections: Section[];

	constructor(id: string, insightDatasetKind: InsightDatasetKind, coursesList: any[]) {
		this.id = id;
		this.insightDatasetKind = insightDatasetKind;
		this.sections = [];
		this.insightDataset = {id: id, kind: insightDatasetKind, numRows: this.sections.length};

		// let counter = 0;

		for (let course of coursesList) {
			let parsedCourse = JSON.parse(course);
			this.parse(parsedCourse);
			// counter++;
			// console.log(counter);
		}
		// console.log(this.sections);
	}

	public parse(courses: any) {
		if (!courses || !courses.result || !Array.isArray(courses.result)) {
			throw new Error("Invalid JSON format");
		}

		for (let course of courses.result) {
			let uuid = course.id;
			let courseID = course.Course;
			let title = course.Title;
			let instructor = course.Professor; // Corrected property name
			let dept = course.Subject;
			let year = course.Year;
			let avg = course.Avg;
			let pass = course.Pass;
			let fail = course.Fail;
			let audit = course.Audit;
			if (course.Section === "overall") { // Corrected property name
				year = 1900;
			}
			let section = new Section(uuid, courseID, title, instructor, dept, year, avg, pass, fail, audit);
			this.sections.push(section);
		}

		this.insightDataset.numRows = this.sections.length;
	}
}
