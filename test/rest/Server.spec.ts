import Server from "../../src/rest/Server";
import InsightFacade from "../../src/controller/InsightFacade";

import {expect} from "chai";
import request, {Response} from "supertest";
import {clearDisk, getContentFromArchives} from "../TestUtil";

const PORT = 4321;
const SERVER_URL = `localhost:${PORT}`;

describe("Facade D3", function () {

	let facade: InsightFacade;
	let server: Server;
	let pairzip: string;
	let campuszip: string;

	before(async function () {
		await clearDisk();
		facade = new InsightFacade();
		server = new Server(PORT);
		pairzip = await getContentFromArchives("pair.zip");
		campuszip = await getContentFromArchives("campus.zip");
		await server.start();
		// TODO: start server here once and handle errors properly
	});

	after(async function () {
		await server.stop();
	});

	beforeEach(async function () {
		await clearDisk();
	});

	afterEach(function () {
		// might want to add some process logging here to keep track of what is going on
	});

	// Sample on how to format PUT requests
	it("PUT test for adding the 'pair' dataset", async function () {
		// Assuming getContentFromArchives returns base64 encoded content
		const ZIP_FILE_DATA = atob(pairzip);
		const ENDPOINT_URL = "/dataset/pair/sections";

		const response = await request(SERVER_URL)
			.put(ENDPOINT_URL)
			.set("Content-Type", "application/x-zip-compressed")
			.send(ZIP_FILE_DATA)
			.expect(200); // Expecting the request to succeed

		expect(response.body).to.have.property("result");
		console.log("PUT test for adding the 'pair' dataset passed with response:", response.body);
	});

	it("PUT test for adding the 'campus' dataset", async function () {
		const ZIP_FILE_DATA = atob(campuszip);
		const ENDPOINT_URL = "/dataset/campus/rooms";

		const response = await request(SERVER_URL)
			.put(ENDPOINT_URL)
			.set("Content-Type", "application/x-zip-compressed")
			.send(ZIP_FILE_DATA)
			.expect(200); // Expecting the request to succeed

		expect(response.body).to.have.property("result");
		console.log("PUT test for adding the 'campus' dataset passed with response:", response.body);
	});

	it("DELETE test for a dataset", async function () {
		const DATASET_ID = "pair"; // The id of the dataset you want to delete
		const ENDPOINT_URL = `/dataset/${DATASET_ID}`;

		try {
			const response = await request(SERVER_URL)
				.del(ENDPOINT_URL) // supertest uses .del() for DELETE requests
				.expect(200); // Expecting success status code (adjust if needed)

			// Additional assertions can be made on the response
			expect(response.body).to.have.property("result");
			expect(response.body.result).to.be.equal(DATASET_ID);
			// some logging here please!
			console.log("DELETE test passed with response:", response.body);
		} catch (err) {
			// and some more logging here!
			console.error("DELETE test encountered an error:", err);
			expect.fail();
		}
	});

	it("DELETE test for non-existent dataset", async function () {
		const NON_EXISTENT_ID = "nonexistent";
		const ENDPOINT_URL = `/dataset/${NON_EXISTENT_ID}`;

		try {
			const response = await request(SERVER_URL)
				.del(ENDPOINT_URL)
				.expect(404); // Expecting not found status code

			// Assertions about the structure of the response can be here
			// Expecting specific error message in the response
			expect(response.body).to.have.property("error");
			console.log("DELETE test for non-existent dataset passed with response:", response.body);
		} catch (err) {
			console.error("DELETE test for non-existent dataset encountered an error:", err);
			expect.fail();
		}
	});
	it("GET test to list all datasets", async function () {
		const ENDPOINT_URL = "/datasets";

		try {
			const response = await request(SERVER_URL)
				.get(ENDPOINT_URL)
				.expect(200); // Expecting success status code (adjust if needed)

			// Assertions can be made on the response
			expect(response.body).to.have.property("result");
			expect(response.body.result).to.be.an("array");
			// If you know the expected contents of the array, you can add more specific checks

			// Log for successful response
			console.log("GET test to list all datasets passed with response:", response.body);
		} catch (err) {
			// Log for error case
			console.error("GET test to list all datasets encountered an error:", err);
			expect.fail();
		}
	});

	// The other endpoints work similarly. You should be able to find all instructions at the supertest documentation
});
