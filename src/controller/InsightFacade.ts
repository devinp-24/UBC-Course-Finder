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
import * as fs from "fs";
import {Load} from "../util/Load";
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
	private loader: Load;

	constructor() {
		console.log("InsightFacadeImpl::init()");
		this.queryParser = new Parser();
		this.queryValidator = new Validator();
		this.queryExecutor = new Executor();
		this.loader = new Load();
		this.loader.loadExistingDatasets().then(({datasetCollection, courseDataCollection}) => {
			this.datasetCollection = datasetCollection;
			this.courseDataCollection = courseDataCollection;
			console.log("Datasets initialized successfully");
		}).catch((error) => {
			console.error("Failed to initialize datasets", error);
		});
	}

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		let zipFile = JSZip();
		let info = Array<Promise<string>>();
		let dataset: CourseData;
		const checkIdExists = await this.loader.checkDatasetExists(id);
		return new Promise<string[]>((resolve, reject) => {
			try {
				if (!id || id.includes("_") || id.trim() === "" || !(checkIdExists) ||
					kind !== InsightDatasetKind.Sections || content === null) {
					throw new InsightError("Error");
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
						Promise.all(info).then(async (promise: string[]) => {
							dataset = new CourseData(id, kind, promise);
							if (dataset.sections.length === 0) {
								return reject(new InsightError("No valid sections to add"));
							}
							// this.datasetCollection.push(id);
							// this.courseDataCollection.push(dataset);
							await fse.ensureDir("./data");
							const filePath = `./data/${id}.json`;
							await fse.writeJson(filePath, {
								id: id,
								kind: kind,
								sections: dataset.sections
							});
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

	public removeDataset(id: string): Promise<string> {
		if (!id || id.includes("_") || id.trim() === "") {
			return Promise.reject(new InsightError("Invalid ID"));
		}

		const index = this.datasetCollection.indexOf(id);
		if (index === -1) {
			return Promise.reject(new NotFoundError("Dataset not found"));
		}

		// Prepare for removal from internal state
		this.datasetCollection.splice(index, 1);
		this.courseDataCollection.splice(index, 1); // Assuming corresponding index

		// Path to the dataset file
		const filePath = `./data/${id}.json`;

		// Start the promise chain
		return fse.pathExists(filePath)
			.then((exists) => {
				if (exists) {
					return fse.remove(filePath); // Remove the file if it exists
				} else {
					return Promise.reject(new NotFoundError("Dataset not found"));
				}
			})
			.then(() => id) // Resolve with the dataset id if successful
			.catch((error) => {
				// Propagate the error by re-throwing it
				throw new InsightError(`Failed to remove dataset: ${error}`);
			})
			.finally(() => {
				// Code in this block will run regardless of the promise's outcome
				console.log(`Attempted to remove dataset with ID: ${id}`);
				// Any cleanup or logging can be performed here
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
		try {
			const files = await fse.readdir("./data"); // Read all files in the data directory
			const datasets = await Promise.all(
				files.filter((file) => file.endsWith(".json")).map(async (file) => {
					// For each dataset file, read its content to extract dataset info
					const filePath = `./data/${file}`;
					const data = await fse.readJson(filePath);

					// Construct an InsightDataset object
					// Assuming the file contains properties id, kind, and numRows
					// Adjust based on your actual file structure
					return {
						id: data.id,
						kind: data.kind as InsightDatasetKind,
						numRows: data.sections.length, // Example: counting the number of sections
					};
				})
			);

			return datasets;
		} catch (error) {
			console.error("Failed to list datasets:", error);
			throw error; // Rethrow or handle as needed
		}
	}
}
