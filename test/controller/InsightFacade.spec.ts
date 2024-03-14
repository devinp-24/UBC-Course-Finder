import InsightFacade from "../../src/controller/InsightFacade";
import {
	IInsightFacade, InsightDataset,
	InsightDatasetKind,
	InsightError, NotFoundError, ResultTooLargeError
} from "../../src/controller/IInsightFacade";
import {assert, expect, use} from "chai";
import chaiAsPromised from "chai-as-promised";
import {clearDisk, getContentFromArchives, readFileQueries} from "../TestUtil";
use(chaiAsPromised);

export interface ITestQuery {
	title: string;
	input: unknown;
	errorExpected: boolean;
	expected: any;
}

describe("InsightFacade", function () {
	let facade: IInsightFacade;
	let facade2: IInsightFacade;

	// Declare datasets used in tests. You should add more datasets like this!
	let sections: string;
	let rooms: string;

	before(async function () {
		// This block runs once and loads the datasets.
		sections = await getContentFromArchives("pair.zip");
		rooms = await getContentFromArchives("campus.zip");
		// Just in case there is anything hanging around from a previous run of the test suite
	});

	describe("AddDataset", function () {

		beforeEach(function () {
			// This section resets the insightFacade instance
			// This runs before each test
			facade = new InsightFacade();
		});

		afterEach(async function () {
			// This section resets the data directory (removing any cached data)
			// This runs after each test, which should make each test independent of the previous one
			await clearDisk();
		});
		it("should reject with InsightError for an invalid dataset ID containing underscore", async function () {
			const result = facade.addDataset("invalid_id", "content", InsightDatasetKind.Sections);
			await expect(result).to.eventually.be.rejectedWith(InsightError, "Invalid ID");
		});
		it("should successfully add a dataset", function () {
			const result = facade.addDataset("ubc2", rooms, InsightDatasetKind.Rooms);
			return expect(result).to.eventually.have.members(["ubc2"]);
		});
		it("should fail to add a dataset (blankspace)", async function () {
			const result = facade.addDataset(" ", sections, InsightDatasetKind.Sections);
			await expect(result).to.eventually.be.rejectedWith(InsightError);
		});
		it("should fail to add a dataset (empty)", function () {
			const result = facade.addDataset("", sections, InsightDatasetKind.Sections);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});
		it("should fail to add a dataset (whitespace)", function () {
			const result = facade.addDataset("  ", sections, InsightDatasetKind.Sections);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});
		it("should fail to add a dataset (underscore)", function () {
			const result = facade.addDataset("u_b_c", sections, InsightDatasetKind.Sections);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});
		it("should successfully add multiple datasets", function () {
			const result1 = facade.addDataset("ubc1", sections, InsightDatasetKind.Sections);
			const result2 = facade.addDataset("ubc2", sections, InsightDatasetKind.Sections);
			return expect(result2).to.eventually.have.members(["ubc1", "ubc2"]);
		});
		it("should fail to add a dataset (with the same id)", async function () {
			const result1 = await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
			const result2 = facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
			return expect(result2).to.eventually.be.rejectedWith(InsightError);
		});
		it("should reject with InsightError for an invalid kind", async function () {
			const result = facade.addDataset("ubc", sections, "invalidKind" as InsightDatasetKind);
			await expect(result).to.eventually.be.rejectedWith(InsightError);
		});

	});
	describe("removeDataset", function () {
		beforeEach(function () {
			// Reset the InsightFacade instance before each test
			facade = new InsightFacade();
		});
		it("should successfully remove a dataset", async function () {
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
			const removeResult = await facade.removeDataset("ubc");
			expect(removeResult).to.equal("ubc");
			const listResult = await facade.listDatasets();
			expect(listResult).to.be.an("array").that.is.empty;
		});
		// it("should reject with an empty dataset id", async function () {
		// 	const result = facade.removeDataset("ubc");
		// 	return expect(result).to.eventually.be.rejectedWith(NotFoundError);
		// });

		it("should reject when dataset with given id does not exist", async function () {
			const result = facade.removeDataset("nonexistentDataset");
			return expect(result).to.eventually.be.rejectedWith(NotFoundError);
		});

		it("should successfully remove an existing dataset", async function () {
			// Add a dataset first
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);

			// Remove the added dataset
			const result = facade.removeDataset("ubc");
			return expect(result).to.eventually.equal("ubc");
		});
		it("should fail to remove a dataset (blankspace)", function () {
			const result = facade.removeDataset(" ");
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});
		it("should fail to remove a dataset (empty)", function () {
			const result = facade.removeDataset("");
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});
		it("should fail to remove a dataset (whitespace)", function () {
			const result = facade.removeDataset("  ");
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});
		it("should fail to remove a dataset (underscore)", function () {
			const result = facade.removeDataset("u_b_c");
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});
		it("should reject with InsightError for an invalid kind", async function () {
			const result = facade.addDataset("ubc", sections, "invalidKind" as InsightDatasetKind);
			await expect(result).to.eventually.be.rejectedWith(InsightError);
		});

	});

	/*
	 * This test suite dynamically generates tests from the JSON files in test/resources/queries.
	 * You can and should still make tests the normal way, this is just a convenient tool for a majority of queries.
	 */
	describe("ListDatasets", function () {

		beforeEach(function () {
			// Reset the insightFacade instance before each test
			facade = new InsightFacade();
			facade2 = new InsightFacade();
		});

		afterEach(async function () {
			// Reset the data directory after each test
			await clearDisk();
		});

		it("should not list because the dataset is empty", async () => {
			const result: InsightDataset[] = await facade.listDatasets();
			expect(result).to.be.an("array").that.is.empty;
		});
		it("should list one dataset", async function() {
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
			const datasets = await facade.listDatasets();
			expect(datasets).to.deep.equal([{
				id: "ubc",
				kind: InsightDatasetKind.Sections,
				numRows: 64612
			}]);
		});
		it("should list multiple dataset", async function() {
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
			await facade.addDataset("ubc2", sections, InsightDatasetKind.Sections);
			const datasets = await facade.listDatasets();
			expect(datasets).to.deep.equal([{
				id: "ubc",
				kind: InsightDatasetKind.Sections,
				numRows: 64612
			},{
				id: "ubc2",
				kind: InsightDatasetKind.Sections,
				numRows: 64612
			}]);
			await facade.removeDataset("ubc2");
			const result = await facade.listDatasets();
			expect(result).to.deep.equal([{
				id: "ubc",
				kind: InsightDatasetKind.Sections,
				numRows: 64612}]);
		});
	});
	// describe("CachingProgress", function () {
	// 	let newInstance: InsightFacade;
	// 	before(async function() {
	// 		facade2 = new InsightFacade();
	// 		await facade2.addDataset("ubc", sections, InsightDatasetKind.Sections);
	// 		newInstance = new InsightFacade();
	//
	// 	});
	//
	// 	after(async function () {
	// 		await clearDisk();
	// 	});
	//
	// 	it("should return the removed dataset after caching", async () => {
	// 		const result = await newInstance.removeDataset("ubc");
	// 		expect(result).to.deep.equal("ubc");
	// 	});
	// });
	describe("PerformQuery", function () {
		before(async function () {
			facade = new InsightFacade();

			// Add the datasets to InsightFacade once.
			// Will *fail* if there is a problem reading ANY dataset.
			const loadDatasetPromises = [
				facade.addDataset("rooms", rooms, InsightDatasetKind.Rooms),
			];

			try {
				await Promise.all(loadDatasetPromises);
			} catch(err) {
				throw new Error(`In PerformQuery Before hook, dataset(s) failed to be added. \n${err}`);
			}
		});

		after(async function () {
			// await clearDisk();
		});

		describe("valid queries", function() {
			let validQueries: ITestQuery[];
			try {
				validQueries = readFileQueries("valid");
			} catch (e: unknown) {
				expect.fail(`Failed to read one or more test queries. ${e}`);
			}

			validQueries.forEach(function(test: any) {
				it(`${test.title}`, function () {
					return facade.performQuery(test.input).then((result) => {
						expect(result).to.deep.equal(test.expected);
					}).catch((err: any) => {
						assert.fail(`performQuery threw unexpected error: ${err}`);
					});
				});
			});
		});

		describe("invalid queries", function() {
			let invalidQueries: ITestQuery[];

			try {
				invalidQueries = readFileQueries("invalid");
			} catch (e: unknown) {
				expect.fail(`Failed to read one or more test queries. ${e}`);
			}

			invalidQueries.forEach(function(test: any) {
				it(`${test.title}`, function () {
					return facade.performQuery(test.input).then((result) => {
						assert.fail(`performQuery resolved when it should have rejected with ${test.expected}`);
					}).catch((err: any) => {
						if (test.expected === "InsightError") {
							expect(err).to.be.instanceOf(InsightError);
						} else {
							assert.fail("Query threw unexpected error");
						}
					});
				});
			});
		});
	});
});
