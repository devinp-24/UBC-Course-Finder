import {InsightDatasetKind, InsightError} from "../controller/IInsightFacade";
import JSZip from "jszip";
import Room from "../dataModels/Room";
import RoomData from "../dataModels/RoomData";
import CourseData from "../dataModels/CourseData";
import * as parse5 from "parse5";
import * as http from "http";
import {GeoResponse} from "../dataModels/GeoResponse";


export class AddRoomsHelper {

	public async addRoomsDataset(id: string, content: string, idCollection: string[]
		, dataCollection: any[]): Promise<string[]> {

		const rooms: Room[] = [];

		// Step 1: Decode the base64 content and unzip it
		const zip = await JSZip.loadAsync(content, {base64: true});

		// Step 2: Find and parse index.htm to extract building links
		const buildings = await this.parseIndexHtml(zip);

		// Step 3: For each building, extract room details and create Room objects
		const buildingRoomPromises = buildings.map((building) => {
			building = building.replace(/^\.\//, "");
			return this.parseBuildingHtml(zip, building);
		});
		const buildingRoomsArray = await Promise.all(buildingRoomPromises);

		buildingRoomsArray.forEach((buildingRooms) => {
			rooms.push(...buildingRooms);
		});

		// Step 4: Validate rooms and create a RoomData object
		if (rooms.length === 0) {
			throw new Error("No valid rooms found.");
		}
		const roomData = new RoomData(id, rooms, InsightDatasetKind.Rooms);

		idCollection.push(id);
		dataCollection.push(roomData);
		console.log(dataCollection);

		return idCollection;
	}

	private async parseIndexHtml(zip: JSZip): Promise<string[]> {

		const tableRows: any[] = [];

		const indexFile = zip.file("index.htm");
		if (!indexFile) {
			throw new Error("index.htm file does not exist in the zip file");
		}

		const htmlContent = await indexFile.async("string");
		const document = parse5.parse(htmlContent);
		const buildingTable = this.findBuildingTable(document);


		if (buildingTable) {
			const rows = this.getTableRows(buildingTable, tableRows);
			return this.extractLinksFromRows(rows);
		} else {
			throw new InsightError("Building table not found in index.htm");
		}
	}

	private async parseBuildingHtml(zip: JSZip, buildingPath: string): Promise<Room[]> {

		const buildingRooms: Room[] = [];
		const file = zip.file(buildingPath);

		if (!file) {
			throw new InsightError(`${buildingPath} not found`);
		}

		const htmlContent = await file.async("string");
		const document = parse5.parse(htmlContent);

		// extracting room properties
		const fName = this.findFullName(document);
		const sName = this.findShortName(buildingPath);
		const address = this.findAddress(document);
		let lat: number | undefined;
		let lon: number | undefined;
		let geo: GeoResponse | undefined = {
			lat: 0,
			lon: 0,
			error: "no coordinates"
		};
		if (address) {
			try {
				geo = await this.getGeoLocation(address);
				lat = geo.lat;
				lon = geo.lon;
			} catch {
				throw new InsightError(geo.error);
			}
		}

		const roomsList = this.extractRoomRows(document);
		for (const roomRow of roomsList) {
			const tableProps = this.extractTableFeatures(roomRow);
			if (lat !== undefined && lon !== undefined) {
				const room = new Room(fName, sName, tableProps[0], sName + "_" + tableProps[0], address, lat,
					lon, tableProps[1], tableProps[3].trim(), tableProps[2].trim(), tableProps[4]);
				buildingRooms.push(room);
			}
		}
		return buildingRooms;
	}

	private findBuildingTable(node: any): any {
		if (node.tagName === "table" && node.attrs && node.attrs.some((attr: {name: string; value: string;}) =>
			attr.name === "class" && attr.value.includes("views-table"))) {
			return node;
		}

		if (node.childNodes) {
			for (const childNode of node.childNodes) {
				const result = this.findBuildingTable(childNode);
				if (result) {
					return result;
				}
			}
		}
		return null;
	}

	private getTableRows(node: any, rowsList: any[]): any[] {

		if (node.tagName === "tr") {
			rowsList.push(node);
		}

		if (node.childNodes) {
			for (const cNode of node.childNodes) {
				this.getTableRows(cNode, rowsList);
			}
		}
		return rowsList;
	}

	private extractLinksFromRows(rows: any[]): string[] {
		const links: string[] = [];
		rows.forEach((row: any) => {
			if (row.childNodes) {
				for (const cNode of row.childNodes) {
					this.extractLinks(cNode, links);
				}
			}
		});
		return links;
	}

	private extractLinks(node: any, links: string[]) {
		// Check if the current node is a <td> with the desired class
		if (node.tagName === "td" && node.attrs && node.attrs.some((attr: {name: string; value: string}) =>
			attr.name === "class" && attr.value.includes("views-field views-field-title"))) {
			// If the node has child nodes, search for <a> tags
			if (node.childNodes) {
				node.childNodes.forEach((childNode: any) => {
					if (childNode.tagName === "a" && childNode.attrs) {
						const hrefAttr = childNode.attrs.find((attr: {name: string; value: string}) =>
							attr.name === "href");
						if (hrefAttr) {
							links.push(hrefAttr.value);
						}
					}
				});
			}
		}
	}

	private findFullName(node: any): string {
		if (node.tagName === "div" && node.attrs && node.attrs.some((attr: {name: string; value: string;}) =>
			attr.name === "id" && attr.value === "building-info")) {
			if (node.childNodes) {
				return this.extractFullName(node);
			}
		}
		if (node.childNodes) {
			for (const childNode of node.childNodes) {
				const result = this.findFullName(childNode);
				if (result) {
					return result;
				}
			}
		}
		return "";
	}

	private extractFullName(node: any): string {
		if (node.attrs && node.attrs.some((attr: {name: string; value: string;}) =>
			attr.name === "class" && attr.value === "field-content")) {
			const text = node.childNodes.find((child: any) => child.nodeName === "#text");
			return text?.value;
		}
		if (node.childNodes) {
			for (const childNode of node.childNodes) {
				const result = this.extractFullName(childNode);
				if (result) {
					return result;
				}
			}
		}
		return "";
	}

	private findShortName(path: string): string {
		const name = path.split("/").pop();
		if (name) {
			return name?.replace(/\.htm$/i, "");
		} else {
			return "";
		}
	}

	private findAddress(node: any): string {
		if (node.tagName === "div" && node.attrs && node.attrs.some((attr: {name: string; value: string;}) =>
			attr.name === "class" && attr.value.includes("building-field"))) {
			return node.childNodes[0].childNodes[0].value;
		}
		if (node.childNodes) {
			for (const childNode of node.childNodes) {
				const result = this.findAddress(childNode);
				if (result) {
					return result;
				}
			}
		}
		return "";
	}

	private async getGeoLocation(address: string): Promise<GeoResponse> {
		return new Promise((resolve, reject) => {
			const encodedAddress = encodeURIComponent(address);
			const url = `http://cs310.students.cs.ubc.ca:11316/api/v1/project_team117/${encodedAddress}`;

			http.get(url, (res) => {
				if (res.statusCode !== 200) {
					reject(new Error(`Request Failed. Status Code: ${res.statusCode}`));
					return;
				}

				let data = "";
				res.on("data", (chunk) => {
					data += chunk;
				});
				res.on("end", () => {
					try {
						const parsedData: GeoResponse = JSON.parse(data);
						resolve(parsedData);
					} catch (e) {
						reject(e);
					}
				});
			}).on("error", (e) => {
				reject(e);
			});
		});
	}

	private extractRoomRows(document: any): any[] {
		const roomRows: any[] = [];
		let rows: any[] = [];
		const roomsTable = this.findBuildingTable(document);

		if (roomsTable) {
			const tbody = roomsTable.childNodes.find((child: any) => child.tagName === "tbody");
			rows = this.getTableRows(tbody, roomRows);
		}
		return rows;
	}

	private extractTableFeatures(roomRow: any): any[] {
		let properties: any[] = [];

		properties[0] = this.extractNumber(roomRow);
		properties[1] = this.extractCapacity(roomRow);
		properties[2] = this.extractFurnitureNType(roomRow, "furniture");
		properties[3] = this.extractFurnitureNType(roomRow, "type");
		properties[4] = this.extractHref(roomRow);
		return properties;
	}

	private extractNumber(node: any): string | null {
		if (node.tagName === "td" && node.attrs && node.attrs.some((attr: {name: string; value: string;}) =>
			attr.name === "class" && attr.value.includes("views-field views-field-field-room-number"))) {
			return node.childNodes[1].childNodes[0].value as string;
		}
		if (node.childNodes) {
			for (const childNode of node.childNodes) {
				const result = this.extractNumber(childNode);
				if (result) {
					return result;
				}
			}
		}
		return null;
	}

	private extractCapacity(node: any): number | null {
		if (node.tagName === "td" && node.attrs && node.attrs.some((attr: {name: string; value: string;}) =>
			attr.name === "class" && attr.value.includes("views-field views-field-field-room-capacity"))) {
			return parseInt(node.childNodes[0].value.trim(), 10);
		}
		if (node.childNodes) {
			for (const childNode of node.childNodes) {
				const result = this.extractCapacity(childNode);
				if (result) {
					return result;
				}
			}
		}
		return null;
	}

	private extractFurnitureNType(node: any, property: string): string | null {
		if (node.tagName === "td" && node.attrs && node.attrs.some((attr: {name: string; value: string;}) =>
			attr.name === "class" && attr.value.includes(`views-field views-field-field-room-${property}`))) {
			return node.childNodes[0].value as string;
		}
		if (node.childNodes) {
			for (const childNode of node.childNodes) {
				const result = this.extractFurnitureNType(childNode, property);
				if (result) {
					return result;
				}
			}
		}
		return null;
	}

	private extractHref(node: any): string | null {
		if (node.tagName === "td" && node.attrs && node.attrs.some((attr: {name: string; value: string;}) =>
			attr.name === "class" && attr.value.includes("views-field views-field-nothing"))) {
			return node.childNodes[1].attrs.find((attr: any) => attr.name === "href").value;
		}
		if (node.childNodes) {
			for (const childNode of node.childNodes) {
				const result = this.extractHref(childNode);
				if (result) {
					return result;
				}
			}
		}
		return null;
	}
}
