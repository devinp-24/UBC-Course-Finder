import {InsightError} from "../controller/IInsightFacade";
import {
	Query,
	Filter,
	LogicComparison,
	MComparison,
	SComparison,
	Options,
	ApplyRule,
	Transformations, Order
} from "../dataModels/Query";
export class Parser {

	public parseQuery(query: unknown): Query {
		if (typeof query !== "object" || query === null) {
			throw new InsightError("Query must be an object");
		}

		// Extract WHERE, OPTIONS, and optionally TRANSFORMATIONS from the query
		const whereClause = this.parseWhereClause((query as any)["WHERE"]);
		const optionsClause = this.parseOptionsClause((query as any)["OPTIONS"]);
		const transformationsClause = (query as any)["TRANSFORMATIONS"]
			? this.parseTransformationsClause((query as any)["TRANSFORMATIONS"])
			: undefined; // incase there is no transformation

		// Construct and return the query object
		const parsedQuery: Query = {
			WHERE: whereClause,
			OPTIONS: optionsClause,
		};

		// If TRANSFORMATIONS is present in the query
		if (transformationsClause) {
			parsedQuery.TRANSFORMATION = transformationsClause;
		}

		return parsedQuery;
	}

	public parseWhereClause(where: unknown): Filter {
		if (typeof where !== "object" || where === null) {
			throw new Error("WHERE clause must be an object");
		}

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

	public parseLogicalComparison(operator: string, filters: unknown): LogicComparison {
		if (!Array.isArray(filters)) {
			throw new Error(`${operator} value must be an array`);
		}
		return {
			[operator]: filters.map((filter) => this.parseWhereClause(filter)),
		};
	}

	public parseMComparison(operator: string, comparison: unknown): MComparison {
		if (typeof comparison !== "object" || comparison === null || Object.keys(comparison).length !== 1) {
			throw new Error(`${operator} comparison requires a single field with a numeric value`);
		}
		const [field, value] = Object.entries(comparison)[0];
		if (typeof value !== "number") {
			throw new Error(`Value for ${field} in ${operator} comparison must be a number`);
		}
		return {[operator]: {[field]: value}};
	}

	public parseSComparison(comparison: unknown): SComparison {
		if (typeof comparison !== "object" || comparison === null || Object.keys(comparison).length !== 1) {
			throw new Error("IS comparison requires a single field with a string value");
		}
		const [field, value] = Object.entries(comparison)[0];
		if (typeof value !== "string") {
			throw new Error(`Value for ${field} in IS comparison must be a string`);
		}
		return {IS: {[field]: value}};
	}

	public parseOptionsClause(options: unknown): Options {
		if (typeof options !== "object" || options === null) {
			throw new InsightError("OPTIONS must be an object");
		}

		const optionsObj = options as Partial<Options>;
		if (!Array.isArray(optionsObj.COLUMNS) || optionsObj.COLUMNS.length === 0) {
			throw new InsightError("COLUMNS must be a non-empty array");
		}

		// Validate that each item in COLUMNS is a string
		const columns = optionsObj.COLUMNS;
		columns.forEach((column) => {
			if (typeof column !== "string") {
				throw new InsightError("Each item in COLUMNS must be a string");
			}
		});

		const parsedOptions: Options = {COLUMNS: columns};

		// If ORDER is specified, validate it
		if (optionsObj.ORDER !== undefined) {
			const order = optionsObj.ORDER;
			if (typeof order === "string") {
				parsedOptions.ORDER = order;
			} else if (typeof order === "object" && order !== null) {
				parsedOptions.ORDER = this.parseOrderClause(order);
			} else {
				throw new InsightError("Invalid ORDER format");
			}
		}

		return parsedOptions;
	}

	private parseOrderClause(order: unknown): Order | string {
		// Check if 'order' is a string, which is a simple case, return it directly
		if (typeof order === "string") {
			return order;
		}

		// If 'order' is not a string, we need to ensure it's an object with the correct properties
		if (typeof order === "object" && order !== null && "dir" in order && "keys" in order) {
			const dir = (order as any).dir;
			const keys = (order as any).keys;
			if (dir !== "UP" && dir !== "DOWN") {
				throw new InsightError("ORDER direction must be UP or DOWN");
			}
			if (!Array.isArray(keys)) {
				throw new InsightError("ORDER keys must be an array");
			}
			keys.forEach((key) => {
				if (typeof key !== "string") {
					throw new InsightError("Each ORDER key must be a string");
				}
			});
			return {dir, keys};
		} else {
			// If 'order' is neither a string nor a properly structured object, throw an error
			throw new InsightError("Invalid ORDER format");
		}
	}

	public parseTransformationsClause(transformations: unknown): Transformations {
		if (typeof transformations !== "object" || transformations === null) {
			throw new InsightError("TRANSFORMATIONS must be an object");
		}

		const transformationsObj = transformations as Partial<Transformations>;
		if (!Array.isArray(transformationsObj.GROUP) || transformationsObj.GROUP.length === 0) {
			throw new InsightError("GROUP must be a non-empty array");
		}

		// Parse GROUP array
		const group: string[] = transformationsObj.GROUP;
		group.forEach((key) => {
			if (typeof key !== "string") {
				throw new InsightError("Each key in GROUP must be a string");
			}
		});

		// Parse APPLY array
		const apply: ApplyRule[] = [];
		if (Array.isArray(transformationsObj.APPLY)) {
			transformationsObj.APPLY.forEach((rule) => {
				const applyKey = Object.keys(rule)[0];
				const applyToken = Object.keys(rule[applyKey])[0];
				const key = rule[applyKey][applyToken];
				if (typeof applyKey !== "string" || typeof applyToken !== "string" || typeof key !== "string") {
					throw new InsightError("Invalid APPLY rule format");
				}
				apply.push({[applyKey]: {[applyToken]: key}});
			});
		}
		apply.forEach((rule: ApplyRule) => {
			const applyKey = Object.keys(rule)[0];
			const applyToken = Object.keys(rule[applyKey])[0];
			const tokenValue = rule[applyKey][applyToken];

			if (!["MAX", "MIN", "AVG", "COUNT", "SUM"].includes(applyToken)) {
				throw new InsightError(`Invalid APPLY token: ${applyToken}`);
			}

			if (typeof tokenValue !== "string") {
				throw new InsightError(`Value for ${applyToken} must be a string`);
			}
		});

		return {
			GROUP: group,
			APPLY: apply
		};
	}
}


