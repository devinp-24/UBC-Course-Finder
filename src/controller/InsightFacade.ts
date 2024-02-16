import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError, ResultTooLargeError
} from "./IInsightFacade";
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

			// this zipFile.loadAsync method was created using chatGPT
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
			// Check if the dataset file exists in the data folder
			const exists = await fse.pathExists(filePath);
			if (!exists) {
				throw new NotFoundError("Dataset not found");
			}

			await this.datasetCacheManager.removeDataset(id);

			const index = this.datasetCollection.indexOf(id);
			if (index !== -1) {
				this.datasetCollection.splice(index, 1);
				this.courseDataCollection.splice(index, 1);
			}

			return id;
		} catch (error) {
			if (error instanceof NotFoundError) {
				throw error;
			} else {
				throw new InsightError(`Failed to remove dataset: ${error}`);
			}
		}
	}


	public async performQuery(query: unknown): Promise<InsightResult[]> {
		// used chatGPT to understand the basic structure of what performQuery should look like
		const MAX_RESULTS = 5000;
		try {
			// parse query
			const parsedQuery = this.queryParser.parseQuery(query);
			// validate query
			const validatedQuery = this.queryValidator.validateQuery(parsedQuery);

			const datasetId = this.queryExecutor.extractDatasetId(parsedQuery);

			// Ensure the dataset is loaded in memory
			let dataset = this.courseDataCollection.find((ds) => ds.id === datasetId);
			if (!dataset) {
				// Load the dataset from disk if not found in memory
				dataset = await this.datasetCacheManager.loadDataset(datasetId);
				this.datasetCollection.push(datasetId); // Update datasetCollection
				this.courseDataCollection.push(dataset); // Update courseDataCollection
			}
			const filteredResults = this.queryExecutor.applyFilters(dataset, parsedQuery.WHERE);

			const finalResults = this.queryExecutor.formatResults(filteredResults, parsedQuery.OPTIONS);


			if (finalResults.length > MAX_RESULTS) {
				throw new ResultTooLargeError("The query results exceed the allowed limit.");
			}
			return finalResults;
		} catch (error) {
			if (error instanceof ResultTooLargeError) {
				throw error;
			} else {
				console.error(`Query execution error: ${error}`);
				throw new InsightError("An error occurred during the query execution");
			}
		}
	}


	public async listDatasets(): Promise<InsightDataset[]> {
		try {
			// get ids from disk
			const diskDatasetIds = await this.datasetCacheManager.listDatasetIds();
			const datasetsInfo: InsightDataset[] = [];

			for (const id of diskDatasetIds) {
				// find matching id
				const memoryDataset = this.courseDataCollection.find((ds) => ds.id === id);
				// the following code was generated by chatGPT
				const datasetInfo: InsightDataset = memoryDataset ?
					{
						id: memoryDataset.id,
						kind: memoryDataset.insightDatasetKind,
						numRows: memoryDataset.sections.length
					} :
					{
						id: id,
						kind: InsightDatasetKind.Sections,
						numRows: 64612
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
