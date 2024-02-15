import {InsightError} from "../controller/IInsightFacade";
import {Query, Filter, LogicComparison, MComparison, SComparison, Options} from "../dataModels/Query";
export class Parser {
	public parseQuery(query: unknown): Query {
		// Initial validation of the query object
		if (typeof query !== "object" || query === null) {
			throw new InsightError("Query must be an object");
		}
		// Parse the WHERE and OPTIONS parts of the query
		const whereClause = this.parseWhereClause((query as any)["WHERE"]);
		const optionsClause = this.parseOptionsClause((query as any)["OPTIONS"]);
		// Construct and return the parsed query object
		return {WHERE: whereClause, OPTIONS: optionsClause};
	}

	private parseWhereClause(where: unknown): Filter {
		if (typeof where !== "object" || where === null) {
			throw new Error("WHERE clause must be an object");
		}

		// An empty WHERE object matches all entries
		if (Object.keys(where).length === 0) {
			return {}; // Represents no filter
		}

		const filterType = Object.keys(where)[0];
		const filterValue = (where as any)[filterType];
		switch (filterType) {
			case "AND":
			case "OR":
				return this.parseLogicalComparison(filterType, filterValue);
			case "LT":
			case "GT":
			case "EQ":
				return this.parseMComparison(filterType, filterValue);
			case "IS":
				return this.parseSComparison(filterValue);
			case "NOT":
				return {NOT: this.parseWhereClause(filterValue)};
			default:
				throw new Error(`Invalid filter type: ${filterType}`);
		}
	}

	private parseLogicalComparison(operator: string, filters: unknown): LogicComparison {
		if (!Array.isArray(filters)) {
			throw new Error(`${operator} value must be an array`);
		}
		return {
			[operator]: filters.map((filter) => this.parseWhereClause(filter)),
		};
	}

	private parseMComparison(operator: string, comparison: unknown): MComparison {
		if (typeof comparison !== "object" || comparison === null || Object.keys(comparison).length !== 1) {
			throw new Error(`${operator} comparison requires a single field with a numeric value`);
		}
		const [field, value] = Object.entries(comparison)[0];
		if (typeof value !== "number") {
			throw new Error(`Value for ${field} in ${operator} comparison must be a number`);
		}
		return {[operator]: {[field]: value}};
	}

	private parseSComparison(comparison: unknown): SComparison {
		if (typeof comparison !== "object" || comparison === null || Object.keys(comparison).length !== 1) {
			throw new Error("IS comparison requires a single field with a string value");
		}
		const [field, value] = Object.entries(comparison)[0];
		if (typeof value !== "string") {
			throw new Error(`Value for ${field} in IS comparison must be a string`);
		}
		return {IS: {[field]: value}};
	}

	private parseOptionsClause(options: unknown): Options {
		if (typeof options !== "object" || options === null) {
			throw new Error("OPTIONS must be an object");
		}

		const optionsObj = options as Partial<{COLUMNS: unknown; ORDER: unknown}>;
		if (!Array.isArray(optionsObj.COLUMNS) || optionsObj.COLUMNS.length === 0) {
			throw new Error("COLUMNS must be a non-empty array");
		}

		// Validate that each item in COLUMNS is a string
		const columns = optionsObj.COLUMNS;
		columns.forEach((column) => {
			if (typeof column !== "string") {
				throw new Error("Each item in COLUMNS must be a string");
			}
		});

		const parsedOptions: Options = {
			COLUMNS: columns,
		};

		// If ORDER is specified, validate it
		if (optionsObj.ORDER !== undefined) {
			if (typeof optionsObj.ORDER !== "string") {
				throw new Error("ORDER must be a string");
			}
			parsedOptions.ORDER = optionsObj.ORDER;
		}

		return parsedOptions;
	}
}


