import InsightFacade from "../../src/controller/InsightFacade";
import {
	IInsightFacade, InsightDataset,
	InsightDatasetKind,
	InsightError, NotFoundError, ResultTooLargeError
} from "../../src/controller/IInsightFacade";
import {assert, expect, use} from "chai";
import chaiAsPromised from "chai-as-promised";
import {clearDisk, getContentFromArchives, readFileQueries} from "../TestUtil";
import {Parser} from "../../src/query/Parser";
import Section from "../../src/dataModels/Section";
import {Executor} from "../../src/query/Executor";
import CourseData from "../../src/dataModels/CourseData";
import {Filter, MComparison, Options, Query} from "../../src/dataModels/Query";
import {Validator} from "../../src/query/Validator";
import JSZip from "jszip";
use(chaiAsPromised);

export interface ITestQuery {
	title: string;
	input: unknown;
	errorExpected: boolean;
	expected: any;
}

describe("Section", function () {
	describe("#get method", function () {
		it("should return the correct audit value", function () {
			// Setup: create a Section instance with specific values
			const uuid = "testUuid";
			const courseId = "testCourseId";
			const title = "testTitle";
			const instructor = "testInstructor";
			const dept = "testDept";
			const year = 2021;
			const avg = 90;
			const pass = 50;
			const fail = 5;
			const audit = 10; // Audit value to test

			const section = new Section(uuid, courseId, title, instructor, dept, year, avg, pass, fail, audit);

			// Exercise & Verify: ensure the 'audit' property can be correctly retrieved
			expect(section.get("audit")).to.equal(audit);
		});
	});
});
describe("Executor", function () {
	let executor: Executor;

	before(function () {
		executor = new Executor();
	});
	describe("extractDatasetId", function () {
		it("should extract the dataset id from a simple query", function () {
			const query: Query = {
				WHERE: {
					IS: {courses_dept: "cpsc"}
				},
				OPTIONS: {
					COLUMNS: ["courses_dept", "courses_avg"]
				}
			};
			const result = executor.extractDatasetId(query);
			expect(result).to.equal("courses");
		});

		it("should throw an error for inconsistent dataset ids", function () {
			const query: Query = {
				WHERE: {
					IS: {courses_dept: "cpsc"}
				},
				OPTIONS: {
					COLUMNS: ["courses_dept", "another_dept_avg"]
				}
			};
			expect(() => executor.extractDatasetId(query)).to.throw("Query must use a single dataset ID");
		});
	});

	describe("applyFilters", function () {
		let courseData: CourseData;

		beforeEach(function () {
			const sampleCoursesList = [
				JSON.stringify({
					result: [
						{
							id: "uuid1",
							Course: "210",
							Title: "Software Construction",
							Professor: "Reid Holmes",
							Subject: "CPSC",
							Year: 2017,
							Avg: 85,
							Pass: 200,
							Fail: 10,
							Audit: 5,
							Section: "101"
						},
						{
							id: "uuid2",
							Course: "310",
							Title: "Introduction to Software Engineering",
							Professor: "Gregor Kiczales",
							Subject: "CPSC",
							Year: 2017,
							Avg: 90,
							Pass: 150,
							Fail: 8,
							Audit: 2,
							Section: "102"
						}
					]
				})
			];
			courseData = new CourseData("cpsc", InsightDatasetKind.Sections, sampleCoursesList);
		});

		it("should return all sections for an empty filter", function () {
			const filter: Filter = {};
			const results = executor.applyFilters(courseData, filter);
			expect(results).to.have.lengthOf(courseData.sections.length);
		});

		// it("should filter sections based on GT comparison", function () {
		// 	const filter: Filter = {GT: {courses_avg: 95}};
		// 	const results = executor.applyFilters(courseData, filter);
		// 	expect(results).to.have.lengthOf(1);
		// 	expect(results[0].id).to.equal("210");
		// });

	// Add tests for LT, EQ, IS comparisons, and combinations (AND, OR, NOT)
	});

	describe("formatResults", function () {
		let sections: Section[];

		beforeEach(function () {
			sections = [
				new Section("uuid1", "CPSC", "210", "201", "instructor1", 99, 100, 0, 0, 2017),
				new Section("uuid2", "CPSC", "310", "201", "instructor2", 80, 100, 0, 0, 2017)
			];
		});

		it("should format results according to the OPTIONS clause", function () {
			const options: Options = {
				COLUMNS: ["courses_dept", "courses_id"],
				ORDER: "courses_id"
			};
			const results = executor.formatResults(sections, options);
			expect(results).to.deep.equal([
				{courses_dept: "instructor1", courses_id: "CPSC"},
				{courses_dept: "instructor2", courses_id: "CPSC"}
			]);
		});

		it("should throw ResultTooLargeError if results exceed 5000", function () {
		// Simulate a scenario with more than 5000 results
			for (let i = 0; i < 5001; i++) {
				sections.push(new Section(`uuid${i + 3}`, "CPSC", `${i + 3}`
					, "201", "instructor3", 70, 100, 0, 0, 2017));
			}
			const options: Options = {
				COLUMNS: ["courses_dept", "courses_id"],
				ORDER: "courses_id"
			};
			expect(() => executor.formatResults(sections, options)).to.throw(ResultTooLargeError);
		});

	// Add more tests to cover sorting, especially for edge cases and error scenarios
	});

// Add more tests as needed for each uncovered line or scenario
});

describe("Validator", function () {
	let validator: Validator;

	// Set up before any tests are run
	before(function () {
		validator = new Validator();
	});

	describe("validateWhereClause", function () {
		it("should accept an empty WHERE clause", function () {
			const emptyFilter: Filter = {};
			expect(() => validator.validateWhereClause(emptyFilter)).to.not.throw();
		});
		it("should not throw an InsightError for a valid NOT filter", function () {
			const validFilter: Filter = {NOT: {GT: {courses_avg: 90}}};
			expect(() => validator.validateWhereClause(validFilter)).to.not.throw();
		});

		it("should not throw an InsightError for valid nested AND/OR filters", function () {
			const validFilter: Filter = {
				AND: [
					{OR: [{GT: {courses_avg: 90}}, {LT: {courses_avg: 95}}]},
					{IS: {courses_dept: "cpsc"}}
				]
			};
			expect(() => validator.validateWhereClause(validFilter)).to.not.throw();
		});
		it("should throw an InsightError for an invalid MComparison filter", function () {
			const invalidFilter: Filter = {GT: {}};
			expect(() => validator.validateWhereClause(invalidFilter)).to.throw(InsightError
				, "MComparison must have exactly one key-value pair");
		});

		// Test for an invalid SComparison (missing key or value)
		it("should throw an InsightError for an invalid SComparison filter", function () {
			const invalidFilter: Filter = {IS: {}};
			expect(() => validator.validateWhereClause(invalidFilter)).to.throw(InsightError
				, "SComparison must have exactly one key-value pair");
		});
	});

	describe("validateOptionsClause", function () {
		it("should throw an InsightError for an empty COLUMNS array", function () {
			const invalidOptions: Options = {COLUMNS: []};
			expect(() => validator.validateOptionsClause(invalidOptions)).to.throw(InsightError
				, "COLUMNS must be a non-empty array");
		});

		it("should throw an InsightError for a non-string ORDER", function () {
			const invalidOptions: Options = {COLUMNS: ["courses_dept", "courses_avg"], ORDER: 123 as any};
			expect(() => validator.validateOptionsClause(invalidOptions)).to.throw(InsightError
				, "ORDER must be a string");
		});

		it("should not throw an InsightError for a valid OPTIONS clause without ORDER", function () {
			const validOptions: Options = {
				COLUMNS: ["courses_dept", "courses_avg"]
			};
			expect(() => validator.validateOptionsClause(validOptions)).to.not.throw();
		});

		it("should not throw an InsightError for a valid OPTIONS clause with ORDER", function () {
			const validOptions: Options = {
				COLUMNS: ["courses_dept", "courses_avg"],
				ORDER: "courses_avg"
			};
			expect(() => validator.validateOptionsClause(validOptions)).to.not.throw();
		});

		// Test for OPTIONS with ORDER referencing a column not present in COLUMNS

		// Test for valid OPTIONS with multiple columns and an ORDER
		it("should not throw an InsightError for valid OPTIONS with multiple columns and ORDER", function () {
			const validOptions: Options = {
				COLUMNS: ["courses_dept", "courses_avg", "courses_id"],
				ORDER: "courses_id"
			};
			expect(() => validator.validateOptionsClause(validOptions)).to.not.throw();
		});

		// Add a test case for a valid OPTIONS clause with ORDER being an object for advanced ordering
		// This test assumes your implementation supports advanced ordering with direction and keys
	});
});

describe("Parser", () => {
	let parser: Parser;

	beforeEach(() => {
		parser = new Parser();
	});

	describe("parseQuery", () => {
		it("should throw InsightError if query is not an object", () => {
			try {
				parser.parseQuery(null);
				assert.fail("Query did not throw an error");
			} catch (err) {
				if (err instanceof InsightError) {
					// Test passed
				} else {
					assert.fail("Query threw unexpected error");
				}
			}
		});

		// Add more test cases to cover scenarios like valid query objects, malformed query objects, etc.
	});

	describe("parseWhereClause", () => {
		it("should throw Error if WHERE clause is not an object", () => {
			try {
				parser.parseWhereClause(null);
				assert.fail("Query did not throw an error");
			} catch (err) {
				if (err instanceof Error) {
					// Test passed
				} else {
					assert.fail("Query threw unexpected error");
				}
			}
		});

		// Add more test cases to cover scenarios like valid WHERE clauses, different filter types, etc.
	});

	describe("parseLogicalComparison", () => {
		it("should throw Error if operator value is not an array", () => {
			try {
				parser.parseLogicalComparison("AND", null);
				assert.fail("Query did not throw an error");
			} catch (err) {
				if (err instanceof Error) {
					// Test passed
				} else {
					assert.fail("Query threw unexpected error");
				}
			}
		});

		// Add more test cases to cover scenarios like valid logical comparisons, nested logical comparisons, etc.
	});

	describe("parseMComparison", () => {
		it("should throw Error if comparison is not a single field with numeric value", () => {
			try {
				parser.parseMComparison("LT", null);
				assert.fail("Query did not throw an error");
			} catch (err) {
				if (err instanceof Error) {
					// Test passed
				} else {
					assert.fail("Query threw unexpected error");
				}
			}
		});

		// Add more test cases to cover scenarios like valid MComparison operators, different field-value combinations, etc.
	});

	describe("parseSComparison", () => {
		it("should throw Error if comparison is not a single field with string value", () => {
			try {
				parser.parseSComparison(null);
				assert.fail("Query did not throw an error");
			} catch (err) {
				if (err instanceof Error) {
					// Test passed
				} else {
					assert.fail("Query threw unexpected error");
				}
			}
		});

		// Add more test cases to cover scenarios like valid SComparison operators, different field-value combinations, etc.
	});

	describe("parseOptionsClause", () => {
		it("should throw Error if OPTIONS is not an object", () => {
			try {
				parser.parseOptionsClause(null);
				assert.fail("Query did not throw an error");
			} catch (err) {
				if (err instanceof Error) {
					// Test passed
				} else {
					assert.fail("Query threw unexpected error");
				}
			}
		});

		// Add more test cases to cover scenarios like valid OPTIONS clauses, malformed OPTIONS clauses, etc.
	});
});
describe("Section Constructor", function () {
	it("should create a new Section instance with the provided properties", function () {
		const uuid = "123";
		const courseid = "CPSC310";
		const title = "Introduction to Programming";
		const instructor = "John Doe";
		const dept = "CPSC";
		const year = 2022;
		const avg = 80;
		const pass = 50;
		const fail = 10;
		const audit = 5;
		const section = new Section(uuid, courseid, title, instructor, dept, year, avg, pass, fail, audit);
		expect(section).to.be.an.instanceOf(Section);
	});
});

describe("Section Getter", function () {
	let section: Section;
	beforeEach(function () {
		section = new Section("123", "CPSC310", "Introduction to Programming", "John Doe",
			"CPSC", 2022, 80, 50, 10, 5);
	});
	it("should return the correct value for each property when accessed by key", function () {
		expect(section.get("uuid")).to.equal("123");
		expect(section.get("id")).to.equal("CPSC310");
		expect(section.get("title")).to.equal("Introduction to Programming");
		expect(section.get("instructor")).to.equal("John Doe");
		expect(section.get("dept")).to.equal("CPSC");
		expect(section.get("year")).to.equal(2022);
		expect(section.get("avg")).to.equal(80);
		expect(section.get("pass")).to.equal(50);
		expect(section.get("fail")).to.equal(10);
		expect(section.get("audit")).to.equal(5);
	});
});

describe("InsightFacade", function () {
	let facade: IInsightFacade;
	let facade2: IInsightFacade;

	// Declare datasets used in tests. You should add more datasets like this!
	let sections: string;

	before(async function () {
		// This block runs once and loads the datasets.
		sections = await getContentFromArchives("pair.zip");
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
			const result = facade.addDataset("ubc2", sections, InsightDatasetKind.Sections);
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
			await facade2.addDataset("ubc2", sections, InsightDatasetKind.Sections);
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

	describe("CachingProgress", function () {
		let newInstance: InsightFacade;
		before(async function() {
			const facade2 = new InsightFacade();
			await facade2.addDataset("ubc", sections, InsightDatasetKind.Sections);
			newInstance = new InsightFacade();

		});

		after(async function () {
			await clearDisk();
		});

		it("should return the removed dataset after caching", async () => {
			const result = await newInstance.removeDataset("ubc");
			expect(result).to.deep.equal("ubc");
		});
	});

	describe("PerformQuery", function () {
		before(async function () {
			facade = new InsightFacade();

			// Add the datasets to InsightFacade once.
			// Will *fail* if there is a problem reading ANY dataset.
			const loadDatasetPromises = [
				facade.addDataset("sections", sections, InsightDatasetKind.Sections),
			];

			try {
				await Promise.all(loadDatasetPromises);
			} catch(err) {
				throw new Error(`In PerformQuery Before hook, dataset(s) failed to be added. \n${err}`);
			}
		});

		after(async function () {
			await clearDisk();
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
