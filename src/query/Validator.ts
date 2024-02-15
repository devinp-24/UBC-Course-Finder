import {InsightError} from "../controller/IInsightFacade";
import {Query, Filter, LogicComparison, MComparison, SComparison, Options} from "../dataModels/Query";

export class Validator {
	public validateQuery(query: Query): void {
		this.validateWhereClause(query.WHERE);
		this.validateOptionsClause(query.OPTIONS);
	}

	private validateWhereClause(filter: Filter): void {
		if (Object.keys(filter).length === 0) {
			// An empty WHERE object is valid, matches all entries
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

	private validateOptionsClause(options: Options): void {
		if (!options.COLUMNS || options.COLUMNS.length === 0) {
			throw new InsightError("COLUMNS must be a non-empty array");
		}
		options.COLUMNS.forEach((column) => {
			if (typeof column !== "string") {
				throw new InsightError("Each item in COLUMNS must be a string");
			}
		});
		if (options.ORDER && typeof options.ORDER !== "string") {
			throw new InsightError("ORDER must be a string");
		}
	}
}
