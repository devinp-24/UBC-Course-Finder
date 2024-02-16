import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError, ResultTooLargeError
} from "./IInsightFacade";
import Section from "../dataModels/Section";
import JSZip from "jszip";
import CourseData from "../dataModels/CourseData";
import {Parser} from "../query/Parser";
import {Validator} from "../query/Validator";
import {Executor} from "../query/Executor";
import * as fse from "fs-extra";
/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	private datasetCollection: string[] = [];
	private courseDataCollection: CourseData[] = [];
	private queryParser: Parser;
	private queryValidator: Validator;
	private queryExecutor: Executor;
	constructor() {
		console.log("InsightFacadeImpl::init()");
		this.queryParser = new Parser();
		this.queryValidator = new Validator();
		this.queryExecutor = new Executor();
		// this.loader.loadExistingDatasets().then(({datasetCollection, courseDataCollection}) => {
		// 	this.datasetCollection = datasetCollection;
		// 	this.courseDataCollection = courseDataCollection;
		// 	console.log("Datasets initialized successfully");
		// }).catch((error) => {
		// 	console.error("Failed to initialize datasets", error);
		// });
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
		return new Promise<string>((resolve, reject) => {
			try {
				if (!id || id.includes("_") || id.trim() === "") {
					throw new InsightError("Invalid ID");
				}

				const index = this.datasetCollection.indexOf(id);
				if (index === -1) {
					throw new NotFoundError("Dataset not found");
				}

				this.datasetCollection.splice(index, 1);
				this.courseDataCollection.splice(index, 1);

				resolve(id);
			} catch (error) {
				reject(error);
			}
		});
	}


	public async performQuery(query: unknown): Promise<InsightResult[]> {
		const MAX_RESULTS = 5000;
		try {
			// Use QueryParser to parse the query
			const parsedQuery = this.queryParser.parseQuery(query);
			const validatedQuery = this.queryValidator.validateQuery(parsedQuery);

			// Step 2: Retrieve the dataset referenced in the query
			const datasetId = this.queryExecutor.extractDatasetId(parsedQuery);
			const dataset = this.courseDataCollection[this.datasetCollection.indexOf(datasetId)];
			if (!dataset) {
				throw new InsightError("Dataset not found");
			}

			// Step 3: Apply filters defined in the WHERE clause
			const filteredResults = this.queryExecutor.applyFilters(dataset, parsedQuery.WHERE);

			// Step 4: Apply sorting and column selection based on OPTIONS
			const finalResults = this.queryExecutor.formatResults(filteredResults, parsedQuery.OPTIONS);
			// console.log(finalResults.length);
			// Step 5: Check for result size constraints
			if (finalResults.length > MAX_RESULTS) {
				throw new ResultTooLargeError("The query results exceed the allowed limit.");
			}

			return finalResults;
		} catch (error) {
			if (error instanceof ResultTooLargeError) {
				throw new ResultTooLargeError("ll");
			} else {
				throw new InsightError("l");
			}
		}
	}


	public async listDatasets(): Promise<InsightDataset[]> {
		return new Promise<InsightDataset[]>((resolve, reject) => {
			try {
				const datasetList: InsightDataset[] = [];
				for (const courseData of this.courseDataCollection) {
					datasetList.push(courseData.insightDataset);
				}
				resolve(datasetList);
			} catch (error) {
				reject(new InsightError("Failed to list datasets"));
			}
		});
	}
}

