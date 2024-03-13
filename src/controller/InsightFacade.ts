import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
	ResultTooLargeError
} from "./IInsightFacade";
import {Parser} from "../query/Parser";
import {Validator} from "../query/Validator";
import {Executor} from "../query/Executor";
import * as fse from "fs-extra";
import {DatasetCacheManager} from "../util/DatasetCacheManager";
import {AddRoomsHelper} from "../util/AddRoomsHelper";
import {AddSectionsHelper} from "../util/AddSectionsHelper";
import {Order} from "../dataModels/Query";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	public datasetCollection: string[] = [];
	public courseDataCollection: any[] = [];
	private queryParser: Parser;
	private queryValidator: Validator;
	private queryExecutor: Executor;
	private datasetCacheManager: DatasetCacheManager;
	private adderRoom: AddRoomsHelper;
	private adderSections: AddSectionsHelper;

	constructor() {
		console.log("InsightFacadeImpl::init()");
		this.queryParser = new Parser();
		this.queryValidator = new Validator();
		this.queryExecutor = new Executor();
		this.datasetCacheManager = new DatasetCacheManager();
		this.adderRoom = new AddRoomsHelper();
		this.adderSections = new AddSectionsHelper();
	}

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {

		if (!id || id.includes("_") || id.trim() === "") {
			throw new InsightError("Invalid ID (contains underscore)");
		}
		if (this.datasetCollection.includes(id)) {
			throw new InsightError("ID already exists");
		}

		if (kind === InsightDatasetKind.Sections) {
			return this.adderSections.addSectionsDataset(id, content, this.datasetCollection,
				this.courseDataCollection);
		} else if (kind === InsightDatasetKind.Rooms) {
			return this.adderRoom.addRoomsDataset(id, content, this.datasetCollection, this.courseDataCollection);
		} else {
			throw new InsightError("Invalid Kind Type");
		}
	}


	public async removeDataset(id: string): Promise<string> {
		const dataDir = "./data/";
		const filePath = `${dataDir}${id}.json`;
		if (!id || id.includes("_") || id.trim() === "") {
			throw new InsightError("Invalid ID");
		}
		try {
			const index = this.datasetCollection.indexOf(id);
			if (index === -1) {
				throw new NotFoundError("Dataset not found");
			}
			// await this.datasetCacheManager.removeDataset(id);

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
		const MAX_RESULTS = 5000;
		try {
			// Use QueryParser to parse the query
			const parsedQuery = this.queryParser.parseQuery(query);
			// console.log("-----------------------------PARSING START-----------------------------------------");
			console.log(parsedQuery);
			// console.log("-----------------------------PARSING DONE-----------------------------------------");
			const validatedQuery = this.queryValidator.validateQuery(parsedQuery);
			// console.log("-----------------------------VALIDATOR DONE-----------------------------------------");
			// Step 2: Retrieve the dataset referenced in the query
			const datasetId = this.queryExecutor.extractDatasetId(parsedQuery);
			// console.log("-----------------------------EXTRACT ID-----------------------------------------");
			console.log(datasetId);
			// console.log("-----------------------------EXTRACT ID DONE-----------------------------------------");
			const dataset = this.courseDataCollection[this.datasetCollection.indexOf(datasetId)];
			if (!dataset) {
				throw new InsightError("Dataset not found");
			}
			// console.log("-----------------------------FOUND DATASET-----------------------------------------");

			// Step 3: Apply filters defined in the WHERE clause
			let filteredResults = this.queryExecutor.applyFilters(dataset, parsedQuery.WHERE);
			// console.log(filteredResults);
			// console.log("-----------------------------APPLIED FILTER START----------------------------------------");
			// console.log("-----------------------------APPLIED FILTER DONE----------------------------------------");
			// Step 4: Apply sorting and column selection based on OPTIONS
			if (parsedQuery.TRANSFORMATION) {
				// console.log("-----------------------------TRANSFORMATION IS THERE----------------------------------");
				filteredResults = this.queryExecutor.executeGroupAndApply(filteredResults, parsedQuery.TRANSFORMATION);
				// console.log("-----------------------------GROUP AND APPLY STARTS------------------------------------");

			}
			// console.log("-----------------------------START OF FORMATTING------------------------------------");
			let finalResults = this.queryExecutor.formatResults(filteredResults, parsedQuery.OPTIONS);
			// Step 5: Check for result size constraints
			if (parsedQuery.OPTIONS.ORDER) {
				const order = parsedQuery.OPTIONS.ORDER;
				// If ORDER is a string, convert it to an Order object with default direction 'UP'
				const orderObject: Order = typeof order === "string" ? {dir: "UP", keys: [order]} : order;
				finalResults = this.queryExecutor.sortResults(finalResults, orderObject);
			}
			if (finalResults.length > MAX_RESULTS) {
				throw new ResultTooLargeError("The query results exceed the allowed limit.");
			}
			// console.log("------------------------------FINAL RESULT STARTS------------------------");
			// console.log(finalResults);
			// console.log("------------------------------FINAL RESULT DONE------------------------");
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
