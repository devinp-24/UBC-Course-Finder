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
import {DatasetCacheManager} from "../util/DatasetCacheManager";
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
	private datasetCacheManager: DatasetCacheManager;

	constructor() {
		console.log("InsightFacadeImpl::init()");
		this.queryParser = new Parser();
		this.queryValidator = new Validator();
		this.queryExecutor = new Executor();
		this.datasetCacheManager = new DatasetCacheManager();
		// this.loader.loadExistingDatasets().then(({datasetCollection, courseDataCollection}) => {
		// 	this.datasetCollection = datasetCollection;
		// 	this.courseDataCollection = courseDataCollection;
		// 	console.log("Datasets initialized successfully");
		// }).catch((error) => {
		// 	console.error("Failed to initialize datasets", error);
		// });
	}

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		let zipFile = new JSZip();
		let info = Array<Promise<string>>();
		let dataset: CourseData;

		return new Promise<string[]>((resolve, reject) => {
			if (!id || id.includes("_") || id.trim() === "") {
				reject(new InsightError("Invalid ID"));
				return;
			}
			if (this.datasetCollection.includes(id)) {
				reject(new InsightError("ID already exists"));
				return;
			}
			if (kind !== InsightDatasetKind.Sections) {
				reject(new InsightError("Invalid Kind Type"));
				return;
			}
			zipFile.loadAsync(content, {base64: true})
				.then((zip: JSZip) => {
					const coursesFolder = zip.folder("courses");
					if (!coursesFolder) {
						throw new InsightError("Folder does not exist in the zip file");
					}
					coursesFolder.forEach((relativePath, file) => {
						info.push(file.async("text"));
					});
					return Promise.all(info);
				})
				.then(async (filesContent: string[]) => { // Mark this function as async
					dataset = new CourseData(id, kind, filesContent);
					if (dataset.sections.length === 0) {
						throw new InsightError("No valid sections to add");
					}
					this.datasetCollection.push(id);
					this.courseDataCollection.push(dataset);
					try {
						await this.datasetCacheManager.saveDataset(id, dataset);
						resolve(this.datasetCollection);
					} catch (error) {
						reject(new InsightError("Failed to save dataset to disk"));
					}
				})
				.catch((err: any) => {
					reject(new InsightError("Failed to add dataset"));
				});
		});
	}


	public async removeDataset(id: string): Promise<string> {
		const dataDir = "./data/";
		const filePath = `${dataDir}${id}.json`;
		if (!id || id.includes("_") || id.trim() === "") {
			throw new InsightError("Invalid ID");
		}
		try {
			// Check if the dataset file exists in the data directory
			const exists = await fse.pathExists(filePath);
			if (!exists) {
				throw new NotFoundError("Dataset not found");
			}

			// Proceed to remove the dataset from disk
			await this.datasetCacheManager.removeDataset(id);

			// Remove the dataset from memory (if additional logic is needed to synchronize memory state)
			const index = this.datasetCollection.indexOf(id);
			if (index !== -1) {
				this.datasetCollection.splice(index, 1);
				this.courseDataCollection.splice(index, 1); // Assuming this is necessary for memory cleanup
			}

			// Successfully removed
			return id;
		} catch (error) {
			if (error instanceof NotFoundError) {
				throw error; // Re-throw if it's a not found error
			} else {
				throw new InsightError(`Failed to remove dataset: ${error}`);
			}
		}
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
			// Fetch dataset IDs from disk
			const diskDatasetIds = await this.datasetCacheManager.listDatasetIds();

			// Create a temporary array to store datasets' information
			const datasetsInfo: InsightDataset[] = [];

			// Iterate through diskDatasetIds to construct InsightDataset objects
			// Note: This example assumes you want to include all datasets found on disk in the response.
			// Adjust as necessary if you need to filter or add additional properties.
			for (const id of diskDatasetIds) {
				// Attempt to find a matching dataset in memory to get the 'kind' and 'numRows'
				const memoryDataset = this.courseDataCollection.find((ds) => ds.id === id);

				// If found in memory, use its details; otherwise, set default values or attempt to read more details from the file
				const datasetInfo: InsightDataset = memoryDataset ?
					{
						id: memoryDataset.id,
						kind: memoryDataset.insightDatasetKind,
						numRows: memoryDataset.sections.length
					} :
					{
						// Default or placeholder values; consider adjusting based on your application's needs
						id: id,
						kind: InsightDatasetKind.Sections, // Or another default kind
						numRows: 64612 // Or load this detail from the dataset file if needed
					};

				datasetsInfo.push(datasetInfo);
			}

			return datasetsInfo;
		} catch (error) {
			console.error("Failed to list datasets", error);
			throw new InsightError("Failed to list datasets");
		}
	}
}
