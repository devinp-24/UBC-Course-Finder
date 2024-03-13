import {
	Query,
	Filter,
	LogicComparison,
	MComparison,
	SComparison,
	Options,
	Negation,
	Order,
	Transformations, ApplyRule
} from "../dataModels/Query";
import CourseData from "../dataModels/CourseData";
import Section from "../dataModels/Section";
import {InsightError, InsightResult, ResultTooLargeError} from "../controller/IInsightFacade";
import Room from "../dataModels/Room";
import RoomData from "../dataModels/RoomData";
import Decimal from "decimal.js";

export class Executor {
	public extractDatasetId(query: Query): string {
		// Initialize an empty set to collect unique dataset IDs
		let datasetIds = new Set<string>();
		// Extract dataset IDs from the WHERE clause
		this.extractIdsFromFilter(query.WHERE, datasetIds);
		// Extract dataset IDs from the OPTIONS clause
		query.OPTIONS.COLUMNS.forEach((column) => {
			const datasetId = this.extractIdFromKey(column);
			if (datasetId) {
				datasetIds.add(datasetId);
			}
		});

		// Assuming consistency, there should only be one dataset ID
		if (datasetIds.size !== 1) {
			throw new Error("Query must use a single dataset ID");
		}

		return datasetIds.values().next().value;
	}

	// this helper method was created with the help of chatGPT
	private extractIdsFromFilter(filter: Filter, datasetIds: Set<string>): void {

		Object.entries(filter).forEach(([key, value]) => {
			if (key === "AND" || key === "OR") {
				(value as Filter[]).forEach((subFilter) => this.extractIdsFromFilter(subFilter, datasetIds));
			} else if (key === "NOT") {
				this.extractIdsFromFilter(value as Filter, datasetIds);
			} else {
				// MComparison, SComparison
				const fieldKey = Object.keys(value)[0];
				const datasetId = this.extractIdFromKey(fieldKey);
				if (datasetId) {
					datasetIds.add(datasetId);
				}
			}
		});
	}

	private extractIdFromKey(key: string): string | null {
		const underscoreIndex = key.indexOf("_");
		if (underscoreIndex !== -1) {
			return key.substring(0, underscoreIndex);
		}
		return null;
	}

	public applyFilters(courseData: CourseData | RoomData, filter: Filter): Section[] | Room[] {

		if (Object.keys(filter).length === 0) {
			if (courseData instanceof CourseData) {
				return courseData.sections;
			} else {
				return courseData.rooms;
			}
			// If the filter is empty, return all sections
		}

		if (courseData instanceof CourseData) {
			return courseData.sections.filter((section) => {
				return this.evaluateFilter(section, filter);
			});
		} else {
			return courseData.rooms.filter((section) => {
				return this.evaluateFilter(section, filter);
			});
		}
	}

	private isLogicComparison(filter: Filter): filter is LogicComparison {
		return "AND" in filter || "OR" in filter;
	}

	private isMComparison(filter: Filter): filter is MComparison {
		return "LT" in filter || "GT" in filter || "EQ" in filter;
	}

	private isSComparison(filter: Filter): filter is SComparison {
		return "IS" in filter;
	}

	private isNegation(filter: Filter): filter is Negation {
		return "NOT" in filter;
	}

	private evaluateFilter(section: Section | Room, filter: Filter): boolean {
		if (this.isLogicComparison(filter)) {
			if (filter.AND) {
				return filter.AND.every((subFilter) => this.evaluateFilter(section, subFilter));
			} else if (filter.OR) {
				return filter.OR.some((subFilter) => this.evaluateFilter(section, subFilter));
			} else {
				return false;
			}
		} else if (this.isNegation(filter)) {
			return !this.evaluateFilter(section, filter.NOT);
		} else if (this.isSComparison(filter)) {
			const [key, comparisonValue] = Object.entries(filter.IS)[0];
			const keyParts = key.split("_");
			const value = filter.IS[key];
			const getValue = section.get(keyParts[1]) as string;
			// Assuming wildcards are not to be implemented in this example
			if (comparisonValue.startsWith("*") && comparisonValue.endsWith("*")) {
				const trimmedValue = comparisonValue.slice(1, -1);
				return getValue.includes(trimmedValue);
			} else if (comparisonValue.startsWith("*")) {
				const trimmedValue = comparisonValue.slice(1);
				return getValue.endsWith(trimmedValue);
			} else if (comparisonValue.endsWith("*")) {
				const trimmedValue = comparisonValue.slice(0, -1);
				return getValue.startsWith(trimmedValue);
			} else {
				return getValue === value;
			}
		} else if (this.isMComparison(filter)) {
			const comparatorKey = Object.keys(filter)[0];
			const key = Object.keys((filter as any)[comparatorKey])[0];
			const targetValue = (filter as any)[comparatorKey][key];
			const keyParts = key.split("_");
			const sectionValue = section.get(keyParts[1]);

			if (sectionValue === undefined) {
				throw new Error("Attempted to compare an undefined value");
			}
			switch (comparatorKey) {
				case "LT": return sectionValue < targetValue;
				case "GT": return sectionValue > targetValue;
				case "EQ": return sectionValue === targetValue;
				default: throw new Error(`Unknown comparison: ${comparatorKey}`);
			}
		} else {
			throw new Error("Unknown filter type");
		}
	}

	// this helper method was created with the help of chatGPT
	public formatResults(sections: Array<Section | Room>, options: Options): any[] {
		const results = sections.map((section) => {
			const result: any = {};
			options.COLUMNS.forEach((column) => {
				const colParts = column.split("_");
				const key = colParts[1];
				if (colParts.length === 2) {
					if ((section instanceof Section) || (section instanceof Room)) {
						result[column] = section.get(key);
					} else {
						result[column] = section[column as keyof Section];
					}
				} else {
					// If there's no underscore, it's an applied column, so just directly access the property
					result[column] = (section as any)[column];
				}
			});
			return result;
		});


		// Add sort functionality if there is an ORDER clause
		if (options.ORDER) {
			results.sort(this.getSortFunction(options.ORDER));
		}
		return results;
	}

// Helper function to generate a sort function based on the ORDER clause
	private getSortFunction(order: Order | string): (a: any, b: any) => number {
		// Handle string ORDER, which is a single key with ascending sort
		if (typeof order === "string") {
			return (a, b) => {
				return a[order] > b[order] ? 1 : a[order] < b[order] ? -1 : 0;
			};
		}
		// Handle Order object, which can have multiple keys and a direction
		return (a, b) => {
			for (const key of order.keys) {
				if (a[key] !== b[key]) {
					const directionMultiplier = order.dir === "UP" ? 1 : -1;
					return a[key] > b[key] ? directionMultiplier : -directionMultiplier;
				}
			}
			return 0;
		};
	}

	public executeGroupAndApply(rows: Section[] | Room[], transformations: Transformations): any[] {
		// console.log("-----------------------------INSIDE GROUP AND APPLY-------------------------------------");
		const groups = this.groupBy(rows, transformations.GROUP);
		// console.log("-----------------------------GROUPBY DONE --------------------------------------");
		return this.applyTransformations(groups, transformations.APPLY, transformations.GROUP);
	}

	// this helper method was created with the help of chatGPT
	private groupBy(rows: Array<Section | Room>, groupKeys: string[]): Map<string, Array<Section | Room>> {
		const groups = new Map<string, Array<Section | Room>>();
		rows.forEach((row) => {
			const groupKey = groupKeys.map((key) => {
				const value = row.get(key.split("_")[1]);
				if (value === undefined) {
					throw new InsightError(`Value for key ${key} is undefined`);
				}
				return typeof value === "number" ? value.toString() : value;
			}).join("||");

			const group = groups.get(groupKey) || [];
			group.push(row);
			groups.set(groupKey, group);
		});
		return groups;
	}

	private applyTransformations(groups: Map<string, Array<Section | Room>>
		, applyRules: ApplyRule[], groupKeys: string[]): any[] {
		// console.log("-----------------------------TRANSFORMATION STARTS--------------------------------------");
		const transformedResults: any[] = [];
		// Iterate through each group to apply the transformations
		groups.forEach((groupRows, groupKey) => {
			// Initialize an object to accumulate results for this group
			const result: any = {};
			// Handle APPLY rules, performing aggregation operations on the groupRows
			applyRules.forEach((rule) => {
				const applyKey = Object.keys(rule)[0];
				const applyOperation = rule[applyKey];
				const operationType = Object.keys(applyOperation)[0];
				const fieldToOperateOn = applyOperation[operationType];
				result[applyKey] = this.performApplyOperation(groupRows, fieldToOperateOn, operationType);
			});
			// Split the concatenated groupKey to get individual group values
			// Add the group values to the result object using the keys from groupKeys
			const groupValues = groupKey.split("||");
			groupKeys.forEach((key, index) => {
				result[key] = groupValues[index];
			});
			transformedResults.push(result);
		});
		return transformedResults;
	}

	private performApplyOperation( groupRows: Array<Section | Room>, applyToken: string, targetField: string): number {
		if (targetField === "AVG") {
			return this.getAvg(groupRows, applyToken);
		} else if (targetField === "MAX") {
			return this.getMax(groupRows, applyToken);
		} else if (targetField === "MIN") {
			return this.getMin(groupRows, applyToken);
		} else if (targetField === "SUM") {
			return this.getSum(groupRows, applyToken);
		} else if (targetField === "COUNT") {
			return this.getCount(groupRows, applyToken);
		} else {
			throw new InsightError("Invalid");
		}
	}

	private getMax(groupRows: Array<Section | Room>, targetField: string): number {
		return groupRows.reduce((max, row) => {
			const value = row.get(targetField.split("_")[1]);
			return typeof value === "number" && value > max ? value : max;
		}, Number.NEGATIVE_INFINITY);
	}


	private getMin(groupRows: Array<Section | Room>, targetField: string): number {
		return groupRows.reduce((min, row) => {
			const value = row.get(targetField.split("_")[1]);
			return typeof value === "number" && value < min ? value : min;
		}, Number.POSITIVE_INFINITY);
	}

	private getAvg(groupRows: Array<Section | Room>, targetField: string): number {
		let total = new Decimal(0);
		groupRows.forEach((row) => {
			const value = row.get(targetField.split("_")[1]);
			if (typeof value === "number") {
				total = total.plus(value);
			}
		});
		const avg = total.div(groupRows.length);
		return Number(avg.toFixed(2));
	}

	private getSum(groupRows: Array<Section | Room>, targetField: string): number {
		let total = new Decimal(0);
		groupRows.forEach((row) => {
			const value = row.get(targetField.split("_")[1]);
			if (typeof value === "number") {
				total = total.plus(value);
			}
		});
		return Number(total.toFixed(2));
	}

	private getCount(groupRows: Array<Section | Room>, targetField: string): number {
		const uniqueValues = new Set();
		groupRows.forEach((row) => {
			const value = row.get(targetField.split("_")[1]);
			if (value !== undefined) {
				uniqueValues.add(value);
			}
		});
		return uniqueValues.size;
	}

	public sortResults(results: any[], order: Order): any[] {
		const directionMultiplier = order.dir === "UP" ? 1 : -1;

		// Sort results by the specified keys
		return results.sort((a, b) => {
			for (const key of order.keys) {
				if (a[key] < b[key]) {
					return -1 * directionMultiplier;
				} else if (a[key] > b[key]) {
					return 1 * directionMultiplier;
				}
				// if a[key] === b[key], continue to the next key
			}
			return 0; // If all keys are equal
		});
	}
}
