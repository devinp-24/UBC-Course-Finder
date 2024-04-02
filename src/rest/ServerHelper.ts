// InsightFacadeExpressHandler.ts

import {Request, Response} from "express";
import InsightFacade from "../controller/InsightFacade";
import {InsightDatasetKind, InsightError, NotFoundError} from "../controller/IInsightFacade"; // Adjust the import path as necessary

export default class ServerHelper {
	private insightFacade: InsightFacade = new InsightFacade();

	public async putDataset(req: Request, res: Response): Promise<void> {
		try {
			const id: string = req.params.id;
			const kind: InsightDatasetKind = req.params.kind as InsightDatasetKind;
			if (!req.body || req.body === "") {
				res.status(400).json({error: "Invalid File"});
				return;
			}
			const content: string = req.body.toString("base64");			// console.log(content);
			const result = await this.insightFacade.addDataset(id, content, kind);
			res.status(200).json({result});
		} catch (error) {
			res.status(400).json({error: "Error adding dataset"});
		}
	}

	public async deleteDataset(req: Request, res: Response): Promise<void> {
		try {
			const id: string = req.params.id;
			const result = await this.insightFacade.removeDataset(id);
			res.status(200).json({result});
		} catch (error) {
			if (error instanceof NotFoundError) {
				res.status(404).json({error: "Dataset not found"});
			} else {
				res.status(400).json({error: "Error removing dataset"});
			}
		}
	}

	public async postQuery(req: Request, res: Response): Promise<void> {
		try {
			const query = req.body;
			const result = await this.insightFacade.performQuery(query);
			res.status(200).json({result});
		} catch (error) {
			res.status(400).json({error: "Error performing query"});
		}
	}

	public async getDatasets(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.insightFacade.listDatasets();
			res.status(200).json({result});
		} catch (error) {
			res.status(500).json({error: "Internal server error"});
		}
	}
}
