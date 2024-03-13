import {InsightError} from "../controller/IInsightFacade";
import {
	Query,
	Filter,
	LogicComparison,
	MComparison,
	SComparison,
	Options,
	Order,
	Transformations, ApplyRule
} from "../dataModels/Query";

export class Validator {
	public validateQuery(query: Query): void {
		this.validateWhereClause(query.WHERE);
		this.validateOptionsClause(query.OPTIONS);
		if (query.TRANSFORMATION) {
			this.validateTransformationsClause(query.TRANSFORMATION);
		}
	}

	public validateWhereClause(filter: Filter): void {
		if (Object.keys(filter).length === 0) {
			return;
		}

		// Depending on the filter type, validate accordingly
		if ("AND" in filter || "OR" in filter) {
			this.validateLogicComparison(filter as LogicComparison);
		} else if ("LT" in filter || "GT" in filter || "EQ" in filter) {
			this.validateMComparison(filter as MComparison);
		} else if ("IS" in filter) {
			this.validateSComparison(filter as SComparison);
		} else if ("NOT" in filter) {
			this.validateWhereClause((filter as any).NOT);
		} else {
			throw new InsightError("Invalid filter type in WHERE clause");
		}
	}

	private validateLogicComparison(logicComparison: LogicComparison): void {
		const filters = logicComparison.AND || logicComparison.OR;
		if (!Array.isArray(filters) || filters.length === 0) {
			throw new InsightError("AND/OR must have at least one filter");
		}
		filters.forEach((filter) => this.validateWhereClause(filter));
	}

	private validateMComparison(mComparison: MComparison): void {
		const comparator = mComparison.LT || mComparison.GT || mComparison.EQ;
		if (typeof comparator !== "object" || Object.keys(comparator).length !== 1) {
			throw new InsightError("MComparison must have exactly one key-value pair");
		}
		if (typeof Object.values(comparator)[0] !== "number") {
			throw new InsightError("The value for MComparison must be a number");
		}
	}

	private validateSComparison(sComparison: SComparison): void {
		const comparator = sComparison.IS;
		if (typeof comparator !== "object" || Object.keys(comparator).length !== 1) {
			throw new InsightError("SComparison must have exactly one key-value pair");
		}
		if (typeof Object.values(comparator)[0] !== "string") {
			throw new InsightError("The value for SComparison must be a string");
		}
	}

	public validateOptionsClause(options: Options): void {
		if (!options.COLUMNS || options.COLUMNS.length === 0) {
			throw new InsightError("COLUMNS must be a non-empty array");
		}

		options.COLUMNS.forEach((column) => {
			if (typeof column !== "string") {
				throw new InsightError("Each item in COLUMNS must be a string");
			}
		});

		// if (options.ORDER && typeof options.ORDER !== "string") {
		// 	console.log("--------------------------INSIDE VALIDATION--------------");
		// 	throw new InsightError("ORDER must be a string");
		// }
		if (options.ORDER) {
			const order = options.ORDER;
			if (typeof order === "string") {
				this.validateOrderString(order, options.COLUMNS);
			} else {
				this.validateOrderObject(order, options.COLUMNS);
			}
		}
	}

	private validateOrderString(order: string, columns: string[]): void {
		if (!columns.includes(order)) {
			throw new InsightError("ORDER must be one of the COLUMNS when it's a string");
		}
	}

	private validateOrderObject(order: Order, columns: string[]): void {
		if (order.dir !== "UP" && order.dir !== "DOWN") {
			throw new InsightError("ORDER direction must be UP or DOWN");
		}
		if (!Array.isArray(order.keys) || order.keys.length === 0) {
			throw new InsightError("ORDER keys must be a non-empty array");
		}
		order.keys.forEach((key) => {
			if (typeof key !== "string" || !columns.includes(key)) {
				throw new InsightError("Each ORDER key must be a string and included in COLUMNS");
			}
		});
	}

	private validateTransformationsClause(transformations: Transformations): void {
		this.validateGroupArray(transformations.GROUP);
		this.validateApplyArray(transformations.APPLY);
	}

	private validateGroupArray(group: string[]): void {
		group.forEach((key) => {
			if (typeof key !== "string") {
				throw new InsightError("Each GROUP key must be a string");
			}
		});
	}

	private validateApplyArray(apply: ApplyRule[]): void {
		const seenApplyKeys = new Set<string>();
		apply.forEach((rule) => {
			const applyKey = Object.keys(rule)[0];
			if (seenApplyKeys.has(applyKey)) {
				throw new InsightError(`Each APPLY key must be unique. Duplicate found: ${applyKey}`);
			}
			seenApplyKeys.add(applyKey);

			const applyToken = Object.keys(rule[applyKey])[0];
			const tokenValue = rule[applyKey][applyToken];
			this.validateApplyToken(applyToken, tokenValue);
		});
	}

	private validateApplyToken(applyToken: string, tokenValue: string): void {
		if (!["MAX", "MIN", "AVG", "COUNT", "SUM"].includes(applyToken)) {
			throw new InsightError(`Invalid APPLY token: ${applyToken}`);
		}
		if (typeof tokenValue !== "string") {
			throw new InsightError(`Value for ${applyToken} must be a string`);
		}
	}
}
