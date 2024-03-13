import Room from "./Room";
import {InsightDataset, InsightDatasetKind} from "../controller/IInsightFacade";

export default class RoomData {

	public id: string;
	public rooms: Room[];
	public kind: InsightDatasetKind;
	public insightDataset: InsightDataset;

	constructor(id: string, rooms: Room[], kind: InsightDatasetKind) {
		this.rooms = rooms;
		this.id = id;
		this.kind = kind;
		this.insightDataset = {id: id, numRows: this.rooms.length, kind: kind} as InsightDataset;
	}
}
